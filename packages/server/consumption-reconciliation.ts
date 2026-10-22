import type {ReportQuery,ReportRow,ReconciliationSummary,RecipeVersion} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {compareConsumption,theoreticalConsumption,type ReconciliationEntry,type ReconciliationCount,type ReconciliationSale} from '../domain/consumption-reconciliation';
import {recipeSnapshot} from './recipes';
import {reconcileStock} from './counts';
import type {QueryDatabase} from './database';

/** Caller holds the organization read lock; every source is independently scoped to that tenant. */
export async function consumptionReconciliation(tx:QueryDatabase,q:ReportQuery){
 const org=q.organizationId;
 const metadata=(await tx.query<{itemId:string;name:string;sku:string;category:string;unit:string;locationId:string;locationName:string;kitchenId:string;kitchenName:string}>(`SELECT i.id AS "itemId",i.name,i.sku,i.category,COALESCE(u.name,i.unit) AS unit,l.id AS "locationId",l.name AS "locationName",COALESCE(k.id,'') AS "kitchenId",COALESCE(k.name,'') AS "kitchenName" FROM items i JOIN locations l ON l.organization_id=i.organization_id LEFT JOIN units u ON u.organization_id=i.organization_id AND u.id=i.unit_id LEFT JOIN kitchens k ON k.organization_id=l.organization_id AND k.location_id=l.id WHERE i.organization_id=$1 AND ($2='' OR l.id=$2) AND ($3='' OR i.category=$3) AND ($4='' OR i.id=$4) AND ($5='' OR k.id=$5) AND ($6='' OR strpos(lower(i.name||' '||i.sku||' '||l.name),lower($6))>0)`,[org,q.locationId,q.category,q.itemId,q.kitchenId,q.search])).rows;
 const locationIds=[...new Set(metadata.map(m=>m.locationId))],itemIds=[...new Set(metadata.map(m=>m.itemId))];
 const entries=(await tx.query<ReconciliationEntry>(`SELECT sequence::text,operation_id::text AS "operationId",item_id AS "itemId",location_id AS "locationId",quantity::text,amount::text,type,business_date::text AS "businessDate",count_id::text AS "countId" FROM stock_entries WHERE organization_id=$1 AND location_id=ANY($2::text[]) AND item_id=ANY($3::text[]) ORDER BY sequence`,[org,locationIds,itemIds])).rows;
 const counts=(await tx.query<ReconciliationCount>(`SELECT c.count_id::text AS "countId",c.payload AS document,f.changes FROM stock_counts c JOIN count_finalizations f ON f.organization_id=c.organization_id AND f.count_id=c.count_id WHERE c.organization_id=$1 AND c.state='finalized' AND c.location_id=ANY($2::text[]) AND (c.payload->>'businessDate')::date BETWEEN $3::date-1 AND $4::date`,[org,locationIds,q.from,q.to])).rows;
 const sales=(await tx.query<ReconciliationSale>(`SELECT location_id AS "locationId",version_id::text AS "versionId",payload->>'outputPerSale' AS "outputPerSale",payload->>'quantity' AS quantity,business_date::text AS "businessDate" FROM sales_details WHERE organization_id=$1 AND location_id=ANY($2::text[]) AND business_date BETWEEN $3::date AND $4::date`,[org,locationIds,q.from,q.to])).rows;
 const versions:RecipeVersion[]=(await recipeSnapshot(tx,org)).recipeVersions,theory=theoreticalConsumption(sales,versions);
 const selections=(await tx.query<{locationId:string;itemId:string;required:string;missing:string}>(`SELECT si.location_id AS "locationId",s.value->>'itemId' AS "itemId",sum((s.value->>'requiredQuantity')::numeric)::text AS required,sum((s.value->>'shortageQuantity')::numeric)::text AS missing FROM sales_imports si CROSS JOIN LATERAL jsonb_array_elements(COALESCE(si.result->'stockShortages','[]'::jsonb)) s(value) WHERE si.organization_id=$1 AND si.location_id=ANY($2::text[]) AND (s.value->>'businessDate')::date BETWEEN $3::date AND $4::date GROUP BY si.location_id,s.value->>'itemId'`,[org,locationIds,q.from,q.to])).rows;
 // Required selected usage equals immutable deducted quantity plus the immutable missing quantity.
 const deductions=(await tx.query<{locationId:string;itemId:string;quantity:string}>(`SELECT si.location_id AS "locationId",d.value->>'itemId' AS "itemId",sum((d.value->>'quantity')::numeric)::text AS quantity FROM sales_imports si CROSS JOIN LATERAL jsonb_array_elements(COALESCE(si.result->'stockDeductions','[]'::jsonb)) d(value) WHERE si.organization_id=$1 AND si.location_id=ANY($2::text[]) AND (d.value->>'businessDate')::date BETWEEN $3::date AND $4::date GROUP BY si.location_id,d.value->>'itemId'`,[org,locationIds,q.from,q.to])).rows;
 const reconciliation=await reconcileStock(tx,org),key=(r:{locationId:string;itemId:string})=>JSON.stringify([r.locationId,r.itemId]);
 const entryGroups=new Map<string,ReconciliationEntry[]>();for(const e of entries){const k=key(e);if(!entryGroups.has(k))entryGroups.set(k,[]);entryGroups.get(k)!.push(e);}
 const all:ReportRow[]=[];
 for(const m of metadata){
  const k=key(m),history=entryGroups.get(k)??[],theoretical=theory.quantities.get(k)??'0';
  if(!theory.quantities.has(k)&&!history.some(e=>e.businessDate>=q.from&&e.businessDate<=q.to)&&!counts.some(c=>c.document.locationId===m.locationId&&c.changes.some(l=>l.itemId===m.itemId)))continue;
  const shortage=selections.find(s=>key(s)===k)?.missing??'0',deducted=deductions.find(d=>key(d)===k)?.quantity??'0';
  const comparison=compareConsumption({from:q.from,to:q.to,itemId:m.itemId,locationId:m.locationId,entries:history,counts,theoretical,selectedRequired:decimal(deducted).add(shortage).toString(),shortage,recipeIssues:theory.issues.get(m.locationId)??[],ledgerMatches:reconciliation.find(r=>key(r)===k)?.matches??!history.length});
  const {unitCost,...detail}=comparison;
  all.push({...m,id:k,date:q.to,quantity:detail.variance??'0',amount:detail.varianceCost??'0',unitCost,type:'consumption.reconciliation',reference:'',supplierId:'',supplierName:'',comparison:detail});
 }
 const complete=all.filter(r=>r.comparison!.status==='complete'),priced=complete.filter(r=>r.comparison!.varianceCost!==null),sum=(field:'varianceCost'|'theoreticalCost'|'actualCost')=>priced.reduce((n,r)=>n.add(r.comparison![field]!),decimal('0')).toString();
 const summary:ReconciliationSummary={complete:complete.length,incomplete:all.length-complete.length,priced:priced.length,varianceCost:sum('varianceCost'),theoreticalCost:sum('theoreticalCost'),actualCost:sum('actualCost'),issues:[...new Set([...theory.issues.values()].flat())],ranks:priced.filter(r=>!decimal(r.comparison!.varianceCost!).isZero()).sort((a,b)=>decimal(b.amount).abs().cmp(decimal(a.amount).abs())||a.id.localeCompare(b.id)).slice(0,10).map(r=>({key:r.itemId,label:r.name+' · '+r.locationName,value:r.amount}))};
 const direction=q.sort.endsWith('_asc')?1:-1,field=q.sort.startsWith('quantity')?'quantity':'amount';
 all.sort((a,b)=>(q.sort.startsWith('name')?a.name.localeCompare(b.name,'ar'):q.sort.startsWith('date')?a.date.localeCompare(b.date):decimal(a[field]).cmp(b[field]))*direction||a.id.localeCompare(b.id));
 const page=Math.min(q.page,Math.max(1,Math.ceil(all.length/q.pageSize)));
 return {summary,total:all.length,page,rows:all.slice((page-1)*q.pageSize,page*q.pageSize)};
}
