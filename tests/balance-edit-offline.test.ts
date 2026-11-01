import 'fake-indexeddb/auto';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {local,acceptSnapshot,saveBalanceEdit,recoveryArchive,restoreRecovery,saveCommand} from '../apps/web/src/offline';
import type {Snapshot,CountDefinition} from '@saas/contracts';
const now=()=>new Date().toISOString(),generation=crypto.randomUUID();
const snapshot:Snapshot={generation,organizationId:'grills',organizationName:'Fixture',currency:'EGP',access:{organizationId:'grills',userId:'owner',deviceId:crypto.randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()},locations:[{id:'main',name:'Main warehouse',kind:'مخزن'}],items:[{id:'rice',name:'Rice',unitId:'kg',unit:'كجم',sku:'R',minimum:'0',category:'Food'}],balances:[{locationId:'main',itemId:'rice',quantity:'10',value:'280',average:'28'}],layers:[],entries:[],acceptedOperationIds:[],fetchedAt:now(),stockCheckpoints:[{locationId:'main',sequence:'2'}]};
const edit=():CountDefinition=>({operationId:crypto.randomUUID(),organizationId:'grills',generation,countId:crypto.randomUUID(),expectedRevision:0,type:'count.save',entryMode:'balance_edit',locationId:'main',businessDate:'2026-10-10',reason:'Physical correction',cutoffAt:snapshot.fetchedAt,stockSequence:'2',currency:'EGP',capturedAt:now(),schemaVersion:1,lines:[{lineId:crypto.randomUUID(),itemId:'rice',unitId:'kg',expectedQuantity:'10',countedQuantity:'7'}]});
async function clear(){for(const t of local.tables)await t.clear();}
beforeEach(async()=>{await clear();await acceptSnapshot(snapshot);});afterEach(async()=>{vi.restoreAllMocks();await clear();});
it('durably saves both adjustment envelopes and preserves their baseline through recovery',async()=>{
 const d=edit();await saveBalanceEdit(d);local.close();await local.open();const rows=await local.counts.toArray();expect(rows).toHaveLength(2);expect(rows.find(r=>r.command.type==='count.save')?.command).toMatchObject({entryMode:'balance_edit',generation,lines:[{expectedQuantity:'10',countedQuantity:'7'}]});expect(rows.find(r=>r.command.type==='count.finalize')?.command.expectedRevision).toBe(1);
 const archive=await recoveryArchive('grills');await local.counts.clear();await restoreRecovery(JSON.stringify(archive),'grills');expect(await local.counts.count()).toBe(2);expect((await local.snapshots.get('grills'))?.balances[0].quantity).toBe('10');
});
it('rejects unchanged quantities, missing increase cost, stale baselines and expired grants',async()=>{
 const d=edit();await expect(saveBalanceEdit({...d,lines:[{...d.lines[0],countedQuantity:'10.000000'}]})).rejects.toThrow('مختلف');await expect(saveBalanceEdit({...d,lines:[{...d.lines[0],countedQuantity:'12'}]})).rejects.toThrow('تكلفة');await expect(saveBalanceEdit({...d,stockSequence:'1'})).rejects.toThrow('أساس');expect(await local.counts.count()).toBe(0);
 await acceptSnapshot({...snapshot,access:{...snapshot.access,expiresAt:'2000-01-01T00:00:00Z'}});await expect(saveBalanceEdit(d)).rejects.toThrow('انتهت');
});
it('blocks conflicting local stock operations and accepts explicit zero-cost increases',async()=>{
 const d=edit();await saveCommand({operationId:crypto.randomUUID(),organizationId:'grills',locationId:'main',type:'waste.post',itemId:'rice',quantity:'1',reason:'Earlier operation',businessDate:'2026-10-10',capturedAt:now(),schemaVersion:1});await expect(saveBalanceEdit(d)).rejects.toThrow('عمليات الموقع');await local.commands.clear();await saveBalanceEdit({...d,lines:[{...d.lines[0],countedQuantity:'12',surplusUnitCost:'0'}]});await expect(saveBalanceEdit({...edit(),operationId:crypto.randomUUID()})).rejects.toThrow('عمليات الموقع');
});
it('rolls back the first envelope if generating or validating the final envelope fails',async()=>{
 const d=edit();vi.spyOn(crypto,'randomUUID').mockReturnValue(d.operationId as `${string}-${string}-${string}-${string}-${string}`);await expect(saveBalanceEdit(d)).rejects.toThrow();expect(await local.counts.count()).toBe(0);
});
