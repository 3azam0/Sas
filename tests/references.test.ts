import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import type {Access} from '@saas/contracts';
import {createDatabase,seed,postWorkshopCommand,postCommand,getSnapshot} from '@saas/server';
let db:PGlite;
const access:Access={organizationId:'grills',userId:'warehouse',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
const base=()=>({operationId:randomUUID(),organizationId:'grills',businessDate:'2026-10-29',capturedAt:new Date().toISOString(),schemaVersion:1});
const send=(c:Record<string,unknown>)=>postWorkshopCommand(db,access,c);
beforeAll(async()=>{db=await createDatabase();await seed(db);});
beforeEach(async()=>{await db.exec(`TRUNCATE document_references,reference_counters,valuation_heads,valuation_edges,valuation_nodes,cost_adjustments,production_batches,audit_events,layer_allocations,command_receipts,stock_entries,cost_layers,stock_balances,workshop_documents,transfers RESTART IDENTITY; DELETE FROM items WHERE id NOT IN ('beef','chicken','rice','pepper','box'); UPDATE items SET sku='PK-001' WHERE id='box';`);});
afterAll(async()=>{await db.close();});

it('generates readable item and batch references with no manual code, name or note; replay keeps the same numbers',async()=>{
 const itemId=randomUUID(),catalog={...base(),type:'catalog.create',itemId,name:'صنف تلقائي',unit:'كجم',role:'finished'};
 const result=await send(catalog);expect(await send(catalog)).toEqual(result);
 let s=await getSnapshot(db,access);expect(s.items.find(i=>i.id===itemId)?.sku).toBe('MAT-000001');expect(s.items.find(i=>i.id==='beef')?.sku).toBe('MT-001');
 const batchId=randomUUID(),create={...base(),type:'production.create',batchId,operationType:'manufacturing',recipient:'أحمد',balanceMode:'mass',outputs:[{itemId,quantity:'1',costShare:'100'}]};
 const posted=await send(create);expect(await send(create)).toEqual(posted);s=await getSnapshot(db,access);const b=s.productionBatches!.find(b=>b.id===batchId)!;
 expect(b.reference).toBe('PROD-000001');expect(b.name).toBe(b.reference);expect(b.notes).toBe('');expect(s.workshopDocuments!.find(d=>d.id===create.operationId)?.reference).toBe(posted.reference);
});

it('assigns distinct codes under concurrent catalogue creation and avoids existing imported codes',async()=>{
 await db.query("UPDATE items SET sku='MAT-000900' WHERE organization_id='grills' AND id='box'");
 const ids=[randomUUID(),randomUUID()];await Promise.all(ids.map((itemId,i)=>send({...base(),type:'catalog.create',itemId,name:`مادة تلقائية ${i}`,unit:'كجم',role:'raw'})));
 const s=await getSnapshot(db,access);expect(ids.map(id=>s.items.find(i=>i.id===id)!.sku).sort()).toEqual(['MAT-000901','MAT-000902']);
});

it('accepts receipt without a manual reference but requires waste and correction reasons; failed posting does not consume a number',async()=>{
 const c={...base(),type:'receipt.post',locationId:'central',itemId:'beef',quantity:'1',unitCost:'100'};const received=await postCommand(db,access,c);expect(received.reference).toBe('RCV-000001');expect(await postCommand(db,access,c)).toEqual(received);
 await expect(postCommand(db,access,{...base(),type:'waste.post',locationId:'central',itemId:'beef',quantity:'1'})).rejects.toMatchObject({code:'INVALID_COMMAND'});
 await expect(postCommand(db,access,{...base(),type:'waste.post',locationId:'central',itemId:'beef',quantity:'2',reason:'تلف'})).rejects.toMatchObject({code:'INSUFFICIENT_STOCK'});
 const waste=await postCommand(db,access,{...base(),type:'waste.post',locationId:'central',itemId:'beef',quantity:'1',reason:'تلف'});expect(waste.reference).toBe('WST-000001');
 for(const type of ['production.loss','production.cancel','production.reverse'])await expect(send({...base(),type,batchId:randomUUID(),issueId:randomUUID(),targetOperationId:randomUUID(),quantity:'1'})).rejects.toMatchObject({code:'INVALID_COMMAND'});
});

it('keeps numbering tenant-scoped and assigns automatic references to transfers',async()=>{
 const itemId=randomUUID();await send({...base(),type:'catalog.create',itemId,name:'مادة مؤسسة أولى',unit:'كجم',role:'raw'});
 const other={...access,organizationId:'bistro' as const},otherId=randomUUID();await postWorkshopCommand(db,other,{...base(),organizationId:'bistro',type:'catalog.create',itemId:otherId,name:'مادة مؤسسة ثانية',unit:'كجم',role:'raw'});
 expect((await getSnapshot(db,other)).items.find(i=>i.id===otherId)?.sku).toBe('MAT-000001');
 await postCommand(db,access,{...base(),type:'receipt.post',locationId:'central',itemId,quantity:'2',unitCost:'10'});const c={...base(),type:'transfer.dispatch',sourceId:'central',destinationId:'cairo',itemId,quantity:'1'};expect((await send(c)).reference).toBe('TRF-000001');expect((await getSnapshot(db,access)).transfers![0].reference).toBe('TRF-000001');
});
