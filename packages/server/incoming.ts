import type {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {decimal} from '@saas/domain';

// Receipt and opening posting share the same positive ledger/layer/balance effects.
export async function addIncomingStock(tx:Pick<PGlite,'query'>,input:{organizationId:string;operationId:string;locationId:string;itemId:string;quantity:string;unitCost:string;type:string;reason:string;businessDate:string;openingDocumentId?:string}){
 const c=input,amount=decimal(c.quantity).mul(c.unitCost).toFixed(12);
 const entry=await tx.query<{sequence:string}>('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,opening_document_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING sequence',[c.organizationId,c.operationId,c.locationId,c.itemId,c.quantity,amount,c.type,c.reason,c.businessDate,c.openingDocumentId??null]);
 await tx.query('INSERT INTO cost_layers VALUES($1,$2,$3,$4,$5,$6,$7)',[c.organizationId,randomUUID(),c.locationId,c.itemId,c.quantity,c.unitCost,entry.rows[0].sequence]);
 await tx.query('INSERT INTO stock_balances VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,location_id,item_id) DO UPDATE SET quantity=stock_balances.quantity+EXCLUDED.quantity,value=stock_balances.value+EXCLUDED.value',[c.organizationId,c.locationId,c.itemId,c.quantity,amount]);
 return amount;
}
