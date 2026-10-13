import 'fake-indexeddb/auto';
import {afterEach,it,expect,vi} from 'vitest';
import {local,acceptSnapshot,saveOpening,saveCommand,sync,recoveryArchive,restoreRecovery,resolveOpening} from '../apps/web/src/offline';
import {projectedQuantity} from '@saas/domain';
import type {OpeningDocument,Snapshot,Command} from '@saas/contracts';
const now=()=>new Date().toISOString();
const snapshot:Snapshot={organizationId:'grills',organizationName:'Fixture',currency:'EGP',access:{organizationId:'grills',userId:'owner',deviceId:crypto.randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()},locations:[{id:'central',name:'Central',kind:'مطعم'}],items:[{id:'rice',name:'Rice',unitId:'kg',unit:'kg',sku:'001',minimum:'0',category:'Food'}],balances:[],layers:[],entries:[],acceptedOperationIds:[],fetchedAt:now()};
const opening=():OpeningDocument=>({operationId:crypto.randomUUID(),organizationId:'grills',locationId:'central',type:'opening.post',businessDate:'2026-10-09',reason:'Opening test',capturedAt:now(),schemaVersion:1,currency:'EGP',lines:[{lineId:crypto.randomUUID(),itemId:'rice',unitId:'kg',quantity:'10',unitCost:'20'}]});
const stock=():Command=>({operationId:crypto.randomUUID(),organizationId:'grills',locationId:'central',type:'waste.post',itemId:'rice',quantity:'2',reason:'Waste test',businessDate:'2026-10-09',capturedAt:now(),schemaVersion:1});
afterEach(async()=>{vi.unstubAllGlobals();await local.openings.clear();await local.commands.clear();await local.setups.clear();await local.snapshots.clear();});
it('preserves opening documents through reload without changing confirmed balances',async()=>{
 await acceptSnapshot(snapshot);const doc=opening();await saveOpening(doc);local.close();await local.open();expect((await local.openings.get(doc.operationId))?.document).toEqual(doc);
 expect((await local.snapshots.get('grills'))?.balances).toHaveLength(0);expect(projectedQuantity(snapshot,[],'central','rice',[doc])).toBe('10.000000');
 await expect(saveOpening(opening())).rejects.toThrow('افتتاحي سابق');
 const accepted={...snapshot,acceptedOperationIds:[doc.operationId],balances:[{locationId:'central',itemId:'rice',quantity:'10',value:'200',average:'20'}]};await acceptSnapshot(accepted);expect(projectedQuantity(accepted,[],'central','rice',[doc])).toBe('10.000000');expect((await local.openings.get(doc.operationId))?.status).toBe('accepted');
});
it('uploads openings before dependent stock commands and reconciles accepted quantities',async()=>{
 await acceptSnapshot(snapshot);const doc=opening(),c=stock();await saveCommand(c);await saveOpening(doc);const calls:string[]=[];vi.stubGlobal('navigator',{});
 vi.stubGlobal('fetch',vi.fn(async(url:string,options?:{body?:string})=>{calls.push(url);if(options?.body){const payload=JSON.parse(options.body);return Response.json({operationId:payload.operationId,outcome:'accepted'});}if(!calls.includes('/api/v1/openings'))return Response.json(snapshot);return Response.json({...snapshot,acceptedOperationIds:calls.includes('/api/v1/commands')?[doc.operationId,c.operationId]:[doc.operationId]});}));
 await sync('grills');expect(calls).toEqual(['/api/v1/bootstrap','/api/v1/openings','/api/v1/bootstrap','/api/v1/commands','/api/v1/bootstrap']);expect((await local.openings.get(doc.operationId))?.status).toBe('accepted');expect((await local.commands.get(c.operationId))?.status).toBe('accepted');
});
it('keeps network failures pending and places rejected dependencies into review',async()=>{
 await acceptSnapshot(snapshot);const doc=opening(),c=stock();await saveOpening(doc);await saveCommand(c);vi.stubGlobal('navigator',{});vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));await expect(sync('grills')).rejects.toThrow('offline');expect((await local.openings.get(doc.operationId))?.status).toBe('pending');
 const calls:string[]=[];vi.stubGlobal('fetch',vi.fn(async(url:string)=>{calls.push(url);return url==='/api/v1/openings'?Response.json({message:'Opening exists'},{status:409}):Response.json(snapshot);}));await sync('grills');expect(calls).not.toContain('/api/v1/commands');expect((await local.commands.get(c.operationId))?.status).toBe('needsReview');expect((await local.openings.get(doc.operationId))?.status).toBe('needsReview');
});
it('exports/restores opening documents in the current archive atomically and rejects conflicting IDs or tenant scope',async()=>{
 await acceptSnapshot(snapshot);const doc=opening(),c=stock();await saveOpening(doc);await saveCommand(c);const archive=await recoveryArchive('grills');expect(archive.version).toBe(17);const text=JSON.stringify(archive);await local.openings.clear();await local.commands.clear();expect((await restoreRecovery(text,'grills')).newCount).toBe(2);expect((await restoreRecovery(text,'grills')).duplicateCount).toBe(2);
 const conflict=JSON.parse(text);conflict.openings[0].document.reason='Changed';await expect(restoreRecovery(JSON.stringify(conflict),'grills')).rejects.toThrow('بيانات مختلفة');
 conflict.openings[0].document.reason=doc.reason;conflict.commands[0].id=doc.lines[0].lineId;conflict.commands[0].command.operationId=doc.lines[0].lineId;await expect(restoreRecovery(JSON.stringify(conflict),'grills')).rejects.toThrow();expect(await local.commands.count()).toBe(1);await expect(restoreRecovery(text,'bistro')).rejects.toThrow('مؤسسة أخرى');
});
it('retains immutable rejected history during correction and validates grant/date/known stock',async()=>{
 await acceptSnapshot(snapshot);const doc=opening();await saveOpening(doc);await expect(resolveOpening('grills',doc.operationId,'cancel')).rejects.toThrow();await local.openings.update(doc.operationId,{status:'needsReview'});const replacement=opening();await saveOpening(replacement,doc.operationId);expect(await local.openings.get(doc.operationId)).toMatchObject({document:doc,status:'superseded',replacementId:replacement.operationId});expect((await local.openings.get(replacement.operationId))?.replacesId).toBe(doc.operationId);
 await expect(saveOpening({...opening(),businessDate:'2099-01-01'})).rejects.toThrow('المستقبل');await acceptSnapshot({...snapshot,access:{...snapshot.access,expiresAt:'2000-01-01T00:00:00Z'}});await expect(saveOpening(opening())).rejects.toThrow('انتهت');
});
