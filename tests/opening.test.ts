import {beforeAll,afterAll,it,expect} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {createDatabase,seed,postOpening,postCommand,postSetupCommand,getSnapshot} from '@saas/server';
import {openingSchema,type Access,type OpeningDocument,type Command} from '@saas/contracts';
import {schema} from '../packages/server/schema';
let db:PGlite;
const now=()=>new Date().toISOString();
const access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
async function fixture(){const locationId=randomUUID();await postSetupCommand(db,access,{operationId:randomUUID(),organizationId:'grills',type:'location.save',expectedRevision:0,capturedAt:now(),schemaVersion:1,record:{id:locationId,name:'فرع افتتاحي',kind:'مطعم',active:true}});return locationId;}
function document(locationId:string,extra:Partial<OpeningDocument>={}):OpeningDocument{return {operationId:randomUUID(),organizationId:'grills',locationId,type:'opening.post',businessDate:'2026-10-09',reason:'رصيد أول المدة',capturedAt:now(),schemaVersion:1,currency:'EGP',lines:[{lineId:randomUUID(),itemId:'beef',unitId:'كجم',quantity:'10',unitCost:'20'}],...extra};}
function stock(locationId:string,type:Command['type']='waste.post',quantity='2'):Command{return{operationId:randomUUID(),organizationId:'grills',locationId,itemId:'beef',type,quantity,unitCost:type==='receipt.post'?'99':undefined,businessDate:'2026-10-09',reason:'اختبار حركة',capturedAt:now(),schemaVersion:1};}
beforeAll(async()=>{db=await createDatabase();await seed(db,'fifo');});afterAll(async()=>{await db.close();});
it('posts a multi-line baseline atomically with layers, document history and actor audit',async()=>{
 const site=await fixture(),doc=document(site);doc.lines.push({lineId:randomUUID(),itemId:'rice',unitId:'كجم',quantity:'3',unitCost:'0'});
 expect((await postOpening(db,access,doc)).amount).toBe('200.000000000000');
 const snapshot=await getSnapshot(db,access);expect(snapshot.balances.filter(b=>b.locationId===site).map(b=>[b.quantity,b.value])).toEqual([['10.000000','200.000000000000'],['3.000000','0.000000000000']]);
 expect(snapshot.openings?.find(d=>d.document.operationId===doc.operationId)?.document).toEqual(doc);
 expect(snapshot.entries.filter(e=>e.locationId===site)).toHaveLength(2);expect(snapshot.layers.filter(l=>l.locationId===site)).toHaveLength(2);
 expect((await db.query<{actor:string}>('SELECT actor FROM audit_events WHERE operation_id=$1',[doc.operationId])).rows[0].actor).toBe('owner');
 await db.exec(schema);expect((await getSnapshot(db,access)).openings?.some(d=>d.document.operationId===doc.operationId)).toBe(true);
});
it('deduplicates concurrent same-ID delivery and rejects changed payload or line-ID reuse',async()=>{
 const site=await fixture(),doc=document(site);const results=await Promise.all([postOpening(db,access,doc),postOpening(db,access,doc)]);expect(results[0]).toEqual(results[1]);
 expect((await getSnapshot(db,access)).entries.filter(e=>e.locationId===site)).toHaveLength(1);
 await expect(postOpening(db,access,{...doc,reason:'بيانات مختلفة'})).rejects.toMatchObject({code:'PAYLOAD_CONFLICT'});
 await expect(postCommand(db,access,{...stock(site,'receipt.post'),operationId:doc.lines[0].lineId})).rejects.toMatchObject({code:'PAYLOAD_CONFLICT'});
});
it('rejects concurrent competing baselines and never treats consumed zero stock as pristine',async()=>{
 const site=await fixture();const results=await Promise.allSettled([postOpening(db,access,document(site)),postOpening(db,access,document(site))]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 await postCommand(db,access,stock(site,'waste.post','10'));await expect(postOpening(db,access,document(site))).rejects.toMatchObject({code:'OPENING_EXISTS'});
 expect((await getSnapshot(db,access)).balances.find(b=>b.locationId===site)?.quantity).toBe('0.000000');
 await expect(postOpening(db,access,document('central'))).rejects.toMatchObject({code:'OPENING_EXISTS'});
});
it('rejects a whole document when a later line fails with no partial document or stock effects',async()=>{
 const site=await fixture(),doc=document(site);doc.lines.push({lineId:randomUUID(),itemId:'unknown',unitId:'كجم',quantity:'1',unitCost:'2'});
 await expect(postOpening(db,access,doc)).rejects.toMatchObject({code:'INVALID_REFERENCE'});
 const s=await getSnapshot(db,access);expect(s.balances.filter(b=>b.locationId===site)).toHaveLength(0);expect(s.openings?.find(d=>d.document.operationId===doc.operationId)).toBeUndefined();expect(s.acceptedOperationIds).not.toContain(doc.operationId);
});
it('validates dates, duplicate materials, units, quantities, tenant and access before accepting',async()=>{
 const site=await fixture(),doc=document(site);
 await expect(postOpening(db,access,{...doc,businessDate:'2099-01-01'})).rejects.toMatchObject({code:'FUTURE_DATE'});
 expect(openingSchema.safeParse({...doc,lines:[...doc.lines,{...doc.lines[0],lineId:randomUUID()}]}).success).toBe(false);
 await expect(postOpening(db,access,{...doc,lines:[{...doc.lines[0],unitId:'لتر'}]})).rejects.toMatchObject({code:'INVALID_UNIT'});
 await expect(postOpening(db,access,{...doc,lines:[{...doc.lines[0],unitCost:'-1'}]})).rejects.toMatchObject({code:'INVALID_OPENING'});
 await expect(postOpening(db,{...access,organizationId:'bistro'},doc)).rejects.toMatchObject({code:'FORBIDDEN'});
 await expect(postOpening(db,{...access,expiresAt:'invalid'},doc)).rejects.toMatchObject({code:'FORBIDDEN'});
 await expect(postOpening(db,{...access,expiresAt:'2000-01-01T00:00:00Z'},doc)).rejects.toMatchObject({code:'FORBIDDEN'});
 const other=await getSnapshot(db,{...access,organizationId:'bistro'});expect(other.openings).toHaveLength(0);
});
it('preserves fractional opening cost and FIFO for later receipts and waste',async()=>{
 const site=await fixture(),doc=document(site,{lines:[{lineId:randomUUID(),itemId:'beef',unitId:'كجم',quantity:'0.100001',unitCost:'0.200003'}]});
 await postOpening(db,access,doc);await postCommand(db,access,stock(site,'receipt.post','1'));
 expect((await postCommand(db,access,stock(site,'waste.post','0.100001'))).amount).toBe('0.020000500003');
 const balance=(await getSnapshot(db,access)).balances.find(b=>b.locationId===site)!;expect(balance.value).toBe('99.000000000000');
});
