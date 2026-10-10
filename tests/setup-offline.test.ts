import 'fake-indexeddb/auto';
import {afterEach,it,expect,vi} from 'vitest';
import {local,acceptSnapshot,saveSetup,saveCommand,projectSetup,sync,recoveryArchive,restoreRecovery,resolveSetup} from '../apps/web/src/offline';
import {setupCommandSchema,type Snapshot,type Command} from '@saas/contracts';
const now=()=>new Date().toISOString();
const snapshot:Snapshot={organizationId:'grills',organizationName:'Fixture',currency:'EGP',access:{organizationId:'grills',userId:'owner',deviceId:crypto.randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()},items:[],locations:[{id:'central',name:'Central',kind:'مطعم'}],units:[],suppliers:[],balances:[],layers:[],entries:[],acceptedOperationIds:[],fetchedAt:now()};
const unit=()=>setupCommandSchema.parse({operationId:crypto.randomUUID(),organizationId:'grills',type:'unit.save',record:{id:crypto.randomUUID(),name:'كجم اختبار'},expectedRevision:0,capturedAt:now(),schemaVersion:1});
const item=(unitId:string)=>setupCommandSchema.parse({operationId:crypto.randomUUID(),organizationId:'grills',type:'item.save',record:{id:crypto.randomUUID(),name:'مادة اختبار',sku:'TEST',category:'مواد غذائية',unitId,minimum:'0',active:true,purchaseUnits:[]},expectedRevision:0,capturedAt:now(),schemaVersion:1});
afterEach(async()=>{vi.unstubAllGlobals();await local.setups.clear();await local.commands.clear();await local.snapshots.clear();});
it('persists offline setup through reload and projects new items without changing confirmed stock',async()=>{
 await acceptSnapshot(snapshot);const u=unit(),i=item(u.record.id);await saveSetup(u);await saveSetup(i);local.close();await local.open();
 const projected=projectSetup(snapshot,await local.setups.toArray());expect(projected.items[0]).toMatchObject({id:i.record.id,unit:'كجم اختبار'});expect(projected.balances).toHaveLength(0);expect(snapshot.items).toHaveLength(0);
 await expect(saveSetup({...i,operationId:crypto.randomUUID()})).rejects.toThrow('تعديل محفوظ');
});
it('uploads unit/item dependencies before receiving and reconciles all IDs',async()=>{
 await acceptSnapshot(snapshot);const u=unit(),i=item(u.record.id);await saveSetup(i);await saveSetup(u);
 const c:Command={operationId:crypto.randomUUID(),organizationId:'grills',locationId:'central',itemId:i.record.id,type:'receipt.post',quantity:'2',unitCost:'3',reason:'test',businessDate:'2026-10-09',capturedAt:now(),schemaVersion:1};await saveCommand(c);
 const calls:string[]=[];const projected=projectSetup(snapshot,await local.setups.toArray());const confirmed={...projected,acceptedOperationIds:[u.operationId,i.operationId]};
 vi.stubGlobal('navigator',{});vi.stubGlobal('fetch',vi.fn(async(url:string,options?:{body?:string})=>{calls.push(url);if(options?.body){const command=JSON.parse(options.body);return Response.json({operationId:command.operationId,outcome:'accepted'});}return Response.json({...confirmed,acceptedOperationIds:calls.includes('/api/v1/commands')?[...confirmed.acceptedOperationIds,c.operationId]:confirmed.acceptedOperationIds});}));
 await sync('grills');expect(calls).toEqual(['/api/v1/setup','/api/v1/setup','/api/v1/bootstrap','/api/v1/commands','/api/v1/bootstrap']);expect((await local.setups.toArray()).every(r=>r.status==='accepted')).toBe(true);expect((await local.commands.get(c.operationId))?.status).toBe('accepted');
});
it('preserves setup on lost authorization and keeps rejected edits out of projections',async()=>{
 await acceptSnapshot(snapshot);const u=unit();await saveSetup(u);vi.stubGlobal('navigator',{});vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({message:'Forbidden'},{status:403})));
 await expect(sync('grills')).rejects.toThrow('التعديلات محفوظة');expect((await local.setups.get(u.operationId))?.status).toBe('pending');
 await local.setups.update(u.operationId,{status:'needsReview',error:'Conflict'});expect(projectSetup(snapshot,await local.setups.toArray()).units).toHaveLength(0);
 await resolveSetup('grills',u.operationId,'cancel');expect((await local.setups.get(u.operationId))?.command).toEqual(u);
});
it('exports and atomically restores setup together with dependent stock operations',async()=>{
 await acceptSnapshot(snapshot);const u=unit(),i=item(u.record.id);await saveSetup(u);await saveSetup(i);
 const c:Command={operationId:crypto.randomUUID(),organizationId:'grills',locationId:'central',itemId:i.record.id,type:'receipt.post',quantity:'2',unitCost:'3',reason:'test',businessDate:'2026-10-09',capturedAt:now(),schemaVersion:1};await saveCommand(c);
 const text=JSON.stringify(await recoveryArchive('grills'));await local.setups.clear();await local.commands.clear();
 expect((await restoreRecovery(text,'grills')).newCount).toBe(3);expect((await restoreRecovery(text,'grills')).duplicateCount).toBe(3);
 const invalid=JSON.parse(text);invalid.setups[0].command.record.name='Different';await expect(restoreRecovery(JSON.stringify(invalid),'grills')).rejects.toThrow('بيانات مختلفة');expect(await local.setups.count()).toBe(2);
 await expect(restoreRecovery(text,'bistro')).rejects.toThrow('مؤسسة أخرى');
});
