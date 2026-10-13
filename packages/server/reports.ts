import {BusinessError,reportQuerySchema,type Access,type ReportQuery,type ReportResponse,type PeriodMetrics,type ReportRank,type ReportRow,type ReportDay,type Item,type RecipeVersion,type Balance,type SalesLine} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {resolveRecipe} from '../domain/recipes';
import {egyptDate,previousReportRange} from '../domain/reporting';
import {recipeSnapshot} from './recipes';
import {assertGeneration} from './valuation';
import type {Database} from './database';

const paramsCte=`args AS (SELECT $1::text,$2::date,$3::date,$4::text,$5::text,$6::text,$7::text,$8::text,$9::text,$10::text)`;
const joins=`FROM stock_entries e JOIN items i ON i.organization_id=e.organization_id AND i.id=e.item_id JOIN locations l ON l.organization_id=e.organization_id AND l.id=e.location_id
 LEFT JOIN units u ON u.organization_id=i.organization_id AND u.id=i.unit_id
 LEFT JOIN kitchens ki ON ki.organization_id=e.organization_id AND ki.location_id=e.location_id
 LEFT JOIN kitchen_issues k ON k.organization_id=e.organization_id AND k.operation_id=e.kitchen_issue_id
 LEFT JOIN purchase_receipts pr ON pr.organization_id=e.organization_id AND pr.operation_id=e.purchase_receipt_id
 LEFT JOIN purchase_orders po ON po.organization_id=pr.organization_id AND po.order_id=pr.order_id
 LEFT JOIN suppliers s ON s.organization_id=e.organization_id AND s.id=COALESCE(e.supplier_id,po.payload->>'supplierId')`;
const scope=`e.organization_id=$1 AND ($4='' OR e.location_id=$4) AND ($5='' OR i.category=$5) AND ($6='' OR i.id=$6)
 AND ($7='' OR ($7='__none__' AND s.id IS NULL) OR s.id=$7) AND ($8='' OR COALESCE(ki.id,k.kitchen_id,k.payload->>'kitchenId',k.payload->>'kitchen')=$8)
 AND ($9='' OR strpos(lower(i.name||' '||i.sku||' '||e.reason||' '||COALESCE(s.name,'')||' '||COALESCE(k.payload->>'kitchen','')),lower($9))>0)`;
const movementCte=`m AS (SELECT e.*,i.name,i.sku,i.category,COALESCE(u.name,i.unit) AS unit,l.name AS location_name,COALESCE(s.id,'') AS supplier_key,COALESCE(s.name,'بدون مورد محدد') AS supplier_name,
 COALESCE(ki.id,k.kitchen_id,k.payload->>'kitchenId',k.payload->>'kitchen','') AS kitchen_key,COALESCE(ki.name,k.payload->>'kitchen','') AS kitchen_name ${joins} WHERE ${scope} AND e.business_date BETWEEN $2::date AND $3::date)`;
const inventoryCte=`inv AS (SELECT i.id AS item_id,i.name,i.sku,i.category,COALESCE(u.name,i.unit) AS unit,(i.active AND l.active) AS active,i.minimum,l.id AS location_id,l.name AS location_name,
 COALESCE(b.quantity,0) AS quantity,COALESCE(b.value,0) AS amount,CASE WHEN b.quantity>0 THEN b.value/b.quantity ELSE NULL END AS unit_cost
 FROM items i CROSS JOIN locations l LEFT JOIN units u ON u.organization_id=i.organization_id AND u.id=i.unit_id LEFT JOIN stock_balances b ON b.organization_id=i.organization_id AND b.item_id=i.id AND b.location_id=l.id
 WHERE i.organization_id=$1 AND l.organization_id=$1 AND ($4='' OR l.id=$4) AND ($5='' OR i.category=$5) AND ($6='' OR i.id=$6)
 AND ($9='' OR strpos(lower(i.name||' '||i.sku),lower($9))>0))`;
const salesCte=`sd AS (SELECT d.*,l.name AS location_name,si.result->'routing' AS routing FROM sales_details d JOIN sales_imports si ON si.organization_id=d.organization_id AND si.operation_id=d.import_id JOIN locations l ON l.organization_id=d.organization_id AND l.id=d.location_id
 WHERE d.organization_id=$1 AND ($10='' OR si.result->'document'->>'posId'=$10) AND ($4='' OR d.location_id=$4) AND ($6='' OR d.menu_item_id::text=$6) AND ($9='' OR strpos(lower((d.payload->>'menuName')||' '||(d.payload->>'menuCode')||' '||d.transaction_id),lower($9))>0) AND d.business_date BETWEEN $2::date AND $3::date)`;
