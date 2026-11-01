import type {ReportQuery,ReportResponse,ReportRow,PeriodMetrics,StockCardSummary,ButcheryModeSummary,ReportRank} from '@saas/contracts';
import {decimal} from '@saas/domain';
import type {QueryDatabase} from './database';
import {previousReportRange} from '../domain/reporting';

const zero:PeriodMetrics={received:'0',reversed:'0',returned:'0',returnReference:'0',netReceived:'0',kitchen:'0',waste:'0',countIncrease:'0',countDecrease:'0',sales:'0',salesDeduction:'0',productionInput:'0',productionWaste:'0',estimatedSalesCost:null,estimatedMargin:null,foodCostPercent:null};
const charts={daily:[],inventory:[],kitchens:[],suppliers:[],waste:[],sales:[],production:[]};
const ratio=(a:string,b:string,percent=true)=>decimal(b).isZero()?null:decimal(a).div(b).mul(percent?100:1).toString();
const order:Record<ReportQuery['sort'],string>={date_asc:'date ASC,sequence ASC',date_desc:'date DESC,sequence DESC',amount_asc:'amount::numeric ASC,sequence ASC',amount_desc:'amount::numeric DESC,sequence ASC',name_asc:'name ASC,sequence ASC',name_desc:'name DESC,sequence ASC',quantity_asc:'quantity::numeric ASC,sequence ASC',quantity_desc:'quantity::numeric DESC,sequence ASC'};
function base(q:ReportQuery,generation:string,checkpoint:string):ReportResponse{return {schemaVersion:1,organizationId:q.organizationId,generation,checkpoint,generatedAt:new Date().toISOString(),query:q,previousRange:previousReportRange(q.from,q.to),current:{...zero},previous:{...zero},stock:{value:'0',items:0,low:0},charts:{...charts},rows:[],total:0,page:1};}

/** Ledger quantities by business date; never reconstructs or rewrites historical FIFO. */
export async function stockCardReport(tx:QueryDatabase,q:ReportQuery,generation:string,checkpoint:string):Promise<ReportResponse>{
 const response=base(q,generation,checkpoint);if(!q.itemId)return response;
 const args=[q.organizationId,q.from,q.to,q.locationId,q.category,q.itemId,q.search];
 const item=(await tx.query<{name:string;sku:string;unit:string}>(`SELECT i.name,i.sku,COALESCE(u.name,i.unit) AS unit FROM items i LEFT JOIN units u ON u.organization_id=i.organization_id AND u.id=i.unit_id WHERE i.organization_id=$1 AND i.id=$2 AND ($3='' OR i.category=$3)`,[q.organizationId,q.itemId,q.category])).rows[0];
 if(!item)return response;
 const balances=(await tx.query<StockCardSummary['balances'][number]>(`SELECT l.id AS "locationId",l.name AS "locationName",$7::text AS unit,
  COALESCE(sum(e.quantity) FILTER(WHERE e.business_date<$2::date),0)::text AS opening,
  COALESCE(sum(e.quantity) FILTER(WHERE e.business_date BETWEEN $2::date AND $3::date AND e.quantity>0),0)::text AS incoming,
  COALESCE(sum(-e.quantity) FILTER(WHERE e.business_date BETWEEN $2::date AND $3::date AND e.quantity<0),0)::text AS outgoing,
  COALESCE(sum(e.quantity),0)::text AS closing
  FROM locations l LEFT JOIN stock_entries e ON e.organization_id=l.organization_id AND e.location_id=l.id AND e.item_id=$6 AND e.business_date<=$3::date
  WHERE l.organization_id=$1 AND ($4='' OR l.id=$4) AND ($5='' OR EXISTS(SELECT 1 FROM items i WHERE i.organization_id=l.organization_id AND i.id=$6 AND i.category=$5)) GROUP BY l.id,l.name ORDER BY l.name,l.id`,[...args.slice(0,6),item.unit])).rows;
 response.stockCard={itemId:q.itemId,...item,balances};
 // Search is deliberately applied after the full running balance is calculated.
 const cte=`WITH history AS(SELECT e.*,l.name AS location_name,i.name,i.sku,i.category,COALESCE(u.name,i.unit) AS unit,
  sum(e.quantity) OVER(PARTITION BY e.location_id,e.item_id ORDER BY e.business_date,e.sequence ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running
  FROM stock_entries e JOIN locations l ON l.organization_id=e.organization_id AND l.id=e.location_id JOIN items i ON i.organization_id=e.organization_id AND i.id=e.item_id LEFT JOIN units u ON u.organization_id=i.organization_id AND u.id=i.unit_id
  WHERE e.organization_id=$1 AND e.business_date<=$3::date AND ($4='' OR e.location_id=$4) AND ($5='' OR i.category=$5) AND e.item_id=$6),period AS(SELECT * FROM history WHERE business_date>=$2::date AND ($7='' OR strpos(lower(reason||' '||operation_id::text||' '||location_name||' '||name||' '||sku),lower($7))>0))`;
 response.total=Number((await tx.query<{count:string}>(`${cte} SELECT count(*)::text AS count FROM period`,args)).rows[0].count);response.page=Math.min(q.page,Math.max(1,Math.ceil(response.total/q.pageSize)));
 response.rows=(await tx.query<ReportRow>(`${cte} SELECT operation_id::text AS id,business_date::text AS date,location_id AS "locationId",location_name AS "locationName",item_id AS "itemId",name,sku,category,unit,quantity::text,amount::text,CASE WHEN quantity<>0 THEN abs(amount/quantity)::text ELSE NULL END AS "unitCost",type,reason AS reference,''::text AS "supplierId",''::text AS "supplierName",''::text AS "kitchenId",''::text AS "kitchenName",
  jsonb_build_object('sequence',sequence::text,'before',(running-quantity)::text,'running',running::text,'incoming',greatest(quantity,0)::text,'outgoing',greatest(-quantity,0)::text) AS "stockCard"
  FROM period ORDER BY ${order[q.sort]} LIMIT $8 OFFSET $9`,[...args,q.pageSize,(response.page-1)*q.pageSize])).rows;
 return response;
}

