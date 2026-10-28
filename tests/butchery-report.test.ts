import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createDatabase,seed,postButchery,postCommand,getReport,getSnapshot} from '@saas/server';
import {reportQuerySchema,type Access} from '@saas/contracts';
let db:Awaited<ReturnType<typeof createDatabase>>,generation:string,beef:string,lamb:string,meat:string,organs:string;
const org='grills',access:Access={organizationId:org,userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
const base=(date='2026-10-10')=>({operationId:randomUUID(),organizationId:org,generation,businessDate:date,capturedAt:new Date().toISOString(),schemaVersion:1 as const,reason:'Report fixture'});
const query=(extra:Record<string,unknown>={})=>reportQuerySchema.parse({organizationId:org,generation,kind:'butchery',from:'2026-10-10',to:'2026-10-10',...extra});
beforeAll(async()=>{
 db=await createDatabase();await seed(db,'fifo',false);await db.query("INSERT INTO units(organization_id,id,name) VALUES('grills','kg','كجم')");await db.query("INSERT INTO locations(organization_id,id,name,kind) VALUES('grills','main','Main','مخزن')");generation=(await getSnapshot(db,access)).generation!;
 const product=async(meatKind:'beef_input'|'sheep_live'|'beef_product'|'lamb_product',name:string)=>{const itemId=randomUUID();await postButchery(db,access,{...base(),type:'product.create',itemId,name,unitId:'kg',meatKind});return itemId;};
 beef=await product('beef_input','خام بقري');lamb=await product('sheep_live','ضأن حي');meat=await product('lamb_product','لحم ضأن');organs=await product('lamb_product','أحشاء صالحة');const beefMeat=await product('beef_product','لحم مقطع');
 for(const [itemId,quantity,unitCost] of [[beef,'100','10'],[lamb,'100','50']])await postCommand(db,access,{...base('2026-10-09'),type:'receipt.post',locationId:'main',itemId,quantity,unitCost});
 const processBeef=async(quantity:string,output:string,loss:string,cost:string,date='2026-10-10')=>postButchery(db,access,{...base(date),type:'butchery.process',locationId:'main',mode:'beef',itemId:beef,quantity,slaughterLoss:'0',cuttingLoss:loss,processingCost:cost,outputs:[{itemId:beefMeat,quantity:output,costShare:'100'}]});
 for(let i=0;i<10;i++)await processBeef('1','0.9','0.1','1');await processBeef('10','8','2','5');await processBeef('2','1.8','0.2','2','2026-10-09');
 await postButchery(db,access,{...base(),type:'butchery.process',mode:'lamb',locationId:'main',itemId:lamb,quantity:'100',headCount:2,carcassWeight:'60',slaughterLoss:'40',cuttingLoss:'10',processingCost:'200',outputs:[{itemId:meat,quantity:'40',costShare:'100'},{itemId:organs,quantity:'10',costShare:'0'}]});
 await postCommand(db,access,{...base('2026-10-11'),type:'receipt.post',locationId:'main',itemId:meat,quantity:'1',unitCost:'999'});
},120000);
afterAll(async()=>{await db.close();});
it('reports full-range weighted yields and historical costs by processing mode independently of paging',async()=>{
 const first=await getReport(db,access,query({pageSize:10})),second=await getReport(db,access,query({pageSize:10,page:2}));expect(first.total).toBe(12);expect(second.rows).toHaveLength(2);expect(first.butchery).toEqual(second.butchery);
 const b=first.butchery!.current.find(r=>r.mode==='beef')!,l=first.butchery!.current.find(r=>r.mode==='lamb')!;
 expect(b.batches).toBe(11);expect(Number(b.inputWeight)).toBe(20);expect(Number(b.outputWeight)).toBe(17);expect(Number(b.yieldPercent)).toBe(85);expect(Number(b.totalCost)).toBe(215);expect(Number(b.processingCost)).toBe(15);
 expect(l.batches).toBe(1);expect(l.headCount).toBe(2);expect(Number(l.yieldPercent)).toBe(50);expect(Number(l.carcassYieldPercent)).toBe(60);expect(Number(l.cuttingYieldPercent)).toBeCloseTo(83.333333);expect(Number(l.unitCost)).toBe(104);expect(Number(l.totalCost)).toBe(5200);
 expect(Number(first.butchery!.previous.find(r=>r.mode==='beef')?.totalCost)).toBe(22);expect(first.butchery!.previous.find(r=>r.mode==='lamb')?.yieldPercent).toBeNull();
});
it('finds complete batches by output name, preserves zero cost shares and supports raw-material filtering',async()=>{
 const report=await getReport(db,access,query({search:'أحشاء'}));expect(report.total).toBe(1);expect(report.rows[0].butchery?.outputs).toHaveLength(2);expect(Number(report.rows[0].amount)).toBe(5200);
 const free=report.rows[0].butchery!.outputs.find(r=>r.itemId===organs)!;expect(Number(free.costShare)).toBe(0);expect(Number(free.amount)).toBe(0);expect(Number(free.unitCost)).toBe(0);
 expect(Number(report.rows[0].butchery!.outputs.find(r=>r.itemId===meat)?.unitCost)).toBe(130);
 const raw=await getReport(db,access,query({itemId:beef}));expect(raw.total).toBe(11);expect(raw.rows.every(r=>r.itemId===beef)).toBe(true);
 const lambOnly=await getReport(db,access,query({butcheryMode:'lamb'}));expect(lambOnly.total).toBe(1);expect(lambOnly.butchery!.current.find(r=>r.mode==='beef')?.batches).toBe(0);expect(lambOnly.rows[0].butchery?.mode).toBe('lamb');
 const byId=await getReport(db,access,query({search:report.rows[0].id}));expect(byId.total).toBe(1);
});
it('returns empty mode summaries safely and never writes stock or classifications while reporting',async()=>{
 const before=await getSnapshot(db,access),empty=await getReport(db,access,query({from:'2026-10-12',to:'2026-10-12'}));expect(empty.total).toBe(0);expect(empty.butchery!.current.every(r=>r.batches===0&&r.unitCost===null&&r.yieldPercent===null)).toBe(true);
 expect((await getReport(db,access,query({search:"%' OR true --"}))).total).toBe(0);
 await expect(getReport(db,{...access,organizationId:'bistro'},query())).rejects.toMatchObject({code:'FORBIDDEN'});
 await expect(getReport(db,access,query({generation:randomUUID()}))).rejects.toMatchObject({code:'STALE_GENERATION'});
 expect(reportQuerySchema.safeParse({...query(),kind:'stockCard',butcheryMode:'lamb'}).success).toBe(false);
 const after=await getSnapshot(db,access);expect(after.balances).toEqual(before.balances);expect(after.layers).toEqual(before.layers);expect(after.entries).toEqual(before.entries);expect(after.butcheryCatalog).toEqual(before.butcheryCatalog);
});
