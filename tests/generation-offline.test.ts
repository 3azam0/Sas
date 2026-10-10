import 'fake-indexeddb/auto';
import {afterEach,it,expect,vi} from 'vitest';
import {local,acceptSnapshot,saveCommand,sync,recoveryArchive,restoreRecovery} from '../apps/web/src/offline';
import type {Snapshot,Command} from '@saas/contracts';
const generation=crypto.randomUUID();
const snapshot:Snapshot={generation,organizationId:'grills',organizationName:'Fixture',currency:'EGP',costing:{method:'moving_average',revision:1,hasStockHistory:true},access:{organizationId:'grills',userId:'owner',deviceId:crypto.randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()},items:[{id:'rice',name:'Rice',unitId:'kg',unit:'kg',sku:'001',minimum:'0',category:'Food'}],locations:[{id:'central',name:'Central',kind:'مطعم'}],balances:[],layers:[],entries:[],acceptedOperationIds:[],fetchedAt:new Date().toISOString()};
const command=():Command=>({operationId:crypto.randomUUID(),organizationId:'grills',locationId:'central',itemId:'rice',type:'waste.post',quantity:'2',reason:'Reset test',businessDate:'2026-10-09',capturedAt:new Date().toISOString(),schemaVersion:1});
afterEach(async()=>{vi.unstubAllGlobals();for(const table of local.tables)await table.clear();});
it('atomically clears every matching old queue while preserving another tenant and device preferences',async()=>{
 await acceptSnapshot(snapshot);await local.preferences.put({key:'device',value:'preserved'});
 for(const table of [local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts]){
  await table.put({id:crypto.randomUUID(),scope:'grills',status:'pending'} as never);
  await table.put({id:crypto.randomUUID(),scope:'bistro',status:'pending'} as never);
 }
 const fresh={...snapshot,generation:crypto.randomUUID()};await acceptSnapshot(fresh);
 for(const table of [local.commands,local.setups,local.openings,local.purchases,local.transfers,local.counts]){expect(await table.where('scope').equals('grills').count()).toBe(0);expect(await table.where('scope').equals('bistro').count()).toBe(1);}
 expect(await local.snapshots.get('grills')).toEqual(fresh);expect((await local.preferences.get('device'))?.value).toBe('preserved');
});
it('checks the server generation before any upload and removes even pre-generation legacy queues',async()=>{
 await acceptSnapshot({...snapshot,generation:undefined});await saveCommand(command());vi.stubGlobal('navigator',{});
 const requests:string[]=[];vi.stubGlobal('fetch',vi.fn(async(url:string)=>{requests.push(url);return Response.json(snapshot);}));
 await sync('grills');expect(requests.every(url=>url==='/api/v1/bootstrap')).toBe(true);expect(await local.commands.count()).toBe(0);
});
it('retains pending work on a failed preflight and uses the current generation when connectivity returns',async()=>{
 await acceptSnapshot(snapshot);const c=command();await saveCommand(c);vi.stubGlobal('navigator',{});vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
 await expect(sync('grills')).rejects.toThrow('offline');expect((await local.commands.get(c.operationId))?.status).toBe('pending');
 let accepted=false;vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{if(options?.method==='POST'){expect(new Headers(options.headers).get('X-Fodo-Generation')).toBe(generation);accepted=true;return Response.json({operationId:c.operationId,outcome:'accepted'});}return Response.json({...snapshot,acceptedOperationIds:accepted?[c.operationId]:[]});}));
 await sync('grills');expect((await local.commands.get(c.operationId))?.status).toBe('accepted');
});
it('allows a matching recovery archive and rejects old or missing generations without partial writes',async()=>{
 await acceptSnapshot(snapshot);await saveCommand(command());const archive=await recoveryArchive('grills');expect(archive.version).toBe(13);expect(archive.generation).toBe(generation);await local.commands.clear();expect((await restoreRecovery(JSON.stringify(archive),'grills')).newCount).toBe(1);await local.commands.clear();
 for(const stale of [{...archive,generation:crypto.randomUUID()},{...archive,version:8,generation:undefined}])await expect(restoreRecovery(JSON.stringify(stale),'grills')).rejects.toThrow('قبل إعادة');
 expect(await local.commands.count()).toBe(0);
});
it('rejects a stale open form and prevents relabelling old payloads inside a current archive',async()=>{
 await acceptSnapshot(snapshot);const c={...command(),generation};await saveCommand(c);const archive=await recoveryArchive('grills');const fresh={...snapshot,generation:crypto.randomUUID()};await acceptSnapshot(fresh);
 await expect(saveCommand({...c,operationId:crypto.randomUUID()})).rejects.toThrow('قبل إعادة');
 await expect(restoreRecovery(JSON.stringify({...archive,generation:fresh.generation}),'grills')).rejects.toThrow('قبل إعادة');expect(await local.commands.count()).toBe(0);
});