const butcheryCte=`WITH batches AS(SELECT b.operation_id,b.payload,b.result,l.id AS location_id,l.name AS location_name,i.id AS item_id,i.name,i.sku,i.category,COALESCE(u.name,i.unit) AS unit,
 COALESCE((SELECT sum((o->>'quantity')::numeric) FROM jsonb_array_elements(b.result->'outputs') o),0) AS output_weight
 FROM butchery_batches b JOIN locations l ON l.organization_id=b.organization_id AND l.id=b.payload->>'locationId' JOIN items i ON i.organization_id=b.organization_id AND i.id=b.payload->>'itemId' LEFT JOIN units u ON u.organization_id=i.organization_id AND u.id=i.unit_id
 WHERE b.organization_id=$1 AND b.payload->>'type'='butchery.process' AND (b.payload->>'businessDate')::date BETWEEN $2::date AND $3::date AND ($4='' OR l.id=$4) AND ($5='' OR i.category=$5) AND ($6='' OR i.id=$6) AND ($8='' OR b.payload->>'mode'=$8)
 AND ($7='' OR strpos(lower(i.name||' '||i.sku||' '||(b.payload->>'reason')),lower($7))>0 OR strpos(lower(b.operation_id::text),lower($7))>0
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(b.result->'outputs') o JOIN items oi ON oi.organization_id=b.organization_id AND oi.id=o->>'itemId' WHERE strpos(lower(oi.name||' '||oi.sku),lower($7))>0)))`;

