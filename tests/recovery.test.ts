import 'fake-indexeddb/auto';
import {afterEach,it,expect} from 'vitest';
import {local,acceptSnapshot,saveCommand,resolveReview,previewRecovery,restoreRecovery} from '../apps/web/src/offline';
import type {Command,Snapshot} from '@saas/contracts';
const now=()=>new Date().toISOString();
const command=(quantity='2'):Command=>({operationId:crypto.randomUUID(),organizationId:'grills',locationId:'central',itemId:'beef',type:'waste.post',quantity,reason:'recovery test',businessDate:'2026-10-09',capturedAt:now(),schemaVersion:1});
const snapshot:Snapshot={organizationId:'grills',organizationName:'Fixture',currency:'EGP',access:{organizationId:'grills',userId:'owner',deviceId:crypto.randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()},items:[{id:'beef',name:'Beef',sku:'B',category:'Meat',unit:'kg',minimum:'1'}],locations:[{id:'central',name:'Central',kind:'warehouse'}],balances:[],layers:[],entries:[],acceptedOperationIds:[],fetchedAt:now()};
const archive=(commands:Command[],status='pending')=>JSON.stringify({version:2,exportedAt:now(),organizationId:'grills',commands:commands.map(command=>({id:command.operationId,scope:'grills',command,status,createdAt:command.capturedAt}))});
afterEach(async()=>{await local.commands.clear();await local.snapshots.clear();});
it('retries unchanged IDs and links corrected commands without erasing history',async()=>{
 await acceptSnapshot(snapshot);const c=command();await saveCommand(c);await local.commands.update(c.operationId,{status:'needsReview'});
 await resolveReview('grills',c.operationId,'retry');expect((await local.commands.get(c.operationId))?.command).toEqual(c);
 await local.commands.update(c.operationId,{status:'needsReview'});const corrected=command('1');await resolveReview('grills',c.operationId,'correct',corrected);
 expect(await local.commands.get(c.operationId)).toMatchObject({status:'superseded',replacementId:corrected.operationId,command:c});
 expect(await local.commands.get(corrected.operationId)).toMatchObject({status:'pending',replacesId:c.operationId});
});
it('only cancels known rejected commands and preserves the captured payload',async()=>{
 await acceptSnapshot(snapshot);const c=command();await saveCommand(c);await expect(resolveReview('grills',c.operationId,'cancel')).rejects.toThrow();
 await local.commands.update(c.operationId,{status:'needsReview'});await resolveReview('grills',c.operationId,'cancel');expect(await local.commands.get(c.operationId)).toMatchObject({status:'cancelled',command:c});
});
it('previews without mutation and restores idempotently',async()=>{
 await acceptSnapshot(snapshot);const c=command();const text=archive([c]);expect((await previewRecovery(text,'grills')).newCount).toBe(1);expect(await local.commands.count()).toBe(0);
 await restoreRecovery(text,'grills');expect((await restoreRecovery(text,'grills')).duplicateCount).toBe(1);expect(await local.commands.count()).toBe(1);
});
it('aborts the entire import on conflicting payloads or scope',async()=>{
 await acceptSnapshot(snapshot);const c=command();await saveCommand(c);await expect(restoreRecovery(archive([command(),{...c,quantity:'8'}]),'grills')).rejects.toThrow('بيانات مختلفة');expect(await local.commands.count()).toBe(1);
 await expect(restoreRecovery(archive([c]),'bistro')).rejects.toThrow('مؤسسة أخرى');
});
it('does not trust exported acceptance and skips server-known IDs',async()=>{
 const c=command();const unknown=command();await acceptSnapshot({...snapshot,acceptedOperationIds:[c.operationId]});const result=await restoreRecovery(archive([c,unknown],'accepted'),'grills');expect(result.acceptedCount).toBe(1);expect(await local.commands.get(c.operationId)).toBeUndefined();expect((await local.commands.get(unknown.operationId))?.status).toBe('pending');
});
it('rejects malformed envelope IDs, unsupported versions and expired grants',async()=>{
 await acceptSnapshot(snapshot);const parsed=JSON.parse(archive([command()]));parsed.commands[0].id=crypto.randomUUID();await expect(restoreRecovery(JSON.stringify(parsed),'grills')).rejects.toThrow();parsed.version=99;await expect(previewRecovery(JSON.stringify(parsed),'grills')).rejects.toThrow();
 await acceptSnapshot({...snapshot,access:{...snapshot.access,expiresAt:'2020-01-01T00:00:00.000Z'}});await expect(restoreRecovery(archive([command()]),'grills')).rejects.toThrow('انتهت');expect(await local.commands.count()).toBe(0);
});
