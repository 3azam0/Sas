import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {createDatabase,seed,postReceiptDocument,postCommand,getSnapshot,reconcileStock} from '@saas/server';
import {receiptDocumentSchema,type ReceiptDocument,type Access} from '@saas/contracts';
let db:PGlite;
const access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
const doc=():ReceiptDocument=>({operationId:randomUUID(),organizationId:'grills',locationId:'central',type:'receipt.document',businessDate:'2026-10-09',reason:'استلام عدة مواد',capturedAt:new Date().toISOString(),schemaVersion:1,currency:'EGP',lines:[{lineId:randomUUID(),itemId:'rice',unitId:'كجم',quantity:'2',unitCost:'20'},{lineId:randomUUID(),itemId:'beef',unitId:'كجم',quantity:'1',unitCost:'100'}]});
it('allows empty or omitted receipt references while preserving older payloads and limits',()=>{
 const d=doc();expect(JSON.stringify(receiptDocumentSchema.parse(d))).toBe(JSON.stringify(d));
 for(const reason of ['',undefined,'   '])expect(receiptDocumentSchema.parse({...d,reason}).reason).toBe('');
 for(const reason of ['x',' x ',null,'a'.repeat(201)])expect(receiptDocumentSchema.safeParse({...d,reason}).success).toBe(false);
 expect(receiptDocumentSchema.parse({...d,reason:'a'.repeat(200)}).reason).toHaveLength(200);
});
beforeAll(async()=>{db=await createDatabase();await seed(db);});afterAll(async()=>db.close());
it('posts receipts without a reference once, retaining document IDs, audit and readable stock history',async()=>{
 const d={...doc(),reason:''};await postReceiptDocument(db,access,d);await postReceiptDocument(db,access,d);
 const s=await getSnapshot(db,access),entries=s.entries.filter(entry=>entry.receiptDocumentId===d.operationId);
 expect(entries).toHaveLength(2);expect(entries.every(entry=>entry.reason==='استلام مواد')).toBe(true);
 expect(s.receipts?.find(receipt=>receipt.document.operationId===d.operationId)?.document.reason).toBe('');
 expect((await db.query<{actor:string}>('SELECT actor FROM audit_events WHERE operation_id=$1',[d.operationId])).rows[0].actor).toBe('owner');
 await expect(postReceiptDocument(db,access,{...d,reason:'new reference'})).rejects.toMatchObject({code:'PAYLOAD_CONFLICT'});
 expect((await reconcileStock(db,'grills')).every(row=>row.matches)).toBe(true);
});
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
it('posts catalog units with standard and explicit conversions, retaining history and exact base-unit value',async()=>{
 await db.query("INSERT INTO units VALUES('grills','grams','جرام',1),('grills','pieces','عدد',1),('bistro','foreign-unit','وحدة أجنبية',1)");
 const d=doc(),before=await getSnapshot(db,access);
 Object.assign(d.lines[0],{quantity:'0.75',enteredQuantity:'750',receivingUnit:{unitId:'grams',name:'جرام',baseName:'كجم',factor:'0.001'}});
 Object.assign(d.lines[1],{quantity:'10',enteredQuantity:'2',receivingUnit:{unitId:'pieces',name:'عدد',baseName:'كجم',factor:'5'}});
 expect((await postReceiptDocument(db,access,d)).amount).toBe('1015.000000000000');
 const s=await getSnapshot(db,access);
 expect(s.receipts?.find(r=>r.document.operationId===d.operationId)?.document).toEqual(d);
 expect(Number(s.balances.find(b=>b.itemId==='rice'&&b.locationId==='central')!.quantity)-Number(before.balances.find(b=>b.itemId==='rice'&&b.locationId==='central')!.quantity)).toBe(0.75);
 expect(s.entries.find(e=>e.operationId===d.lines[0].lineId)).toMatchObject({quantity:'0.750000',amount:'15.000000000000',enteredQuantity:'750.000000',purchaseUnitId:null});
 await postReceiptDocument(db,access,d);expect((await getSnapshot(db,access)).entries.filter(e=>e.receiptDocumentId===d.operationId)).toHaveLength(2);
 expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);
});
it('atomically rejects false conversions, foreign units, stale names and excessive fractional precision',async()=>{
 const before=await getSnapshot(db,access);
 const badLine=(changes:Record<string,unknown>)=>({...doc().lines[1],quantity:'1',enteredQuantity:'1000',receivingUnit:{unitId:'grams',name:'جرام',baseName:'كجم',factor:'0.001'},...changes});
 for(const [line,code] of [
  [badLine({quantity:'2',receivingUnit:{unitId:'grams',name:'جرام',baseName:'كجم',factor:'0.002'}}),'INVALID_CONVERSION'],
  [badLine({quantity:'0.9'}),'INVALID_CONVERSION'],
  [badLine({receivingUnit:{unitId:'foreign-unit',name:'وحدة أجنبية',baseName:'كجم',factor:'0.001'}}),'INVALID_UNIT'],
  [badLine({receivingUnit:{unitId:'grams',name:'جرام قديم',baseName:'كجم',factor:'0.001'}}),'INVALID_UNIT'],
  [badLine({quantity:'0.000001',enteredQuantity:'0.0001'}),'INVALID_CONVERSION']
 ] as const){await expect(postReceiptDocument(db,access,{...doc(),lines:[doc().lines[0],line]})).rejects.toMatchObject({code});}
 const after=await getSnapshot(db,access);expect(after.balances).toEqual(before.balances);expect(after.layers).toEqual(before.layers);expect(after.acceptedOperationIds).toEqual(before.acceptedOperationIds);expect(after.receipts).toEqual(before.receipts);
});
it('rejects incomplete, zero-factor and simultaneous pack/catalog-unit metadata',()=>{
 const d=doc(),receivingUnit={unitId:'grams',name:'جرام',baseName:'كجم',factor:'0.001'};
 for(const changes of [{receivingUnit},{enteredQuantity:'2'},{receivingUnit:{...receivingUnit,factor:'0'},enteredQuantity:'2'},{receivingUnit,enteredQuantity:'2',purchaseUnitId:randomUUID()}]){
  expect(receiptDocumentSchema.safeParse({...d,lines:[{...d.lines[0],...changes}]}).success).toBe(false);
 }
});
