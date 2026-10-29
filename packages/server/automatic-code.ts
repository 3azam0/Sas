import type {QueryDatabase} from './database';
import {BusinessError} from '@saas/contracts';

// Call only after the organization's FOR UPDATE lock, inside the same transaction
// as the record insert. Existing stored codes are the source of truth, so this
// needs no new table and never changes imported or historical identifiers.
export async function nextAutomaticCode(tx:QueryDatabase,org:string,kind:'material'|'recipe'|'production'|'central'){
 const prefix={material:'MAT',recipe:'REC',production:'PROD',central:'PROD'}[kind];
 const production="SELECT payload->>'reference' AS code FROM production_batches WHERE organization_id=$1 UNION ALL SELECT reference AS code FROM central_batches WHERE organization_id=$1";
 const sql={material:'SELECT sku AS code FROM items WHERE organization_id=$1',recipe:'SELECT code FROM recipes WHERE organization_id=$1',production,central:production}[kind];
 const rows=(await tx.query<{code:string}>(sql,[org])).rows;
 const pattern=new RegExp(`^${prefix}-([0-9]+)$`);let maximum=0n;
 for(const row of rows){const match=row.code?.match(pattern);if(match){const n=BigInt(match[1]);if(n>maximum)maximum=n;}}
 if(maximum>=999999999999n)throw new BusinessError('REFERENCE_LIMIT','وصل تسلسل الأكواد إلى الحد المسموح.');
 return `${prefix}-${String(maximum+1n).padStart(6,'0')}`;
}
