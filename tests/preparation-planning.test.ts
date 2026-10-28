import 'fake-indexeddb/auto';
import {beforeEach,afterEach,it,expect} from 'vitest';
import type {Snapshot,RecipeVersion,ProductionDocument} from '@saas/contracts';
import {preparationPlanSchema,type PreparationPlan} from '../packages/contracts/preparation';
import {preparationRequirements,preparationProgress,preparationSupplyPending} from '../packages/domain/preparation';
import {local,acceptSnapshot} from '../apps/web/src/offline';
import {savePreparationPlan,preparationPlans,preparationBackup,importPreparationBackup} from '../apps/web/src/preparation-store';
const id=()=>crypto.randomUUID(),now=()=>new Date().toISOString(),generation=id(),stockVersion=id(),mealVersion=id(),subVersion=id();
const component=(itemId:string,quantity:string)=>({lineId:id(),kind:'material' as const,itemId,quantity,enteredQuantity:quantity,inputUnit:'base' as const,unitId:'kg'});
const version=(versionId:string,name:string,mode:'stocked'|'non_stocked',lines:any[],outputQuantity='1'):RecipeVersion=>({recipeId:id(),versionId,versionNumber:1,publishedAt:now(),definition:{code:name,name,outputMode:mode,...(mode==='stocked'?{outputItemId:'mix'}:{}),outputQuantity,outputUnitId:'kg',effectiveDate:'2026-10-10',lines}});
const stocked=version(stockVersion,'Mix','stocked',[component('rice','2')],'4'),sub=version(subVersion,'Sauce','non_stocked',[component('rice','1')],'2'),meal=version(mealVersion,'Meal','non_stocked',[component('mix','1'),{lineId:id(),kind:'recipe',versionId:subVersion,quantity:'2',enteredQuantity:'2',inputUnit:'base',unitId:'kg'}],'2');
const snapshot:Snapshot={organizationId:'grills',generation,organizationName:'Test',currency:'EGP',access:{organizationId:'grills',deviceId:id(),userId:'owner',expiresAt:new Date(Date.now()+86400000).toISOString()},locations:[{id:'source',name:'Source',kind:'مخزن'},{id:'kitchen',name:'Kitchen stock',kind:'مخزن',kitchenId:'k'}],kitchens:[{id:'k',name:'Kitchen',locationId:'kitchen',parentLocationId:'source',active:true,revision:1}],units:[{id:'kg',name:'كجم',revision:1}],items:['rice','mix'].map(itemId=>({id:itemId,name:itemId,sku:itemId,unit:'كجم',unitId:'kg',category:'Food',minimum:'0'})),recipeVersions:[stocked,meal,sub],balances:[{locationId:'kitchen',itemId:'rice',quantity:'1',value:'10',average:'10'},{locationId:'source',itemId:'rice',quantity:'2',value:'20',average:'10'},{locationId:'source',itemId:'mix',quantity:'10',value:'50',average:'5'}],layers:[],entries:[],acceptedOperationIds:[stockVersion,mealVersion,subVersion],fetchedAt:now()};
const plan=():PreparationPlan=>({schemaVersion:1,id:id(),organizationId:'grills',generation,revision:0,name:'Daily plan',businessDate:'2026-10-10',kitchenId:'k',sourceLocationId:'source',updatedAt:now(),state:'draft',lines:[{id:id(),versionId:stockVersion,quantity:'8',completed:'0',discarded:'0',note:''},{id:id(),versionId:mealVersion,quantity:'4',completed:'0',discarded:'0',note:''}],links:[]});
const batch=(versionId=stockVersion):ProductionDocument=>({generation,organizationId:'grills',operationId:id(),type:'production.post',versionId,inputLocationId:'kitchen',outputLocationId:'kitchen',outputMovementId:id(),plannedOutput:'8',actualOutput:'6',businessDate:'2026-10-10',reference:'Plan',capturedAt:now(),schemaVersion:1,lines:[{movementId:id(),itemId:'rice',unitId:'kg',quantity:'4',abnormalWaste:'0.5'}]});
beforeEach(async()=>{for(const table of local.tables)await table.clear();await acceptSnapshot(structuredClone(snapshot));});
afterEach(async()=>{for(const table of local.tables)await table.clear();});
it('aggregates scaled recipes and non-stocked children while stopping at stocked preparations',()=>{
 const p=plan(),before=JSON.stringify(snapshot),r=preparationRequirements(snapshot,p);expect(r.materials.map(m=>[m.itemId,m.required,m.available,m.shortage,m.source,m.suggested,m.uncovered])).toEqual([['mix','2','0','2','10','2','0'],['rice','6','1','5','2','2','3']]);expect(JSON.stringify(snapshot)).toBe(before);
});
it('reduces remaining needs only for accepted execution, retains pending/review and follows correction chains once',()=>{
 const p=plan(),d=batch(),link={operationId:d.operationId,lineId:p.lines[0].id,kind:'production' as const};p.links=[link];
 expect(preparationProgress(snapshot,p,[{id:d.operationId,document:d,status:'pending'}])[0]).toMatchObject({actual:'0',remaining:'8',pending:1});
 expect(preparationProgress(snapshot,p,[{id:d.operationId,document:d,status:'needsReview'}])[0].review).toBe(1);
 let r=preparationProgress(snapshot,p,[{id:d.operationId,document:d,status:'accepted'}])[0];expect(r).toMatchObject({actual:'6',remaining:'2',variance:'-2'});
 const replacement={...d,operationId:id()};p.links.push({operationId:replacement.operationId,lineId:p.lines[0].id,kind:'production'});
 r=preparationProgress(snapshot,p,[{id:d.operationId,document:d,status:'superseded',replacementId:replacement.operationId},{id:replacement.operationId,document:replacement,status:'accepted'}])[0];expect(r.actual).toBe('6');expect(r.documents).toHaveLength(1);
 expect(preparationRequirements(snapshot,p,[{id:d.operationId,document:d,status:'accepted'}]).materials.find(m=>m.itemId==='rice')?.required).toBe('3');
});
it('keeps failed output zero, blocks unknown accepted history and ignores cross-scope execution',()=>{
 const p=plan(),d=batch();p.links=[{operationId:d.operationId,lineId:p.lines[0].id,kind:'production'}];
 expect(preparationProgress(snapshot,p,[{id:d.operationId,document:{...d,actualOutput:'0'},status:'accepted'}])[0].remaining).toBe('8');
 expect(()=>preparationRequirements({...snapshot,acceptedOperationIds:[...snapshot.acceptedOperationIds,d.operationId]},p)).toThrow('غير متاحة');
 expect(preparationProgress(snapshot,p,[{id:d.operationId,document:{...d,organizationId:'bistro'},status:'accepted'}])[0].actual).toBe('0');
 expect(preparationProgress(snapshot,p,[{id:d.operationId,document:{...d,inputLocationId:'source'},status:'accepted'}])[0].unknown).toBe(1);
});
it('keeps meal observations stock-free and rounds fractional needs upward after aggregation',()=>{
 const p=plan();p.lines=[{...p.lines[1],quantity:'3',completed:'1',discarded:'1'}];const r=preparationRequirements(snapshot,p);expect(r.progress[0]).toMatchObject({actual:'1',remaining:'2',discarded:'1'});expect(r.materials.find(m=>m.itemId==='mix')?.required).toBe('1');
 const fractional=structuredClone(snapshot);fractional.recipeVersions![1].definition.outputQuantity='3';p.lines[0].quantity='0.000001';p.lines[0].completed='0';expect(preparationRequirements(fractional,p).materials.find(m=>m.itemId==='mix')?.required).toBe('0.000001');
});
it('guards reference/effective-date/unit/activity/scope boundaries and malformed quantities',()=>{
 const p=plan();expect(()=>preparationRequirements(snapshot,{...p,generation:id()})).toThrow('أخرى');expect(()=>preparationRequirements(snapshot,{...p,businessDate:'2026-10-09'})).toThrow('يسري');expect(()=>preparationRequirements(snapshot,{...p,sourceLocationId:'kitchen'})).toThrow('مختلفين');
 const inactive=structuredClone(snapshot);inactive.items[0].active=false;expect(()=>preparationRequirements(inactive,p)).toThrow('غير نشطة');
 expect(preparationPlanSchema.safeParse({...p,lines:[...p.lines,p.lines[0]]}).success).toBe(false);expect(preparationPlanSchema.safeParse({...p,lines:[{...p.lines[0],quantity:'0'}]}).success).toBe(false);expect(preparationPlanSchema.safeParse({...p,lines:[{...p.lines[0],quantity:'1e6'}]}).success).toBe(false);
});
it('saves scoped plans without stock writes, survives database reload and rejects concurrent stale edits',async()=>{
 const p=plan(),first=await savePreparationPlan(p,0);local.close();await local.open();expect((await preparationPlans('grills',generation))[0]).toEqual(first);expect(await preparationPlans('bistro',generation)).toEqual([]);expect(await preparationPlans('grills',id())).toEqual([]);
 await savePreparationPlan({...first,name:'Revised'},1);await expect(savePreparationPlan(first,1)).rejects.toThrow('نافذة أخرى');expect(await local.productions.count()).toBe(0);expect(await local.kitchenIssues.count()).toBe(0);expect((await local.snapshots.get('grills'))?.balances).toEqual(snapshot.balances);
});
it('validates backups, restores into the same scope only and refuses to overwrite differing saved plans',async()=>{
 const p=plan(),text=preparationBackup(p),r=await importPreparationBackup(text,'grills',generation);expect(r.id).toBe(p.id);expect((await importPreparationBackup(text,'grills',generation)).id).toBe(r.id);
 await expect(importPreparationBackup(text,'bistro',generation)).rejects.toThrow('أخرى');await expect(importPreparationBackup(text,'grills',id())).rejects.toThrow('أخرى');await expect(importPreparationBackup(preparationBackup({...p,name:'Altered'}),'grills',generation)).rejects.toThrow('مختلفة');
 await expect(importPreparationBackup(JSON.stringify({format:'fodo-preparation-plan',version:2,plan:p}),'grills',generation)).rejects.toThrow('غير صالح');
});
it('preserves execution links and rejects expired grants and stale generations',async()=>{
 const p=plan(),d=batch();p.links=[{operationId:d.operationId,lineId:p.lines[0].id,kind:'production'}];const saved=await savePreparationPlan(p,0);
 await expect(savePreparationPlan({...saved,links:[]},1)).rejects.toThrow('روابط');await expect(savePreparationPlan({...saved,lines:[{...saved.lines[0],quantity:'4'},saved.lines[1]]},1)).rejects.toThrow('هدف');
 await acceptSnapshot({...snapshot,access:{...snapshot.access,expiresAt:'2000-01-01T00:00:00Z'}});await expect(savePreparationPlan(saved,1)).rejects.toThrow('الجلسة');
 await acceptSnapshot({...snapshot,generation:id()});await expect(savePreparationPlan(saved,1)).rejects.toThrow('أخرى');
});
it('blocks another supply while the linked transfer waits or needs review and clears after acceptance',()=>{
 const p=plan(),operationId=id();p.links=[{operationId,kind:'supply'}];const row={id:operationId,status:'pending',document:{operationId,organizationId:'grills',generation} as any};expect(preparationSupplyPending(snapshot,p,[row])).toBe(true);expect(preparationSupplyPending(snapshot,p,[{...row,status:'needsReview'}])).toBe(true);expect(preparationSupplyPending({...snapshot,acceptedOperationIds:[operationId]},p,[row])).toBe(false);
});
