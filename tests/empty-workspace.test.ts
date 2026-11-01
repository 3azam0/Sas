import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDatabase,seed,getSnapshot,initializeDevelopmentBaseline,postSetupCommand,postCommand,postCosting} from '@saas/server';
import type {Access} from '@saas/contracts';
const access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
const envelope=()=>({operationId:randomUUID(),organizationId:'grills' as const,capturedAt:new Date().toISOString(),schemaVersion:1 as const});
beforeAll(()=>vi.stubEnv('SAAS_DEMO_MODE','1'));afterAll(()=>vi.unstubAllEnvs());
it('clears marked old development catalog and transactions atomically and rotates only that tenant',async()=>{
 const db=await createDatabase();try{await seed(db,'fifo');const old=await getSnapshot(db,access),other=await getSnapshot(db,{...access,organizationId:'bistro'});await db.query("UPDATE organizations SET development_empty_baseline=false WHERE id='grills'");await initializeDevelopmentBaseline(db);const fresh=await getSnapshot(db,access);
 for(const key of ['items','units','locations','suppliers','balances','layers','entries','openings','purchaseOrders','purchaseReceipts','supplierReturns','transfers','counts','acceptedOperationIds'] as const)expect(fresh[key]).toEqual([]);
 expect(fresh.generation).not.toBe(old.generation);expect(fresh.costing).toMatchObject({method:'moving_average',hasStockHistory:false});expect((await getSnapshot(db,{...access,organizationId:'bistro'})).generation).toBe(other.generation);
 await initializeDevelopmentBaseline(db);expect((await getSnapshot(db,access)).generation).toBe(fresh.generation);
 }finally{await db.close();}
});
it('starts without samples and preserves user-entered setup/stock across database restarts',async()=>{
 const path=join(mkdtempSync(join(tmpdir(),'fodo-empty-')),'database');let db=await createDatabase(path);
 try{await seed(db,'moving_average',false);const initial=await getSnapshot(db,access);expect(initial.items).toEqual([]);expect(initial.locations).toEqual([]);expect(initial.units).toEqual([]);
 for(const [type,record] of [['unit.save',{id:'kg',name:'Kilogram'}],['location.save',{id:'my-branch',name:'My branch',kind:'مطعم',active:true}],['item.save',{id:'my-rice',name:'My rice',sku:'MY-RICE',category:'Food',unitId:'kg',minimum:'0',active:true,purchaseUnits:[]}]])await postSetupCommand(db,access,{...envelope(),type,record,expectedRevision:0});
 await postCommand(db,access,{...envelope(),type:'receipt.post',locationId:'my-branch',itemId:'my-rice',quantity:'5',unitCost:'12',reason:'Own receipt',businessDate:'2026-10-10'});await db.close();db=await createDatabase(path);await initializeDevelopmentBaseline(db);await seed(db,'moving_average',false);const saved=await getSnapshot(db,access);
 expect(saved.generation).toBe(initial.generation);expect(saved.items.map(i=>i.id)).toEqual(['my-rice']);expect(saved.locations.map(l=>l.id)).toEqual(['my-branch']);expect(saved.balances[0]).toMatchObject({quantity:'5.000000',value:'60.000000000000'});
 }finally{await db.close();}
});
it('changing the costing method clears stock but keeps setup and never reseeds samples',async()=>{
 const db=await createDatabase();try{await seed(db);const s=await getSnapshot(db,access);await postCosting(db,access,{operationId:randomUUID(),organizationId:'grills',generation:s.generation,expectedRevision:s.costing!.revision,method:'fifo',resetSamples:true});const fresh=await getSnapshot(db,access);expect(fresh.items).toEqual(s.items);expect(fresh.locations).toEqual(s.locations);expect(fresh.balances).toEqual([]);expect(fresh.entries).toEqual([]);await initializeDevelopmentBaseline(db);expect((await getSnapshot(db,access)).generation).toBe(fresh.generation);}finally{await db.close();}
});
it('does not clear a database outside development',async()=>{
 const db=await createDatabase();try{await seed(db);const s=await getSnapshot(db,access);await db.query("UPDATE organizations SET development_empty_baseline=false WHERE id='grills'");vi.stubEnv('SAAS_DEMO_MODE','0');await initializeDevelopmentBaseline(db);expect((await getSnapshot(db,access)).generation).toBe(s.generation);expect((await getSnapshot(db,access)).items).toEqual(s.items);}finally{vi.stubEnv('SAAS_DEMO_MODE','1');await db.close();}
});
