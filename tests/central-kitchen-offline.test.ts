import 'fake-indexeddb/auto';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {createDatabase,seed,getSnapshot,postCommand,postCentralKitchen} from '@saas/server';
import {local,acceptSnapshot,saveCentral,projectCentralBatches,projectedCentralCommands,recoveryArchive,restoreRecovery,sync,resolveCentral,saveCommand} from '../apps/web/src/offline';
import type {Access,CentralCommand,Snapshot} from '@saas/contracts';
let db:PGlite,s:Snapshot,clock:number,posts:string[];
const uuid=()=>crypto.randomUUID(),access:Access={organizationId:'grills',userId:'warehouse',deviceId:uuid(),role:'operator',expiresAt:new Date(Date.now()+86400000).toISOString()},date='2026-10-10';
function base(batchId:string,revision:number){return {operationId:uuid(),organizationId:'grills',generation:s.generation!,batchId,expectedRevision:revision,businessDate:date,capturedAt:`2026-10-29T10:${String(Math.floor(clock/60)).padStart(2,'0')}:${String(clock++%60).padStart(2,'0')}.000Z`,schemaVersion:1 as const,notes:''};}
const material=(itemId:string,quantity:string)=>({lineId:uuid(),itemId,unitId:'kg',quantity});
async function queue(id:string,type:CentralCommand['type'],extra:Record<string,unknown>={}){const b=projectCentralBatches(s,await local.central.toArray()).find(b=>b.batchId===id);const c={...base(id,b?.revision??0),type,...extra} as CentralCommand;await saveCentral(c);return c;}
beforeEach(async()=>{
 for(const table of local.tables)await table.clear();db=await createDatabase();await seed(db,'moving_average',false);clock=0;posts=[];
 await db.exec("INSERT INTO units(organization_id,id,name) VALUES('grills','kg','كجم');INSERT INTO locations(organization_id,id,name,kind) VALUES('grills','central','Main','مخزن');INSERT INTO items(organization_id,id,name,sku,category,unit,unit_id,minimum) VALUES('grills','beef','Beef','B','Food','كجم','kg',0),('grills','onion','Onion','O','Food','كجم','kg',0),('grills','kofta','Kofta','K','Food','كجم','kg',0);");
 for(const [itemId,quantity,unitCost]of [['beef','10','25'],['onion','10','10']])await postCommand(db,access,{operationId:uuid(),organizationId:'grills',locationId:'central',itemId,quantity,unitCost,type:'receipt.post',reason:'Offline test fixture',businessDate:date,capturedAt:new Date().toISOString(),schemaVersion:1});
 s=await getSnapshot(db,access);await acceptSnapshot(s);vi.stubGlobal('navigator',{});
 vi.stubGlobal('fetch',vi.fn(async(url:string,options?:{body?:string})=>{
  if(!options?.body)return Response.json(await getSnapshot(db,access));
  const command=JSON.parse(options.body);posts.push(command.type);try{return Response.json(url==='/api/v1/central-kitchen'?await postCentralKitchen(db,access,command):await postCommand(db,access,command));}catch(e){const error=e as {status?:number;code?:string;message:string};return Response.json({outcome:'needs_review',code:error.code,message:error.message},{status:error.status??409});}
 }));
});
afterEach(async()=>{vi.unstubAllGlobals();await db.close();for(const table of local.tables)await table.clear();});

it('recovers a complete offline multi-ingredient lifecycle, posts in order and reconciles duplicate delivery',async()=>{
 const id=uuid();await queue(id,'central.create',{name:'Offline kofta',operationType:'butchery',locationId:'central'});
 const beef=material('beef','10'),onion=material('onion','2');await queue(id,'central.issue',{lines:[beef,onion]});await queue(id,'central.receive',{recipient:'Warehouse',lines:[material('kofta','5')]});
 const extra=material('onion','1');await queue(id,'central.issue',{lines:[extra]});await queue(id,'central.return',{recipient:'Warehouse',lines:[{lineId:uuid(),issueLineId:onion.lineId,quantity:'0.5'}]});await queue(id,'central.loss',{lines:[{lineId:uuid(),issueLineId:beef.lineId,quantity:'0.5',kind:'normal',reason:'Normal loss'}]});await queue(id,'central.receive',{recipient:'Warehouse',lines:[material('kofta','7')]});await queue(id,'central.cost',{amount:'25',reason:'Processing'});
 await queue(id,'central.close',{consumption:[{issueLineId:beef.lineId,quantity:'9.5'},{issueLineId:onion.lineId,quantity:'1.5'},{issueLineId:extra.lineId,quantity:'1'}],allocations:[],balanceReason:''});
 expect(projectedCentralCommands(s,await local.central.toArray()).every(c=>c.type==='waste.post')).toBe(true);expect((await getSnapshot(db,access)).balances).toEqual(s.balances);
 const archive=await recoveryArchive('grills');expect(archive.version).toBe(25);expect(archive.central).toHaveLength(9);await local.central.clear();expect((await restoreRecovery(JSON.stringify(archive),'grills')).newCount).toBe(9);expect((await restoreRecovery(JSON.stringify(archive),'grills')).duplicateCount).toBe(9);
 await sync('grills');const after=await getSnapshot(db,access);expect(posts).toEqual([...archive.central!].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).map(r=>r.command.type));expect(after.centralBatches![0]).toMatchObject({status:'closed',wipAmount:'0.000000000000',outputAmount:'300.000000000000'});expect(after.balances.find(b=>b.itemId==='kofta')).toMatchObject({quantity:'12.000000',value:'300.000000000000'});expect((await local.central.toArray()).every(r=>r.status==='accepted')).toBe(true);
 await local.central.update(archive.central![1].id,{status:'acceptedAwaiting'});const before=after.balances;await sync('grills');expect((await getSnapshot(db,access)).balances).toEqual(before);expect((await local.central.get(archive.central![1].id))?.status).toBe('accepted');
});

