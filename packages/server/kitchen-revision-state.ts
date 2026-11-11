import {type PostedKitchenIssue} from '@saas/contracts';
import {decimal} from '@saas/domain';
import type {QueryDatabase} from './database';

export const latestKitchenDocumentJoin=`LEFT JOIN LATERAL (
 SELECT document,lines,amount,revision FROM kitchen_document_revisions
 WHERE organization_id=k.organization_id AND kitchen_issue_id=k.operation_id ORDER BY revision DESC LIMIT 1
) latest ON true`;

export async function readKitchenIssues(tx:QueryDatabase,org:string,documentId?:string){
 const rows=(await tx.query<PostedKitchenIssue & {documentRevision:number}>(`
  SELECT COALESCE(latest.document,k.payload) AS document,COALESCE(latest.amount,k.amount)::text AS amount,
   k.method,COALESCE(latest.lines,k.lines) AS lines,k.actor,k.posted_at::text AS "postedAt",
   COALESCE(latest.revision,0) AS "documentRevision",
   COALESCE(q.history,'[]'::jsonb) AS "quantityRevisions",COALESCE(d.history,'[]'::jsonb) AS "documentRevisions"
  FROM (SELECT * FROM kitchen_issues WHERE organization_id=$1 ${documentId?'AND operation_id=$2':''}
   ORDER BY posted_at DESC LIMIT 100) k
  ${latestKitchenDocumentJoin}
  LEFT JOIN LATERAL (
   SELECT jsonb_agg(jsonb_build_object('revision',e.revision,'lineId',e.line_id,'operationId',e.operation_id,
    'previousQuantity',e.previous_quantity::text,'quantity',e.quantity::text,'amount',e.amount::text,
    'actor',e.actor,'reason',e.reason,'businessDate',e.business_date::text,'postedAt',e.posted_at::text)
    ORDER BY e.revision) AS history
   FROM kitchen_quantity_revisions e WHERE e.organization_id=k.organization_id AND e.kitchen_issue_id=k.operation_id
  ) q ON true
  LEFT JOIN LATERAL (
   SELECT jsonb_agg(jsonb_build_object('revision',e.revision,'operationId',e.operation_id,'changes',e.changes,
    'actor',e.actor,'reason',e.reason,'businessDate',e.business_date::text,'postedAt',e.posted_at::text)
    ORDER BY e.revision) AS history
   FROM kitchen_document_revisions e WHERE e.organization_id=k.organization_id AND e.kitchen_issue_id=k.operation_id
  ) d ON true ORDER BY k.posted_at DESC`,documentId?[org,documentId]:[org])).rows;
 return rows.map(({documentRevision,...row}):PostedKitchenIssue=>{
  const updates=(row.quantityRevisions??[]).filter(change=>change.revision>documentRevision);
  const revision=updates.at(-1)?.revision??documentRevision;
  if(!updates.length)return {...row,revision};
  const latest=new Map(updates.map(change=>[change.lineId,change]));
  const lines=row.lines.map(line=>{
   const change=latest.get(line.lineId);
   return change?{...line,quantity:change.quantity,amount:change.amount}:line;
  });
  return {...row,revision,lines,amount:lines.reduce((total,line)=>total.add(line.amount),decimal('0')).toFixed(12),
   document:{...row.document,lines:row.document.lines.map(line=>({...line,quantity:latest.get(line.lineId)?.quantity??line.quantity}))}};
 });
}
