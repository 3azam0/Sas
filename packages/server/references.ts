import type {Tx} from './valuation';

export type ReferencePrefix='MAT'|'PROD'|'REC'|'TRF'|'RCV'|'ISS'|'RTN'|'WST'|'CNT'|'REV'|'OP';
/** Called inside the posting transaction. Failed postings do not consume numbers. */
export async function assignReference(tx:Tx,org:string,kind:string,id:string,prefix:ReferencePrefix){
 const previous=await tx.query<{code:string}>('SELECT code FROM document_references WHERE organization_id=$1 AND entity_kind=$2 AND entity_id=$3',[org,kind,id]);
 if(previous.rows[0])return previous.rows[0].code;
 let floor='0';
 if(prefix==='MAT'){
  const existing=await tx.query<{maximum:string}>("SELECT COALESCE(max(CASE WHEN sku ~ '^MAT-[0-9]{1,12}$' THEN substring(sku from 5)::bigint ELSE 0 END),0)::text AS maximum FROM items WHERE organization_id=$1",[org]);floor=existing.rows[0].maximum;
 }
 const next=await tx.query<{number:string}>('INSERT INTO reference_counters(organization_id,prefix,last_number) VALUES($1,$2,$3::bigint+1) ON CONFLICT(organization_id,prefix) DO UPDATE SET last_number=greatest(reference_counters.last_number,$3::bigint)+1 RETURNING last_number::text AS number',[org,prefix,floor]);
 const code=`${prefix}-${next.rows[0].number.padStart(6,'0')}`;
 await tx.query('INSERT INTO document_references VALUES($1,$2,$3,$4)',[org,kind,id,code]);return code;
}
export function operationPrefix(type:string):ReferencePrefix{
 if(type==='butchery.process')return 'PROD';
 if(type==='transfer.dispatch')return 'TRF';
 if(type.endsWith('.receive')||type==='receipt.post')return 'RCV';
 if(type==='production.issue')return 'ISS';
 if(type==='production.return')return 'RTN';
 if(type==='inventory.count')return 'CNT';
 if(type==='production.reverse')return 'REV';
 if(type==='production.loss'||type==='waste.post')return 'WST';
 return 'OP';
}
export async function backfillReferences(tx:Tx){
 const batches=await tx.query<{organization_id:string;id:string;data:{reference?:string}}> ('SELECT organization_id,id,data FROM production_batches ORDER BY organization_id,data->>\'businessDate\',id');
 for(const b of batches.rows)if(!b.data.reference){const code=await assignReference(tx,b.organization_id,'batch',b.id,'PROD');await tx.query("UPDATE production_batches SET data=jsonb_set(data,'{reference}',to_jsonb($3::text)) WHERE organization_id=$1 AND id=$2",[b.organization_id,b.id,code]);}
 const documents=await tx.query<{organization_id:string;id:string;type:string}>('SELECT organization_id,id,command->>\'type\' AS type FROM workshop_documents ORDER BY organization_id,posted_at,id');
 for(const d of documents.rows)await assignReference(tx,d.organization_id,'operation',d.id,operationPrefix(d.type));
 const movements=await tx.query<{organization_id:string;operation_id:string;type:string}>('SELECT organization_id,operation_id,type FROM stock_entries WHERE type IN (\'receipt.post\',\'waste.post\',\'opening\') ORDER BY sequence');
 for(const m of movements.rows)await assignReference(tx,m.organization_id,'operation',m.operation_id,operationPrefix(m.type));
}