const productionCte=`p AS (SELECT b.*,i.name,i.sku,i.category,COALESCE(u.name,i.unit) AS unit,l.name AS location_name FROM production_batches b JOIN items i ON i.organization_id=b.organization_id AND i.id=b.output_item_id LEFT JOIN units u ON u.organization_id=i.organization_id AND u.id=i.unit_id JOIN locations l ON l.organization_id=b.organization_id AND l.id=b.output_location_id
 WHERE b.organization_id=$1 AND ($4='' OR b.output_location_id=$4) AND ($5='' OR i.category=$5) AND ($6='' OR i.id=$6)
 AND ($9='' OR strpos(lower(i.name||' '||i.sku||' '||COALESCE(b.payload->>'reference','')),lower($9))>0))`;
const rowColumns=`operation_id::text AS id,business_date::text AS date,location_id AS "locationId",location_name AS "locationName",item_id AS "itemId",name,sku,category,unit,quantity::text,amount::text,CASE WHEN quantity<>0 THEN abs(amount/quantity)::text ELSE NULL END AS "unitCost",type,reason AS reference,supplier_key AS "supplierId",supplier_name AS "supplierName",kitchen_key AS "kitchenId",kitchen_name AS "kitchenName"`;
const kindTypes:Partial<Record<ReportQuery['kind'],string>>={kitchenSupply:"type IN ('kitchen.transfer.out','kitchen.issue')",kitchens:"(type='kitchen.issue' OR (type='sales.issue' AND kitchen_key<>''))",purchasing:"type IN ('receipt.post','purchase.receive','purchase.reverse','purchase.return')",waste:"type IN ('waste.post','count.adjust')"};
const order:Record<ReportQuery['sort'],string>={date_desc:'date DESC,id',date_asc:'date ASC,id',amount_desc:'amount::numeric DESC,id',amount_asc:'amount::numeric ASC,id',name_asc:'name ASC,id',name_desc:'name DESC,id',quantity_desc:'quantity::numeric DESC,id',quantity_asc:'quantity::numeric ASC,id'};

