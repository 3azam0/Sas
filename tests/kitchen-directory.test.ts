import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createDatabase,seed,getSnapshot,postSetupCommand,postKitchenIssue} from '@saas/server';
import {setupCommandSchema,type Access,type KitchenIssueDocument} from '@saas/contracts';
let db:Awaited<ReturnType<typeof createDatabase>>;
const access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
const save=(id:string,name:string,active=true,expectedRevision=0)=>setupCommandSchema.parse({operationId:randomUUID(),organizationId:'grills',type:'kitchen.save',expectedRevision,record:{id,name,active},capturedAt:new Date().toISOString(),schemaVersion:1});
const issue=(kitchenId:string):KitchenIssueDocument=>({operationId:randomUUID(),organizationId:'grills',locationId:'central',type:'kitchen.issue',kitchenId,kitchen:'Untrusted captured name',businessDate:'2026-10-11',reference:'Lunch shift',notes:'',capturedAt:new Date().toISOString(),schemaVersion:1,currency:'EGP',lines:[{lineId:randomUUID(),itemId:'rice',unitId:'كجم',quantity:'1'}]});
beforeAll(async()=>{db=await createDatabase();await seed(db);});afterAll(async()=>db.close());
it('adds and edits a scoped kitchen with immutable retry and revision conflict handling',async()=>{
 const id=randomUUID(),c=save(id,'Kitchen registry 1');await postSetupCommand(db,access,c);await postSetupCommand(db,access,c);
 expect((await getSnapshot(db,access)).kitchens?.find(k=>k.id===id)).toMatchObject({name:'Kitchen registry 1',revision:1});
 await postSetupCommand(db,access,save(id,'Kitchen registry 2',true,1));
 await expect(postSetupCommand(db,access,save(id,'Stale edit',true,1))).rejects.toMatchObject({code:'REVISION_CONFLICT'});
 expect((await getSnapshot(db,{...access,organizationId:'bistro'})).kitchens).toEqual([]);
 await expect(postSetupCommand(db,{...access,organizationId:'bistro'},save(randomUUID(),'Foreign edit'))).rejects.toMatchObject({code:'FORBIDDEN'});
});
it('retains accepted consumption after rename/delete and rejects new issues to deleted or foreign kitchens',async()=>{
 const id=randomUUID();await postSetupCommand(db,access,save(id,'Kitchen issued'));const d=issue(id);await postKitchenIssue(db,access,d);
 await postSetupCommand(db,access,save(id,'Kitchen renamed',true,1));await postSetupCommand(db,access,save(id,'Kitchen renamed',false,2));
 const s=await getSnapshot(db,access),p=s.kitchenIssues!.find(p=>p.document.operationId===d.operationId)!;expect(p.document.kitchen).toBe('Kitchen issued');expect(p.document.kitchenId).toBe(id);expect(s.kitchens?.find(k=>k.id===id)).toMatchObject({name:'Kitchen renamed',active:false,revision:3});
 await expect(postKitchenIssue(db,access,issue(id))).rejects.toMatchObject({code:'INACTIVE_RECORD'});await expect(postKitchenIssue(db,access,issue(randomUUID()))).rejects.toMatchObject({code:'INVALID_REFERENCE'});
 expect((await postKitchenIssue(db,access,d)).amount).toBe(p.amount); // redelivery after deletion must not consume again
 await postSetupCommand(db,access,save(id,'Kitchen restored',true,3));await postKitchenIssue(db,access,issue(id));
});
it('prevents duplicate active names without losing history and permits a new kitchen after archival',async()=>{
 const id=randomUUID();await postSetupCommand(db,access,save(id,'Unique kitchen'));
 await expect(postSetupCommand(db,access,save(randomUUID(),' UNIQUE KITCHEN '))).rejects.toMatchObject({code:'DUPLICATE_RECORD'});
 await postSetupCommand(db,access,save(id,'Unique kitchen',false,1));await postSetupCommand(db,access,save(randomUUID(),'Unique kitchen'));
 await expect(postSetupCommand(db,access,save(id,'Unique kitchen',true,2))).rejects.toMatchObject({code:'DUPLICATE_RECORD'});
});
