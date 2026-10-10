import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {createDatabase,seed,postReceiptDocument,postCommand,getSnapshot,reconcileStock} from '@saas/server';
import {receiptDocumentSchema,type ReceiptDocument,type Access} from '@saas/contracts';
let db:PGlite;
const access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
const doc=():ReceiptDocument=>({operationId:randomUUID(),organizationId:'grills',locationId:'central',type:'receipt.document',businessDate:'2026-10-09',reason:'استلام عدة مواد',capturedAt:new Date().toISOString(),schemaVersion:1,currency:'EGP',lines:[{lineId:randomUUID(),itemId:'rice',unitId:'كجم',quantity:'2',unitCost:'20'},{lineId:randomUUID(),itemId:'beef',unitId:'كجم',quantity:'1',unitCost:'100'}]});
beforeAll(async()=>{db=await createDatabase();await seed(db);});afterAll(async()=>db.close());
it('posts a complete receipt with pooled valuation, immutable document/line links and actor audit',async()=>{
 const d=doc(),before=await getSnapshot(db,access);expect((await postReceiptDocument(db,access,d)).amount).toBe('140.000000000000');const s=await getSnapshot(db,access);
 expect(s.receipts?.find(r=>r.document.operationId===d.operationId)?.document).toEqual(d);expect(s.entries.filter(e=>e.receiptDocumentId===d.operationId)).toHaveLength(2);
 const b=s.balances.find(b=>b.itemId==='rice'&&b.locationId==='central')!,old=before.balances.find(b=>b.itemId==='rice'&&b.locationId==='central')!;expect(Number(b.quantity)-Number(old.quantity)).toBe(2);expect(Number(b.value)-Number(old.value)).toBe(40);
 expect((await db.query<{actor:string}>('SELECT actor FROM audit_events WHERE operation_id=$1',[d.operationId])).rows[0].actor).toBe('owner');expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);
});
it('deduplicates concurrent delivery and rejects changed payload and line ID reuse',async()=>{
 const d=doc(),results=await Promise.all([postReceiptDocument(db,access,d),postReceiptDocument(db,access,d)]);expect(results[0]).toEqual(results[1]);expect((await getSnapshot(db,access)).entries.filter(e=>e.receiptDocumentId===d.operationId)).toHaveLength(2);
 await expect(postReceiptDocument(db,access,{...d,reason:'changed'})).rejects.toMatchObject({code:'PAYLOAD_CONFLICT'});
 await expect(postCommand(db,access,{...d,...d.lines[0],operationId:d.lines[0].lineId,type:'receipt.post'})).rejects.toMatchObject({code:'PAYLOAD_CONFLICT'});
});
it('rejects later invalid lines without any document, balance, layer or deduplication changes',async()=>{
 const d=doc(),before=await getSnapshot(db,access);d.lines[1].unitId='لتر';await expect(postReceiptDocument(db,access,d)).rejects.toMatchObject({code:'INVALID_UNIT'});const after=await getSnapshot(db,access);expect(after.balances).toEqual(before.balances);expect(after.layers).toEqual(before.layers);expect(after.acceptedOperationIds).toEqual(before.acceptedOperationIds);expect(after.receipts).toEqual(before.receipts);
});
it('validates tenant, generation, inactive references, dates and bounded distinct lines',async()=>{
 const d=doc();await expect(postReceiptDocument(db,{...access,organizationId:'bistro'},d)).rejects.toMatchObject({code:'FORBIDDEN'});await expect(postReceiptDocument(db,access,{...d,generation:randomUUID()})).rejects.toMatchObject({code:'STALE_GENERATION'});await expect(postReceiptDocument(db,{...access,expiresAt:'bad'},d)).rejects.toMatchObject({code:'FORBIDDEN'});await expect(postReceiptDocument(db,access,{...d,businessDate:'2099-01-01'})).rejects.toMatchObject({code:'FUTURE_DATE'});await expect(postReceiptDocument(db,access,{...d,supplierId:'missing'})).rejects.toMatchObject({code:'INVALID_SUPPLIER'});
 expect(receiptDocumentSchema.safeParse({...d,lines:[d.lines[0],{...d.lines[0],lineId:randomUUID()}]}).success).toBe(false);expect(receiptDocumentSchema.safeParse({...d,lines:[]}).success).toBe(false);expect(receiptDocumentSchema.safeParse({...d,lines:Array.from({length:201},()=>({...d.lines[0],lineId:randomUUID(),itemId:randomUUID()}))}).success).toBe(false);
 await db.query("UPDATE items SET active=false WHERE organization_id='grills' AND id='beef'");await expect(postReceiptDocument(db,access,d)).rejects.toMatchObject({code:'INACTIVE_RECORD'});await db.query("UPDATE items SET active=true WHERE organization_id='grills' AND id='beef'");
});
it('checks pack conversion, persists supplier/entered quantity and supports FIFO',async()=>{
 const pack=randomUUID();await db.query("UPDATE items SET purchase_units=$1 WHERE organization_id='grills' AND id='rice'",[JSON.stringify([{id:pack,name:'شكارة',factor:'5'}])]);await db.query("INSERT INTO suppliers VALUES('grills','supplier','Supplier','','','',true,1)");const d=doc();d.supplierId='supplier';Object.assign(d.lines[0],{purchaseUnitId:pack,enteredQuantity:'2',quantity:'10'});
 await postReceiptDocument(db,access,d);const s=await getSnapshot(db,access);expect(s.entries.find(e=>e.operationId===d.lines[0].lineId)).toMatchObject({supplierId:'supplier',purchaseUnitId:pack,enteredQuantity:'2.000000'});
 await expect(postReceiptDocument(db,access,{...doc(),lines:[{...d.lines[0],lineId:randomUUID(),quantity:'9'}]})).rejects.toMatchObject({code:'INVALID_CONVERSION'});
 await db.query("UPDATE organizations SET costing_method='fifo' WHERE id='bistro'");await postReceiptDocument(db,{...access,organizationId:'bistro'},{...doc(),organizationId:'bistro'});expect((await reconcileStock(db,'bistro')).every(r=>r.matches)).toBe(true);
});
