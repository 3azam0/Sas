import type {KitchenSupplyColumn,ReportQuery,ReportRow} from '@saas/contracts';
import type {QueryDatabase} from './database';
import {latestKitchenDocumentJoin} from './kitchen-revision-state';

type SupplyItem=Pick<ReportRow,'itemId'|'name'|'sku'|'category'|'unit'|'quantity'>&{
 unitId:string;cost:string|null;kitchenQuantities:Record<string,string>|null;kitchenCosts:Record<string,string|null>|null;
};
const orderBy:Partial<Record<ReportQuery['sort'],string>>={
 name_asc:'name ASC,item_id,unit_id',
 name_desc:'name DESC,item_id,unit_id',
 quantity_asc:'quantity ASC,name ASC,item_id,unit_id',
 quantity_desc:'quantity DESC,name ASC,item_id,unit_id'
};

export async function kitchenSupplyByItem(tx:QueryDatabase,q:ReportQuery){
 const order=orderBy[q.sort]??orderBy.name_asc;
 const [result]=(await tx.query<{rows:SupplyItem[];kitchens:KitchenSupplyColumn[];total:number;page:number;cost:string|null}>(`
  WITH effective AS (
   SELECT k.organization_id,k.operation_id,k.kitchen_id,COALESCE(latest.document,k.payload) AS document,
    COALESCE(latest.lines,k.lines) AS posted_lines,COALESCE(latest.revision,0) AS revision
   FROM kitchen_issues k
   ${latestKitchenDocumentJoin}
   WHERE k.organization_id=$1 AND NOT EXISTS(
    SELECT 1 FROM document_corrections dc
    WHERE dc.organization_id=k.organization_id AND dc.kind='kitchen' AND dc.source_id=k.operation_id
   )
  ), scoped AS (
   SELECT e.*,COALESCE(e.document->>'kitchenId',e.kitchen_id) AS receiving_id,
    COALESCE(NULLIF(e.document->>'kitchen',''),'مطبخ غير محدد') AS receiving_name
   FROM effective e
   WHERE (e.document->>'businessDate')::date BETWEEN $2::date AND $3::date
    AND ($4='' OR e.document->>'locationId'=$4 OR e.document->>'destinationLocationId'=$4)
  ), per_kitchen AS (
   SELECT i.id AS item_id,i.name,i.sku,i.category,line->>'unitId' AS unit_id,COALESCE(u.name,i.unit) AS unit,
    COALESCE('kitchen:'||e.receiving_id,'legacy:'||e.receiving_name) AS kitchen_key,MAX(e.receiving_name) AS kitchen_name,
    SUM(COALESCE(edit.quantity,(line->>'quantity')::numeric)) AS quantity,
    CASE WHEN COUNT(*)=COUNT(COALESCE(edit.amount,posted.amount)) THEN SUM(COALESCE(edit.amount,posted.amount)) END AS cost
   FROM scoped e
   CROSS JOIN LATERAL jsonb_array_elements(e.document->'lines') AS lines(line)
   JOIN items i ON i.organization_id=e.organization_id AND i.id=line->>'itemId'
   LEFT JOIN units u ON u.organization_id=e.organization_id AND u.id=line->>'unitId'
   LEFT JOIN LATERAL jsonb_to_recordset(e.posted_lines) AS posted("lineId" uuid,amount numeric)
    ON posted."lineId"=(line->>'lineId')::uuid
   LEFT JOIN LATERAL (
    SELECT quantity,amount FROM kitchen_quantity_revisions r
    WHERE r.organization_id=e.organization_id AND r.kitchen_issue_id=e.operation_id
     AND r.line_id=(line->>'lineId')::uuid AND r.revision>e.revision
    ORDER BY r.revision DESC LIMIT 1
   ) edit ON true
   WHERE ($5='' OR COALESCE(e.receiving_id,e.receiving_name)=$5)
    AND ($6='' OR i.category=$6) AND ($7='' OR i.id=$7)
    AND ($8='' OR strpos(lower(i.name||' '||i.sku),lower($8))>0)
   GROUP BY i.id,i.name,i.sku,i.category,line->>'unitId',u.name,i.unit,kitchen_key
  ), grouped AS (
   SELECT item_id,name,sku,category,unit_id,unit,SUM(quantity) AS quantity,
    CASE WHEN COUNT(*)=COUNT(cost) THEN SUM(cost) END AS cost,
    CASE WHEN $5='' THEN jsonb_object_agg(kitchen_key,quantity::text) END AS kitchen_quantities,
    CASE WHEN $5='' THEN jsonb_object_agg(kitchen_key,cost::text) END AS kitchen_costs
   FROM per_kitchen
   GROUP BY item_id,name,sku,category,unit_id,unit
  ), catalog AS (
   SELECT 'kitchen:'||id AS key,name AS label FROM kitchens WHERE organization_id=$1 AND $5=''
  ), kitchen_columns AS (
   SELECT key,label FROM catalog
   UNION ALL
   SELECT p.kitchen_key,MAX(p.kitchen_name)||' (سابق)'
   FROM per_kitchen p
   WHERE $5='' AND NOT EXISTS(SELECT 1 FROM catalog c WHERE c.key=p.kitchen_key)
   GROUP BY p.kitchen_key
  ), tally AS (
   SELECT count(*)::int AS total,GREATEST(1,LEAST($9::int,CEIL(count(*)::numeric/$10::int)::int)) AS page,
    CASE WHEN COUNT(*)=COUNT(cost) THEN COALESCE(SUM(cost),0)::text END AS cost
   FROM grouped
  ), paged AS (
   SELECT * FROM grouped ORDER BY ${order}
   LIMIT $10::int OFFSET (SELECT (page-1)*$10::int FROM tally)
  )
  SELECT total,page,cost,COALESCE((
   SELECT jsonb_agg(jsonb_build_object('itemId',item_id,'name',name,'sku',sku,'category',category,
    'unitId',unit_id,'unit',unit,'quantity',quantity::text,'cost',cost::text,
    'kitchenQuantities',kitchen_quantities,'kitchenCosts',kitchen_costs) ORDER BY ${order}) FROM paged
  ),'[]'::jsonb) AS rows,COALESCE((
   SELECT jsonb_agg(jsonb_build_object('key',key,'label',label) ORDER BY label,key) FROM kitchen_columns
  ),'[]'::jsonb) AS kitchens FROM tally`,
  [q.organizationId,q.from,q.to,q.locationId,q.kitchenId,q.category,q.itemId,q.search,q.page,q.pageSize])).rows;
 const rows=result.rows.map(({unitId,cost,kitchenQuantities,kitchenCosts,...item}):ReportRow=>({
  ...item,kitchenSupplyCost:cost,...(kitchenQuantities?{kitchenQuantities}:{}),...(kitchenCosts?{kitchenCosts}:{}),id:JSON.stringify([item.itemId,unitId]),date:q.to,locationId:'',locationName:'',
  amount:cost??'0',unitCost:null,type:'kitchen.supply.item',reference:'',supplierId:'',supplierName:'',kitchenId:'',kitchenName:''
 }));
 return {rows,total:result.total,page:result.page,kitchenSupplyKitchens:result.kitchens,cost:result.cost};
}
