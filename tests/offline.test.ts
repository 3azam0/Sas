import 'fake-indexeddb/auto';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {local,saveCommand,acceptSnapshot,bootstrap,sync} from '../apps/web/src/offline';
import {projectedQuantity} from '@saas/domain';
import type {Snapshot,Command} from '@saas/contracts';
const snapshot:Snapshot={organizationId:'grills',organizationName:'Fixture',currency:'EGP',access:{organizationId:'grills',userId:'owner',deviceId:crypto.randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()},items:[],locations:[],balances:[{locationId:'central',itemId:'beef',quantity:'10',value:'1000',average:'100'}],layers:[],entries:[],acceptedOperationIds:[],fetchedAt:new Date().toISOString()};
const command:Command={operationId:crypto.randomUUID(),organizationId:'grills',locationId:'central',itemId:'beef',type:'waste.post',quantity:'2',reason:'Test waste',businessDate:'2026-10-09',capturedAt:new Date().toISOString(),schemaVersion:1};
afterEach(async()=>{vi.unstubAllGlobals();await local.commands.clear();await local.snapshots.clear();});
describe('durable offline outbox and convergence',()=>{
 it('does not overwrite a tenant snapshot when the session changes',async()=>{
  await acceptSnapshot(snapshot);
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({...snapshot,organizationId:'bistro'})));
  await expect(bootstrap('grills')).rejects.toThrow('الجلسة تخص مؤسسة أخرى');
  expect(await local.snapshots.get('bistro')).toBeUndefined();
  expect((await local.snapshots.get('grills'))?.organizationId).toBe('grills');
 });
 it('preserves queued operations when posting loses authorization',async()=>{
  await acceptSnapshot(snapshot);await saveCommand(command);
  vi.stubGlobal('navigator',{});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({message:'Forbidden'},{status:403})));
  await expect(sync('grills')).rejects.toThrow('العمليات محفوظة');
  expect((await local.commands.get(command.operationId))?.status).toBe('pending');
 });
 it('keeps saved operations across database close/reopen',async()=>{
  await acceptSnapshot(snapshot);await saveCommand(command);local.close();await local.open();expect((await local.commands.get(command.operationId))?.status).toBe('pending');expect(projectedQuantity(snapshot,[command],'central','beef')).toBe('8.000000');
 });
 it('suppresses provisional effects when the atomic snapshot includes acceptance',async()=>{
  await acceptSnapshot(snapshot);await saveCommand(command);await local.commands.update(command.operationId,{status:'acceptedAwaiting'});
  const confirmed={...snapshot,balances:[{...snapshot.balances[0],quantity:'8',value:'800'}],acceptedOperationIds:[command.operationId]};
  await acceptSnapshot(confirmed);expect((await local.commands.get(command.operationId))?.status).toBe('accepted');expect(projectedQuantity(confirmed,[command],'central','beef')).toBe('8.000000');
 });
 it('requires a downloaded valid grant and refuses duplicate local IDs',async()=>{
  await expect(saveCommand(command)).rejects.toThrow();await acceptSnapshot(snapshot);await saveCommand(command);await expect(saveCommand(command)).rejects.toThrow();expect(await local.commands.count()).toBe(1);
 });
});