it('reserves pending material issues across batches and includes all line identities in recovery validation',async()=>{
 const id=uuid();await queue(id,'central.create',{name:'One',operationType:'manufacturing',locationId:'central'});const line=material('beef','7');await queue(id,'central.issue',{lines:[line]});
 const next=uuid();await queue(next,'central.create',{name:'Two',operationType:'manufacturing',locationId:'central'});await expect(queue(next,'central.issue',{lines:[material('beef','4')]})).rejects.toThrow('لا يكفي');
 const archive=await recoveryArchive('grills'),forged=structuredClone(archive);forged.central![1].command={...base(next,1),type:'central.issue',lines:[line]};forged.central![1].id=forged.central![1].command.operationId;await expect(restoreRecovery(JSON.stringify(forged),'grills')).rejects.toThrow('معرّف');
 await expect(restoreRecovery(JSON.stringify({...archive,version:24}),'grills')).rejects.toThrow('غير صالح');await expect(restoreRecovery(JSON.stringify(archive),'bistro')).rejects.toThrow('مؤسسة أخرى');
});

it('keeps failed issues and dependent operations actionable and does not consume their stock twice',async()=>{
 const id=uuid();await queue(id,'central.create',{name:'Conflict',operationType:'manufacturing',locationId:'central'});const issue=await queue(id,'central.issue',{lines:[material('beef','5')]});const receive=await queue(id,'central.receive',{recipient:'Warehouse',lines:[material('kofta','5')]});
 await saveCommand({operationId:uuid(),organizationId:'grills',generation:s.generation,locationId:'central',itemId:'beef',type:'waste.post',quantity:'1',reason:'Later dependent issue',businessDate:date,capturedAt:'2026-10-29T11:00:00.000Z',schemaVersion:1});
 await postCommand(db,access,{operationId:uuid(),organizationId:'grills',locationId:'central',itemId:'beef',type:'waste.post',quantity:'8',reason:'Concurrent device',businessDate:date,capturedAt:new Date().toISOString(),schemaVersion:1});await sync('grills');
 expect((await local.central.get(issue.operationId))?.status).toBe('needsReview');expect((await local.central.get(receive.operationId))?.status).toBe('needsReview');expect((await local.commands.toArray())[0].status).toBe('needsReview');expect(posts).not.toContain('waste.post');
 await postCommand(db,access,{operationId:uuid(),organizationId:'grills',locationId:'central',itemId:'beef',type:'receipt.post',quantity:'10',unitCost:'25',reason:'Replenish',businessDate:date,capturedAt:new Date().toISOString(),schemaVersion:1});await resolveCentral('grills',issue.operationId,'retry');await sync('grills');expect((await local.central.get(issue.operationId))?.status).toBe('accepted');
 await resolveCentral('grills',receive.operationId,'retry');await sync('grills');expect((await local.central.get(receive.operationId))?.status).toBe('accepted');
});

it('enforces capability/grant/generation and clears only the reset tenant queue',async()=>{
 const id=uuid(),create={...base(id,0),type:'central.create' as const,name:'Grant check',operationType:'butchery' as const,locationId:'central'};
 await acceptSnapshot({...s,capabilities:{counterPOS:1}});await expect(saveCentral(create)).rejects.toThrow('خدمة');await acceptSnapshot({...s,access:{...access,role:'viewer'}});await expect(saveCentral(create)).rejects.toThrow('للعرض');await acceptSnapshot(s);
 await saveCentral(create);await local.central.add({id:uuid(),scope:'bistro',command:{...create,operationId:uuid(),organizationId:'bistro'},createdAt:create.capturedAt,status:'pending'});await acceptSnapshot({...s,generation:uuid()});expect(await local.central.where('scope').equals('grills').count()).toBe(0);expect(await local.central.where('scope').equals('bistro').count()).toBe(1);await expect(saveCentral(create)).rejects.toThrow('قبل إعادة');
});
