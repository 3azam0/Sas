import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createDatabase,seed,postSetupCommand,postCommand,postCount,getSnapshot,reconcileStock} from '../packages/server';
import {countCommandSchema,type Access,type CountDefinition,type CountCommand} from '../packages/contracts';
let db:Awaited<ReturnType<typeof createDatabase>>;
const access:Access={organizationId:'grills',userId:'owner',role:'owner',deviceId:randomUUID(),expiresAt:'2099-01-01T00:00:00Z'};
const env=()=>({operationId:randomUUID(),organizationId:'grills',capturedAt:new Date().toISOString(),schemaVersion:1 as const});
beforeAll(async()=>{db=await createDatabase();await seed(db,'fifo');});afterAll(async()=>db.close());
async function fixture(method:'fifo'|'moving_average'){
 await db.query("UPDATE organizations SET costing_method=$1 WHERE id='grills'",[method]);const locationId=randomUUID();
 await postSetupCommand(db,access,{...env(),type:'location.save',expectedRevision:0,record:{id:locationId,name:'Price test',kind:'مخزن',active:true}});
 for(const [quantity,unitCost] of [['2','20'],['8','30']])await postCommand(db,access,{...env(),locationId,type:'receipt.post',itemId:'rice',quantity,unitCost,reason:'Fixture',businessDate:'2026-11-01'});
 return locationId;
}
async function definition(locationId:string,quantity:string,cost:string):Promise<CountDefinition>{const s=await getSnapshot(db,access),b=s.balances.find(b=>b.locationId===locationId&&b.itemId==='rice')!;return {...env(),countId:randomUUID(),expectedRevision:0,type:'count.save',entryMode:'balance_edit',locationId,businessDate:'2026-11-01',cutoffAt:s.fetchedAt,stockSequence:s.stockCheckpoints!.find(p=>p.locationId===locationId)!.sequence,currency:'EGP',reason:'Correct quantity and cost',lines:[{lineId:randomUUID(),itemId:'rice',unitId:'كجم',expectedQuantity:b.quantity,countedQuantity:quantity,targetUnitCost:cost,surplusUnitCost:cost}]};}
const final=(d:CountDefinition):Extract<CountCommand,{type:'count.finalize'}>=>({...env(),countId:d.countId,expectedRevision:1,type:'count.finalize',costPolicy:'explicit',lines:[{lineId:d.lines[0].lineId,movementId:randomUUID()}]});
const balance=async(loc:string)=>(await getSnapshot(db,access)).balances.find(b=>b.locationId===loc&&b.itemId==='rice')!;
it.each(['fifo','moving_average'] as const)('reprices only remaining stock and preserves booked historical issues under %s',async method=>{
 const loc=await fixture(method),oldIssue={...env(),locationId:loc,type:'waste.post' as const,itemId:'rice',quantity:'1',reason:'Earlier issue',businessDate:'2026-11-01'};await postCommand(db,access,oldIssue);
 const oldAmount=(await db.query<{amount:string}>('SELECT amount::text FROM stock_entries WHERE operation_id=$1',[oldIssue.operationId])).rows[0].amount,d=await definition(loc,'9','50');await postCount(db,access,d);const f=final(d),result=await postCount(db,access,f);expect(await postCount(db,access,f)).toEqual(result);
 expect(await balance(loc)).toMatchObject({quantity:'9.000000',value:'450.000000000000'});expect(Number((await balance(loc)).average)).toBe(50);
 expect((await db.query<{amount:string}>('SELECT amount::text FROM stock_entries WHERE operation_id=$1',[oldIssue.operationId])).rows[0].amount).toBe(oldAmount);
 const saved=(await getSnapshot(db,access)).counts!.find(c=>c.countId===d.countId)!.finalization!.changes[0];expect(saved.revaluation).toMatchObject({unitCost:'50',value:'450.000000000000'});expect(saved.revaluation!.layers.length).toBeGreaterThan(0);
 const future={...env(),locationId:loc,type:'waste.post' as const,itemId:'rice',quantity:'2',reason:'Later issue',businessDate:'2026-11-01'};expect((await postCommand(db,access,future)).amount).toBe('100.000000000000');expect(await balance(loc)).toMatchObject({quantity:'7.000000',value:'350.000000000000'});expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);
});
it.each(['fifo','moving_average'] as const)('combines quantity and cost changes atomically under %s',async method=>{
 for(const qty of ['7','12']){const loc=await fixture(method),d=await definition(loc,qty,'50');await postCount(db,access,d);const r=await postCount(db,access,final(d));expect(Number(r.amount)).toBe(Number(qty)*50-280);expect(Number((await balance(loc)).value)).toBe(Number(qty)*50);expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);}
});
it('rejects stale stock, unauthorized repricing and zero-quantity targets without changing cost',async()=>{
 const loc=await fixture('moving_average'),d=await definition(loc,'10','0');expect(countCommandSchema.safeParse({...d,lines:[{...d.lines[0],countedQuantity:'0'}]}).success).toBe(false);await expect(postCount(db,{...access,role:'operator'},d)).rejects.toMatchObject({code:'APPROVAL_REQUIRED'});
 await postCount(db,access,d);await postCommand(db,access,{...env(),locationId:loc,type:'waste.post',itemId:'rice',quantity:'1',reason:'Stock changed',businessDate:'2026-11-01'});const before=await balance(loc);await expect(postCount(db,access,final(d))).rejects.toMatchObject({code:'STALE_COUNT'});expect(await balance(loc)).toEqual(before);
 const fresh=await definition(loc,'9','0');await postCount(db,access,fresh);await postCount(db,access,final(fresh));expect(Number((await balance(loc)).value)).toBe(0);expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);
});