export async function butcheryReport(tx:QueryDatabase,q:ReportQuery,generation:string,checkpoint:string):Promise<ReportResponse>{
 const response=base(q,generation,checkpoint),args=[q.organizationId,q.from,q.to,q.locationId,q.category,q.itemId,q.search,q.butcheryMode??''];
 async function summary(from:string,to:string):Promise<ButcheryModeSummary[]>{
  const params=[...args];params[1]=from;params[2]=to;
  const rows=(await tx.query<ButcheryModeSummary>(`${butcheryCte} SELECT payload->>'mode' AS mode,count(*)::int AS batches,COALESCE(sum((payload->>'headCount')::int),0)::int AS "headCount",sum((payload->>'quantity')::numeric)::text AS "inputWeight",COALESCE(sum((payload->>'carcassWeight')::numeric),0)::text AS "carcassWeight",sum((payload->>'slaughterLoss')::numeric)::text AS "slaughterLoss",sum((payload->>'cuttingLoss')::numeric)::text AS "cuttingLoss",sum(output_weight)::text AS "outputWeight",sum((result->>'inputAmount')::numeric)::text AS "inputCost",sum((payload->>'processingCost')::numeric)::text AS "processingCost",sum((result->>'amount')::numeric)::text AS "totalCost" FROM batches GROUP BY payload->>'mode'`,params)).rows;
  return (['beef','lamb'] as const).map(mode=>{
   const row=rows.find(r=>r.mode===mode)??{mode,batches:0,headCount:0,inputWeight:'0',carcassWeight:'0',slaughterLoss:'0',cuttingLoss:'0',outputWeight:'0',inputCost:'0',processingCost:'0',totalCost:'0'};
   return {...row,yieldPercent:ratio(row.outputWeight,row.inputWeight),carcassYieldPercent:mode==='lamb'?ratio(row.carcassWeight,row.inputWeight):null,cuttingYieldPercent:ratio(row.outputWeight,mode==='lamb'?row.carcassWeight:row.inputWeight),unitCost:ratio(row.totalCost,row.outputWeight,false)};
  });
 }
 const current=await summary(q.from,q.to),previous=await summary(response.previousRange.from,response.previousRange.to);
 const ranks=(await tx.query<ReportRank>(`${butcheryCte} SELECT item_id AS key,name AS label,sum((result->>'amount')::numeric)::text AS value FROM batches GROUP BY item_id,name ORDER BY sum((result->>'amount')::numeric) DESC,item_id LIMIT 10`,args)).rows;
 response.butchery={current,previous,ranks};response.total=Number((await tx.query<{count:string}>(`${butcheryCte} SELECT count(*)::text AS count FROM batches`,args)).rows[0].count);response.page=Math.min(q.page,Math.max(1,Math.ceil(response.total/q.pageSize)));
 const sort:Record<ReportQuery['sort'],string>={date_asc:'date ASC,id',date_desc:'date DESC,id',amount_asc:'amount::numeric ASC,id',amount_desc:'amount::numeric DESC,id',name_asc:'name ASC,id',name_desc:'name DESC,id',quantity_asc:'quantity::numeric ASC,id',quantity_desc:'quantity::numeric DESC,id'};
 response.rows=(await tx.query<ReportRow>(`${butcheryCte},details AS(SELECT operation_id::text AS id,payload->>'businessDate' AS date,location_id AS "locationId",location_name AS "locationName",item_id AS "itemId",name,sku,category,unit,payload->>'quantity' AS quantity,result->>'amount' AS amount,((result->>'amount')::numeric/NULLIF(output_weight,0))::text AS "unitCost",'butchery.'||(payload->>'mode') AS type,payload->>'reason' AS reference,''::text AS "supplierId",''::text AS "supplierName",''::text AS "kitchenId",''::text AS "kitchenName",
 jsonb_build_object('mode',payload->>'mode','inputWeight',payload->>'quantity','headCount',(payload->>'headCount')::int,'carcassWeight',payload->>'carcassWeight','slaughterLoss',payload->>'slaughterLoss','cuttingLoss',payload->>'cuttingLoss','outputWeight',output_weight::text,'inputCost',result->>'inputAmount','processingCost',payload->>'processingCost',
 'yieldPercent',(100*output_weight/NULLIF((payload->>'quantity')::numeric,0))::text,'carcassYieldPercent',(100*(payload->>'carcassWeight')::numeric/NULLIF((payload->>'quantity')::numeric,0))::text,'cuttingYieldPercent',(100*output_weight/NULLIF(COALESCE((payload->>'carcassWeight')::numeric,(payload->>'quantity')::numeric),0))::text,
 'outputs',(SELECT jsonb_agg(jsonb_build_object('itemId',o->>'itemId','name',COALESCE(oi.name,o->>'itemId'),'sku',COALESCE(oi.sku,''),'quantity',o->>'quantity','costShare',o->>'costShare','amount',o->>'amount','unitCost',o->>'unitCost') ORDER BY ord) FROM jsonb_array_elements(result->'outputs') WITH ORDINALITY AS outputs(o,ord) LEFT JOIN items oi ON oi.organization_id=$1 AND oi.id=o->>'itemId')) AS butchery FROM batches)
 SELECT * FROM details ORDER BY ${sort[q.sort]} LIMIT $9 OFFSET $10`,[...args,q.pageSize,(response.page-1)*q.pageSize])).rows;
 return response;
}
