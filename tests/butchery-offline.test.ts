import 'fake-indexeddb/auto';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {local,acceptSnapshot,saveButchery,resolveButchery,projectedButcheryCommands,recoveryArchive,restoreRecovery,sync,saveCommand,saveCount,projectCounts} from '../apps/web/src/offline';
import type {Snapshot} from '@saas/contracts';
import type {ButcheryCommand} from '../packages/contracts/butchery';
const now=()=>new Date().toISOString(),generation=crypto.randomUUID();
const snapshot:Snapshot={generation,organizationId:'grills',organizationName:'Test',currency:'EGP',access:{organizationId:'grills',userId:'owner',deviceId:crypto.randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()},locations:[{id:'central',name:'Central',kind:'مطبخ'}],units:[{id:'kg',name:'كجم',revision:1}],items:[{id:'beef',name:'Beef',sku:'B',category:'Food',unit:'كجم',unitId:'kg',minimum:'0'},{id:'cut',name:'Cut',sku:'C',category:'Food',unit:'كجم',unitId:'kg',minimum:'0'}],butcheryCatalog:[{itemId:'beef',unitId:'kg',meatKind:'beef_input'},{itemId:'cut',unitId:'kg',meatKind:'beef_product'}],balances:[{locationId:'central',itemId:'beef',quantity:'10',value:'1000',average:'100'}],layers:[],entries:[],acceptedOperationIds:[],stockCheckpoints:[{locationId:'central',sequence:'0'}],fetchedAt:now()};
const base=(capturedAt=now())=>({generation,operationId:crypto.randomUUID(),organizationId:'grills',businessDate:'2026-10-26',capturedAt,schemaVersion:1 as const,reason:'اختبار جزارة'});
const batch=(capturedAt=now()):ButcheryCommand=>({...base(capturedAt),type:'butchery.process',locationId:'central',itemId:'beef',mode:'beef',quantity:'10',processingCost:'100',slaughterLoss:'0',cuttingLoss:'1',outputs:[{itemId:'cut',quantity:'9',costShare:'100'}]});
async function clear(){for(const table of local.tables)await table.clear();}
beforeEach(async()=>{await clear();await acceptSnapshot(snapshot);});afterEach(async()=>{vi.unstubAllGlobals();await clear();});

it('persists butchery, preserves confirmed stock and round-trips recovery22 without trusting acceptance',async()=>{
 const c=batch();await saveButchery(c);local.close();await local.open();expect((await local.butchery.get(c.operationId))?.status).toBe('pending');
 expect(projectedButcheryCommands(snapshot,await local.butchery.toArray()).map(c=>[c.itemId,c.type,c.quantity])).toEqual([['beef','waste.post','10'],['cut','receipt.post','9']]);
 expect((await local.snapshots.get('grills'))?.balances).toEqual(snapshot.balances);
 const archive=await recoveryArchive('grills');expect(archive.version).toBe(22);archive.butchery[0].status='accepted';await local.butchery.clear();
 expect((await restoreRecovery(JSON.stringify(archive),'grills')).newCount).toBe(1);expect((await local.butchery.get(c.operationId))?.status).toBe('pending');expect((await restoreRecovery(JSON.stringify(archive),'grills')).duplicateCount).toBe(1);
 const conflict=structuredClone(archive);conflict.butchery[0].command.reason='Different payload';await expect(restoreRecovery(JSON.stringify(conflict),'grills')).rejects.toThrow('بيانات مختلفة');
 await expect(restoreRecovery(JSON.stringify({...archive,version:21}),'grills')).rejects.toThrow('غير صالح');await expect(restoreRecovery(JSON.stringify({...archive,generation:crypto.randomUUID()}),'grills')).rejects.toThrow('نسخة سابقة');
 await acceptSnapshot({...snapshot,acceptedOperationIds:[c.operationId]});expect((await local.butchery.get(c.operationId))?.status).toBe('accepted');expect(projectedButcheryCommands({...snapshot,acceptedOperationIds:[c.operationId]},await local.butchery.toArray())).toEqual([]);
});

