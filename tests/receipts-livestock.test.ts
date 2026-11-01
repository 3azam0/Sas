import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {createDatabase,seed,postReceiptDocument,postButchery,getSnapshot,reconcileStock} from '@saas/server';
import {receiptDocumentSchema,type ReceiptDocument,type Access} from '@saas/contracts';

let db:PGlite;
const access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
const sheep=randomUUID();
const envelope=()=>({operationId:randomUUID(),organizationId:'grills',businessDate:'2026-10-26',reason:'استلام ضاني للمطبخ',capturedAt:new Date().toISOString(),schemaVersion:1 as const});
const receipt=():ReceiptDocument=>({...envelope(),locationId:'central',type:'receipt.document',schemaVersion:2,currency:'EGP',lines:[{lineId:randomUUID(),itemId:sheep,unitId:'كجم',quantity:'120',unitCost:'150',headCount:2},{lineId:randomUUID(),itemId:'beef',unitId:'كجم',quantity:'10',unitCost:'300'}]});
beforeAll(async()=>{db=await createDatabase();await seed(db);await postButchery(db,access,{...envelope(),type:'product.create',itemId:sheep,name:'ضاني حي باسم المستخدم',unitId:'كجم',meatKind:'sheep_live'});});
afterAll(async()=>db.close());

it('posts a mixed sheep and beef receipt in kilograms, retaining head counts on immutable history and duplicate delivery',async()=>{
 const d=receipt(),before=await getSnapshot(db,access);
 const first=await postReceiptDocument(db,access,d);expect(first.amount).toBe('21000.000000000000');
 expect(await postReceiptDocument(db,access,d)).toEqual(first);
 const after=await getSnapshot(db,access);
 expect(after.receipts!.find(r=>r.document.operationId===d.operationId)!.document).toEqual(d);
 expect(Number(after.balances.find(b=>b.itemId===sheep&&b.locationId==='central')!.quantity)-Number(before.balances.find(b=>b.itemId===sheep&&b.locationId==='central')?.quantity??0)).toBe(120);
 expect(after.entries.filter(e=>e.receiptDocumentId===d.operationId)).toHaveLength(2);
 expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);
 await expect(postReceiptDocument(db,access,{...d,lines:[{...d.lines[0],headCount:3},d.lines[1]]})).rejects.toMatchObject({code:'PAYLOAD_CONFLICT'});
});

it('rejects missing sheep counts, beef/non-sheep counts, wrong base units and out-of-range or fractional counts atomically',async()=>{
 const before=await getSnapshot(db,access);
 for(const headCount of [undefined,0,-1,1.5,100001])await expect(postReceiptDocument(db,access,{...receipt(),lines:[{...receipt().lines[0],headCount}]})).rejects.toMatchObject({code:headCount===undefined?'INVALID_LIVESTOCK':'INVALID_RECEIPT'});
 await expect(postReceiptDocument(db,access,{...receipt(),lines:[{...receipt().lines[1],headCount:1}]})).rejects.toMatchObject({code:'INVALID_LIVESTOCK'});
 // A similarly named classification in another tenant cannot authorize this item.
 await postButchery(db,{...access,organizationId:'bistro'},{...envelope(),organizationId:'bistro',type:'product.classify',itemId:'rice',meatKind:'sheep_live'});
 await expect(postReceiptDocument(db,access,{...receipt(),lines:[{...receipt().lines[0],itemId:'rice'}]})).rejects.toMatchObject({code:'INVALID_LIVESTOCK'});
 await db.query("UPDATE units SET name='رأس تجريبي' WHERE organization_id='grills' AND id='كجم'");
 try{await expect(postReceiptDocument(db,access,receipt())).rejects.toMatchObject({code:'INVALID_LIVESTOCK'});}finally{await db.query("UPDATE units SET name='كجم' WHERE organization_id='grills' AND id='كجم'");}
 const after=await getSnapshot(db,access);expect(after.balances).toEqual(before.balances);expect(after.entries).toEqual(before.entries);expect(after.receipts).toEqual(before.receipts);
});

it('accepts legacy queued sheep receipts without inventing counts and requires version 2 when counts are captured',async()=>{
 const d=receipt();d.schemaVersion=1;delete d.lines[0].headCount;
 expect(receiptDocumentSchema.parse(d)).toEqual(d);
 await postReceiptDocument(db,access,d);await postReceiptDocument(db,access,d);
 expect((await getSnapshot(db,access)).receipts!.find(r=>r.document.operationId===d.operationId)!.document.lines[0].headCount).toBeUndefined();
 expect(receiptDocumentSchema.safeParse({...receipt(),schemaVersion:1}).success).toBe(false);
});