export async function getReport(db:Database,access:Access,input:unknown):Promise<ReportResponse>{
 const parsed=reportQuerySchema.safeParse(input);if(!parsed.success)throw new BusinessError('INVALID_REPORT','اختر فترة صحيحة حتى ٣٦٦ يوماً وفلاتر التقرير المناسبة.',400);
 const q=parsed.data,org=access.organizationId;
 if(q.organizationId!==org||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','الجلسة لا تسمح بتقارير هذه المؤسسة.',403);
 if(q.to>egyptDate())throw new BusinessError('INVALID_REPORT','اختر اليوم أو تاريخاً سابقاً.',400);
 // Supply reports count the source side once, but a destination location can also select the document.
 const movementSql=q.kind==='kitchenSupply'?movementCte
  .replace("($4='' OR e.location_id=$4)","($4='' OR e.location_id=$4 OR k.payload->>'destinationLocationId'=$4)")
  .replaceAll("COALESCE(ki.id,k.kitchen_id,k.payload->>'kitchenId',k.payload->>'kitchen'", "COALESCE(k.kitchen_id,k.payload->>'kitchenId',k.payload->>'kitchen',ki.id")
  .replace("COALESCE(ki.name,k.payload->>'kitchen','')", "COALESCE(k.payload->>'kitchen',ki.name,'')")
  .replace("e.reason||' '","e.reason||' '||COALESCE('KI-'||k.operation_id::text,'')||' '"):movementCte;
 const previousRange=previousReportRange(q.from,q.to),params=[org,q.from,q.to,q.locationId,q.category,q.itemId,q.supplierId,q.kitchenId,q.search,q.posId];
 return db.transaction(async tx=>{
  const organization=(await tx.query<{generation:string}>('SELECT generation::text FROM organizations WHERE id=$1 FOR SHARE',[org])).rows[0];
  if(!organization)throw new BusinessError('FORBIDDEN','المؤسسة غير متاحة.',403);
  await assertGeneration(tx,org,q.generation);
  for(const [table,value] of [['locations',q.locationId],['items',q.itemId],['suppliers',q.supplierId],['kitchens',q.kitchenId],['points_of_sale',q.posId]])if(value&&value!=='__none__'&&!(table==='kitchens'&&(await tx.query("SELECT 1 FROM kitchen_issues WHERE organization_id=$1 AND payload->>'kitchen'=$2 LIMIT 1",[org,value])).rows.length)&&!(await tx.query(`SELECT 1 FROM ${table==='items'&&q.kind==='sales'?'menu_items':table} WHERE organization_id=$1 AND id::text=$2`,[org,value])).rows.length)throw new BusinessError('FORBIDDEN','أحد الفلاتر خارج نطاق المؤسسة.',403);
  const checkpoint=(await tx.query<{value:string}>(`SELECT (SELECT COALESCE(max(sequence),0)::text FROM stock_entries WHERE organization_id=$1)||':'||(SELECT COALESCE(max(id),0)::text FROM audit_events WHERE organization_id=$1) AS value`,[org])).rows[0].value;
  const stockRow=(await tx.query<{value:string;items:string;low:string}>(`WITH ${paramsCte},${inventoryCte} SELECT COALESCE(sum(amount),0)::text AS value,count(DISTINCT item_id)::text AS items,count(*) FILTER(WHERE active AND quantity<minimum)::text AS low FROM inv`,params)).rows[0];
  // Price estimates are separate from ledger allocations, and always use today's stock average.
  let versions:RecipeVersion[]=[],items:Item[]=[],balances:Balance[]=[];
  if(q.kind==='sales'||q.kind==='overview'){
   versions=(await recipeSnapshot(tx,org)).recipeVersions;
   items=(await tx.query<Item>('SELECT id,name,sku,category,unit,minimum::text FROM items WHERE organization_id=$1',[org])).rows;
   balances=(await tx.query<Balance>('SELECT location_id AS "locationId",item_id AS "itemId",quantity::text,value::text,CASE WHEN quantity>0 THEN (value/quantity)::text ELSE NULL END AS average FROM stock_balances WHERE organization_id=$1',[org])).rows;
  }
  function estimate(sale:Pick<SalesLine,'versionId'|'outputPerSale'|'quantity'>,location:string):string|null{
   const version=versions.find(v=>v.versionId===sale.versionId);if(!version)return null;
   try{
    const d=version.definition,output=decimal(sale.quantity).mul(sale.outputPerSale);
    const requirements=d.outputMode==='stocked'?[{itemId:d.outputItemId!,quantity:output.toString()}]:resolveRecipe(version.recipeId,d,versions).map(r=>({...r,quantity:decimal(r.quantity).mul(output).div(d.outputQuantity).toString()}));
    let cost=decimal('0');for(const r of requirements){const balance=balances.find(b=>b.locationId===location&&b.itemId===r.itemId);if(!items.some(i=>i.id===r.itemId)||!balance?.average)return null;cost=cost.add(decimal(r.quantity).mul(balance.average));}return cost.toString();
   }catch{return null;}
  }
  async function metrics(from:string,to:string):Promise<PeriodMetrics>{
   const args=[...params];args[1]=from;args[2]=to;
   const r=(await tx.query<Omit<PeriodMetrics,'netReceived'|'sales'|'productionWaste'|'productionInput'|'estimatedSalesCost'|'estimatedMargin'|'foodCostPercent'>>(`WITH ${paramsCte},${movementSql} SELECT
    COALESCE(sum(amount) FILTER(WHERE type IN ('receipt.post','purchase.receive')),0)::text AS received,
    COALESCE(sum(abs(amount)) FILTER(WHERE type='purchase.reverse'),0)::text AS reversed,
    COALESCE(sum(abs(amount)) FILTER(WHERE type='purchase.return'),0)::text AS returned,
    COALESCE(sum(abs(reference_amount)) FILTER(WHERE type='purchase.return'),0)::text AS "returnReference",
    COALESCE(sum(abs(amount)) FILTER(WHERE (type='kitchen.issue' OR (type='sales.issue' AND kitchen_key<>''))),0)::text AS kitchen,
    COALESCE(sum(amount) FILTER(WHERE type='kitchen.transfer.in'),0)::text AS "kitchenTransferIn",
    COALESCE(sum(abs(amount)) FILTER(WHERE type='kitchen.transfer.out'),0)::text AS "kitchenTransferOut",
    count(DISTINCT COALESCE(kitchen_issue_id,operation_id)) FILTER(WHERE type IN ('kitchen.transfer.out','kitchen.issue')) AS "kitchenSupplyDocuments",
    count(DISTINCT item_id) FILTER(WHERE type IN ('kitchen.transfer.out','kitchen.issue')) AS "kitchenSupplyItems",
    COALESCE(sum(abs(amount)) FILTER(WHERE type='kitchen.issue'),0)::text AS "kitchenLegacyIssue",
    COALESCE(sum(abs(amount)) FILTER(WHERE type='waste.post'),0)::text AS waste,
    COALESCE(sum(amount) FILTER(WHERE type='count.adjust' AND amount>0),0)::text AS "countIncrease",
    COALESCE(sum(abs(amount)) FILTER(WHERE type='count.adjust' AND amount<0),0)::text AS "countDecrease",
    COALESCE(sum(abs(amount)) FILTER(WHERE type='sales.issue'),0)::text AS "salesDeduction"
    FROM m WHERE business_date BETWEEN $2::date AND $3::date`,args)).rows[0];
   if(q.kind==='sales'&&(q.itemId||q.search)){const issueArgs=[...args];issueArgs[5]='';issueArgs[8]='';r.salesDeduction=(await tx.query<{amount:string}>(`WITH ${paramsCte},${movementSql} SELECT COALESCE(sum(abs(amount)),0)::text AS amount FROM m WHERE type='sales.issue'`,issueArgs)).rows[0].amount;}
   if(q.posId){r.salesDeduction=(await tx.query<{amount:string}>(`SELECT COALESCE(sum((j.d->>'amount')::numeric),0)::text AS amount FROM sales_imports si CROSS JOIN LATERAL jsonb_array_elements(COALESCE(si.result->'stockDeductions','[]'::jsonb)) j(d) WHERE si.organization_id=$1 AND (j.d->>'businessDate')::date BETWEEN $2::date AND $3::date AND ($4='' OR si.location_id=$4) AND si.result->'document'->>'posId'=$5`,[org,from,to,q.locationId,q.posId])).rows[0].amount;}
   const saleGroups=(await tx.query<{locationId:string;versionId:string;outputPerSale:string;quantity:string;net:string}>(`WITH ${paramsCte},${salesCte} SELECT location_id AS "locationId",version_id AS "versionId",payload->>'outputPerSale' AS "outputPerSale",sum((payload->>'quantity')::numeric)::text AS quantity,sum((payload->>'netAmount')::numeric)::text AS net FROM sd WHERE business_date BETWEEN $2::date AND $3::date GROUP BY location_id,version_id,payload->>'outputPerSale'`,args)).rows;
   const sales=saleGroups.reduce((n,g)=>n.add(g.net),decimal('0')).toString(),estimates=saleGroups.map(g=>estimate(g,g.locationId)),complete=!!saleGroups.length&&estimates.every(v=>v!==null);
   const estimatedSalesCost=!saleGroups.length?'0':complete?estimates.reduce((n,v)=>n.add(v!),decimal('0')).toString():null;
   const prod=(await tx.query<{input:string;waste:string}>(`WITH ${paramsCte},${productionCte} SELECT COALESCE(sum((result->>'inputAmount')::numeric),0)::text AS input,COALESCE(sum((result->>'wasteAmount')::numeric),0)::text AS waste FROM p WHERE (payload->>'businessDate')::date BETWEEN $2::date AND $3::date`,args)).rows[0];
   return {...r,kitchenSupplyDocuments:Number(r.kitchenSupplyDocuments),kitchenSupplyItems:Number(r.kitchenSupplyItems),netReceived:decimal(r.received).sub(r.reversed).sub(r.returned).toString(),sales,productionInput:prod.input,productionWaste:prod.waste,estimatedSalesCost,estimatedMargin:estimatedSalesCost===null?null:decimal(sales).sub(estimatedSalesCost).toString(),foodCostPercent:estimatedSalesCost!==null&&decimal(sales).gt(0)?decimal(estimatedSalesCost).div(sales).mul(100).toString():null};
  }
  const current=await metrics(q.from,q.to),previous=await metrics(previousRange.from,previousRange.to);
  const inventory=(await tx.query<ReportRank>(`WITH ${paramsCte},${inventoryCte} SELECT category AS key,category AS label,sum(amount)::text AS value FROM inv GROUP BY category HAVING sum(amount)>0 ORDER BY sum(amount) DESC,category LIMIT 10`,params)).rows;
  async function rank(expression:string,label:string,where:string,value='abs(amount)'){
   return (await tx.query<ReportRank>(`WITH ${paramsCte},${movementSql} SELECT ${expression} AS key,${label} AS label,sum(${value})::text AS value FROM m WHERE business_date BETWEEN $2::date AND $3::date AND ${where} GROUP BY ${expression},${label} ORDER BY sum(${value}) DESC,key LIMIT 10`,params)).rows;
  }
  const kitchens=await rank('kitchen_key','kitchen_name',"(type='kitchen.issue' OR (type='sales.issue' AND kitchen_key<>''))");
  const kitchenSupply=q.kind==='kitchenSupply'?await rank('kitchen_key','kitchen_name',"type IN ('kitchen.transfer.out','kitchen.issue')"):[];
  const suppliers=await rank('supplier_key','supplier_name',"type IN ('receipt.post','purchase.receive','purchase.reverse','purchase.return')",'amount');
  const waste=await rank('item_id','name',"type='waste.post'");
  const sales=(await tx.query<ReportRank>(`WITH ${paramsCte},${salesCte} SELECT menu_item_id::text AS key,payload->>'menuName' AS label,sum((payload->>'netAmount')::numeric)::text AS value FROM sd WHERE business_date BETWEEN $2::date AND $3::date GROUP BY menu_item_id,payload->>'menuName' ORDER BY sum((payload->>'netAmount')::numeric) DESC,key LIMIT 10`,params)).rows;
  const production=(await tx.query<ReportRank>(`WITH ${paramsCte},${productionCte} SELECT output_item_id AS key,name AS label,sum((result->>'inputAmount')::numeric)::text AS value FROM p WHERE (payload->>'businessDate')::date BETWEEN $2::date AND $3::date GROUP BY output_item_id,name ORDER BY sum((result->>'inputAmount')::numeric) DESC,key LIMIT 10`,params)).rows;
  const daily=(await tx.query<ReportDay>(`WITH ${paramsCte},${movementSql},${salesCte},days AS(SELECT generate_series($2::date,$3::date,'1 day'::interval)::date AS day)
   SELECT day::text AS date,
   COALESCE((SELECT sum(amount) FROM m WHERE business_date=day AND type IN ('receipt.post','purchase.receive','purchase.reverse','purchase.return')),0)::text AS received,
   COALESCE((SELECT sum(abs(amount)) FROM m WHERE business_date=day AND (type='kitchen.issue' OR (type='sales.issue' AND kitchen_key<>''))),0)::text AS kitchen,
   COALESCE((SELECT sum(abs(amount)) FROM m WHERE business_date=day AND type='kitchen.transfer.out'),0)::text AS "kitchenSupply",
   COALESCE((SELECT sum(abs(amount)) FROM m WHERE business_date=day AND type='kitchen.issue'),0)::text AS "kitchenLegacyIssue",

   COALESCE((SELECT sum(abs(amount)) FROM m WHERE business_date=day AND type='waste.post'),0)::text AS waste,
   COALESCE((SELECT sum((payload->>'netAmount')::numeric) FROM sd WHERE business_date=day),0)::text AS sales
   FROM days ORDER BY day`,params)).rows;
  const shortages=(q.kind==='sales'||q.kind==='overview')?(await tx.query<NonNullable<ReportResponse['shortages']>[number]>(`SELECT i.id AS "itemId",i.name,COALESCE(u.name,i.unit) AS unit,sum((j.s->>'requiredQuantity')::numeric)::text AS required,sum((j.s->>'deductedQuantity')::numeric)::text AS deducted,sum((j.s->>'shortageQuantity')::numeric)::text AS missing FROM sales_imports si CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(si.result->'stockShortages')='array' THEN si.result->'stockShortages' ELSE '[]'::jsonb END) j(s) JOIN items i ON i.organization_id=si.organization_id AND i.id=j.s->>'itemId' LEFT JOIN units u ON u.organization_id=i.organization_id AND u.id=i.unit_id WHERE si.organization_id=$1 AND (j.s->>'businessDate')::date BETWEEN $2::date AND $3::date AND ($4='' OR si.location_id=$4) AND ($5='' OR si.result->'document'->>'posId'=$5) GROUP BY i.id,i.name,i.unit,u.name HAVING sum((j.s->>'shortageQuantity')::numeric)>0 ORDER BY i.name`,[org,q.from,q.to,q.locationId,q.posId])).rows:[];
  let detail:string;
  if(q.kind==='inventory')detail=`WITH ${paramsCte},${inventoryCte} SELECT jsonb_build_array(location_id,item_id)::text AS id,'${egyptDate()}'::text AS date,location_id AS "locationId",location_name AS "locationName",item_id AS "itemId",name,sku,category,unit,quantity::text,amount::text,unit_cost::text AS "unitCost",'balance'::text AS type,'رصيد حالي'::text AS reference,''::text AS "supplierId",''::text AS "supplierName",''::text AS "kitchenId",''::text AS "kitchenName" FROM inv`;
  else if(q.kind==='sales')detail=`WITH ${paramsCte},${salesCte} SELECT line_id::text AS id,business_date::text AS date,location_id AS "locationId",location_name AS "locationName",menu_item_id::text AS "itemId",payload->>'menuName' AS name,payload->>'menuCode' AS sku,''::text AS category,'وحدة بيع'::text AS unit,payload->>'quantity' AS quantity,payload->>'netAmount' AS amount,NULL::text AS "unitCost",'sale'::text AS type,transaction_id AS reference,''::text AS "supplierId",''::text AS "supplierName",COALESCE(routing->>'kitchenId','') AS "kitchenId",COALESCE(routing->>'kitchenName','') AS "kitchenName",COALESCE(routing->>'posId','') AS "posId",COALESCE(routing->>'posName','') AS "posName",payload->>'versionId' AS version,payload->>'outputPerSale' AS output FROM sd WHERE business_date BETWEEN $2::date AND $3::date`;
  else if(q.kind==='production')detail=`WITH ${paramsCte},${productionCte} SELECT operation_id::text AS id,payload->>'businessDate' AS date,output_location_id AS "locationId",location_name AS "locationName",output_item_id AS "itemId",name,sku,category,unit,payload->>'actualOutput' AS quantity,result->>'inputAmount' AS amount,result->>'unitCost' AS "unitCost",'production'::text AS type,payload->>'reference' AS reference,''::text AS "supplierId",''::text AS "supplierName",''::text AS "kitchenId",''::text AS "kitchenName",COALESCE(result->>'attainment','') AS extra FROM p WHERE (payload->>'businessDate')::date BETWEEN $2::date AND $3::date`;
  else detail=`WITH ${paramsCte},${movementSql} SELECT ${(q.kind==='kitchens'||q.kind==='kitchenSupply')?rowColumns.replace('quantity::text,amount::text','abs(quantity)::text AS quantity,abs(amount)::text AS amount'):q.kind==='waste'?rowColumns.replace('quantity::text,amount::text',"CASE WHEN type='waste.post' THEN abs(quantity) ELSE quantity END::text AS quantity,CASE WHEN type='waste.post' THEN abs(amount) ELSE amount END::text AS amount"):rowColumns} FROM m WHERE business_date BETWEEN $2::date AND $3::date AND ${kindTypes[q.kind]??'true'}`;
  if(q.kind==='kitchenSupply')detail=detail.replace('SELECT operation_id::text AS id', 'SELECT kitchen_issue_id::text AS "documentId",operation_id::text AS id');
  const total=Number((await tx.query<{count:string}>(`SELECT count(*)::text AS count FROM (${detail}) records`,params)).rows[0].count),page=Math.min(q.page,Math.max(1,Math.ceil(total/q.pageSize)));
  const rows=(await tx.query<ReportRow&{version?:string;output?:string}>(`SELECT * FROM (${detail}) records ORDER BY ${order[q.sort]} LIMIT $11 OFFSET $12`,[...params,q.pageSize,(page-1)*q.pageSize])).rows;
  for(const row of rows)if(q.kind==='sales'){row.estimatedCost=estimate({versionId:row.version!,outputPerSale:row.output!,quantity:row.quantity},row.locationId);delete row.version;delete row.output;}
  return {schemaVersion:1,organizationId:org,generation:organization.generation,checkpoint,generatedAt:new Date().toISOString(),query:q,previousRange,current,previous,stock:{value:stockRow.value,items:Number(stockRow.items),low:Number(stockRow.low)},charts:{daily,inventory,kitchens,kitchenSupply,suppliers,waste,sales,production},shortages,rows,total,page};
 });
}
