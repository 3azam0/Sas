import 'fake-indexeddb/auto';
import {afterEach,it,expect,vi} from 'vitest';
import {local,acceptSnapshot,sync,previewRecovery,restoreRecovery} from '../apps/web/src/offline';
import {saveWorkshop,resolveWorkshop} from '../apps/web/src/workshop-offline';
import type {Snapshot} from '@saas/contracts';
import type {WorkshopCommand} from '../packages/contracts/butchery';
const snapshot:Snapshot={organizationId:'grills',organizationName:'Test',currency:'EGP',access:{organizationId:'grills',userId:'test',deviceId:crypto.randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()},items:[],locations:[],balances:[],layers:[],entries:[],acceptedOperationIds:[],fetchedAt:new Date().toISOString()};
const command:WorkshopCommand={operationId:crypto.randomUUID(),organizationId:'grills',businessDate:'2026-10-26',capturedAt:new Date().toISOString(),schemaVersion:1,reason:'صنف للاختبار',type:'product.create',itemId:crypto.randomUUID(),name:'منتج للمطبخ',meatKind:'beef_product'};
afterEach(async()=>{vi.unstubAllGlobals();await local.workshop.clear();await local.commands.clear();await local.snapshots.clear();});
it('persists offline commands, replays same IDs and waits for snapshot acknowledgment',async()=>{
 await acceptSnapshot(snapshot);await saveWorkshop(command);local.close();await local.open();expect((await local.workshop.get(command.operationId))?.status).toBe('pending');
 vi.stubGlobal('navigator',{});const fetch=vi.fn().mockResolvedValueOnce(Response.json({outcome:'accepted'})).mockResolvedValueOnce(Response.json(snapshot));vi.stubGlobal('fetch',fetch);await sync('grills');expect((await local.workshop.get(command.operationId))?.status).toBe('acceptedAwaiting');
 expect(JSON.parse(fetch.mock.calls[0][1].body).operationId).toBe(command.operationId);
 await acceptSnapshot({...snapshot,acceptedOperationIds:[command.operationId]});expect((await local.workshop.get(command.operationId))?.status).toBe('accepted');
});
it('keeps rejected commands reviewable and retains pending data on authorization failures',async()=>{
 await acceptSnapshot(snapshot);await saveWorkshop(command);vi.stubGlobal('navigator',{});vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({message:'denied'},{status:403})));await expect(sync('grills')).rejects.toThrow('محفوظة');expect((await local.workshop.get(command.operationId))?.status).toBe('pending');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({message:'stock'},{status:409})).mockResolvedValueOnce(Response.json(snapshot)));await sync('grills');expect((await local.workshop.get(command.operationId))?.status).toBe('needsReview');await resolveWorkshop('grills',command.operationId,'retry');expect((await local.workshop.get(command.operationId))?.status).toBe('pending');
});
it('restores workshop recovery without trusting archived acceptance or duplicating operations',async()=>{
 await acceptSnapshot(snapshot);const archive={version:3,organizationId:'grills',exportedAt:new Date().toISOString(),commands:[],workshop:[{id:command.operationId,scope:'grills',command,status:'accepted',createdAt:command.capturedAt}]};const text=JSON.stringify(archive);
 expect((await previewRecovery(text,'grills')).newCount).toBe(1);await restoreRecovery(text,'grills');expect((await local.workshop.get(command.operationId))?.status).toBe('pending');expect((await previewRecovery(text,'grills')).duplicateCount).toBe(1);
 await expect(previewRecovery(JSON.stringify({...archive,organizationId:'bistro'}),'grills')).rejects.toThrow();
 await expect(previewRecovery(JSON.stringify({...archive,workshop:[{...archive.workshop[0],command:{...command,name:'changed'}}]}),'grills')).rejects.toThrow();
});

it('recovers and replays dependent production commands in capture order with stable IDs',async()=>{
 await acceptSnapshot(snapshot);const batchId=crypto.randomUUID();
 const create={...command,type:'production.create',batchId,name:'دفعة دون اتصال',operationType:'manufacturing',recipient:'أحمد',balanceMode:'mass',outputs:[{itemId:'kofta',quantity:'9',costShare:'100'}]};
 const issue={...command,operationId:crypto.randomUUID(),capturedAt:new Date(Date.now()+1).toISOString(),type:'production.issue',batchId,recipient:'أحمد',lines:[{itemId:'beef',quantity:'10',unit:'كجم'}]};
 const archive={version:3,organizationId:'grills',exportedAt:new Date().toISOString(),commands:[],workshop:[create,issue].map(c=>({id:c.operationId,scope:'grills',command:c,status:'pending',createdAt:c.capturedAt}))};
 await restoreRecovery(JSON.stringify(archive),'grills');local.close();await local.open();
 vi.stubGlobal('navigator',{});const fetch=vi.fn().mockResolvedValueOnce(Response.json({outcome:'accepted'})).mockResolvedValueOnce(Response.json({outcome:'accepted'})).mockResolvedValueOnce(Response.json({...snapshot,acceptedOperationIds:[create.operationId,issue.operationId]}));vi.stubGlobal('fetch',fetch);await sync('grills');
 expect(fetch.mock.calls.slice(0,2).map(c=>JSON.parse(c[1].body).type)).toEqual(['production.create','production.issue']);expect((await local.workshop.toArray()).every(c=>c.status==='accepted')).toBe(true);
});