it('uploads catalog before processing and processing before dependent issues, exactly once',async()=>{
 const create:ButcheryCommand={...base('2026-10-26T10:00:00Z'),type:'product.create',itemId:crypto.randomUUID(),name:'Custom product',unitId:'kg',meatKind:'beef_product'};await saveButchery(create);const c=batch('2026-10-26T10:01:00Z');await saveButchery(c);
 await saveCommand({...base('2026-10-26T10:02:00Z'),type:'waste.post',locationId:'central',itemId:'cut',quantity:'1'});
 let server=snapshot;const posts:string[]=[];vi.stubGlobal('navigator',{});vi.stubGlobal('fetch',vi.fn(async(_url:string,opt?:{body?:string})=>{if(!opt?.body)return Response.json(server);const command=JSON.parse(opt.body);posts.push(command.type);server={...server,acceptedOperationIds:[...server.acceptedOperationIds,command.operationId]};return Response.json({operationId:command.operationId,outcome:'accepted'});}));
 await sync('grills');expect(posts).toEqual(['product.create','butchery.process','waste.post']);await sync('grills');expect(posts).toHaveLength(3);expect((await local.butchery.get(c.operationId))?.status).toBe('accepted');
});

it('preserves authorization failures and keeps rejected processing/count approval reviewable',async()=>{
 const c=batch('2026-10-26T10:01:00Z');await saveButchery(c);vi.stubGlobal('navigator',{});vi.stubGlobal('fetch',vi.fn(async(_url:string,opt?:{body?:string})=>opt?.body?Response.json({message:'Renew'},{status:401}):Response.json(snapshot)));await expect(sync('grills')).rejects.toThrow('محفوظة');expect((await local.butchery.get(c.operationId))?.status).toBe('pending');
 const countId=crypto.randomUUID(),lineId=crypto.randomUUID();await saveCount({...base(),type:'count.save',countId,expectedRevision:0,locationId:'central',cutoffAt:now(),stockSequence:'0',currency:'EGP',lines:[{lineId,itemId:'beef',unitId:'kg',expectedQuantity:'10',countedQuantity:'10'}]});const finalId=crypto.randomUUID();await saveCount({generation,organizationId:'grills',operationId:finalId,countId,expectedRevision:1,type:'count.finalize',costPolicy:'explicit',lines:[{lineId,movementId:crypto.randomUUID()}],capturedAt:now(),schemaVersion:1});
 let server=snapshot;vi.stubGlobal('fetch',vi.fn(async(url:string,opt?:{body?:string})=>{if(!opt?.body)return Response.json(server);const command=JSON.parse(opt.body);if(url==='/api/v1/butchery')return Response.json({message:'Insufficient stock'},{status:409});if(command.type==='count.save')server={...server,counts:projectCounts(server,[{id:command.operationId,scope:'grills',command,status:'pending',createdAt:command.capturedAt}]),acceptedOperationIds:[...server.acceptedOperationIds,command.operationId]};return Response.json({operationId:command.operationId,outcome:'accepted'});}));
 await sync('grills');expect((await local.butchery.get(c.operationId))?.status).toBe('needsReview');expect((await local.counts.get(finalId))?.error).toContain('معلقة');await resolveButchery('grills',c.operationId,'cancel');expect((await local.butchery.get(c.operationId))?.status).toBe('cancelled');
});

it('reserves identities across queues and clears stale-generation work without affecting another tenant',async()=>{
 const c=batch();await saveButchery(c);await expect(saveCommand({...base(),operationId:c.operationId,type:'waste.post',locationId:'central',itemId:'beef',quantity:'1'})).rejects.toThrow('مستخدم');
 await local.butchery.add({id:crypto.randomUUID(),scope:'bistro',command:{...batch(),organizationId:'bistro'},status:'pending',createdAt:now()});await acceptSnapshot({...snapshot,generation:crypto.randomUUID()});expect(await local.butchery.where('scope').equals('grills').count()).toBe(0);expect(await local.butchery.where('scope').equals('bistro').count()).toBe(1);
 await acceptSnapshot({...snapshot,access:{...snapshot.access,expiresAt:'2000-01-01T00:00:00Z'}});await expect(saveButchery(batch())).rejects.toThrow('انتهت');
});
