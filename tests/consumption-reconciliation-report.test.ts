import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createDatabase,seed,postCommand,postCount,postRecipe,postMenuItem,postSalesImport,getSnapshot,getReport} from '@saas/server';
import {reportQuerySchema,type Access,type CountDefinition,type ReportQuery} from '@saas/contracts';
import {decimal} from '@saas/domain';
let db:Awaited<ReturnType<typeof createDatabase>>,generation:string;
const access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()},now=()=>new Date().toISOString();
const q=(extra:Partial<ReportQuery>={})=>reportQuerySchema.parse({organizationId:'grills',generation,kind:'reconciliation',from:'2026-10-10',to:'2026-10-10',locationId:'central',...extra});
async function receive(itemId:string,quantity:string,cost:string,date='2026-10-09'){await postCommand(db,access,{operationId:randomUUID(),organizationId:'grills',locationId:'central',type:'receipt.post',itemId,quantity,unitCost:cost,reason:'Reconciliation fixture',businessDate:date,capturedAt:now(),schemaVersion:1});}
async function physical(date:string,quantities:{itemId:string;unitId:string;quantity:string}[]){
 const s=await getSnapshot(db,access),d:CountDefinition={operationId:randomUUID(),organizationId:'grills',countId:randomUUID(),expectedRevision:0,type:'count.save',locationId:'central',businessDate:date,reason:'Physical observation',cutoffAt:date+'T18:00:00.000Z',stockSequence:s.stockCheckpoints!.find(p=>p.locationId==='central')!.sequence,currency:'EGP',capturedAt:now(),schemaVersion:1,lines:quantities.map(r=>({lineId:randomUUID(),itemId:r.itemId,unitId:r.unitId,expectedQuantity:s.balances.find(b=>b.locationId==='central'&&b.itemId===r.itemId)?.quantity??'0',countedQuantity:r.quantity}))};
 await postCount(db,access,d);await postCount(db,access,{operationId:randomUUID(),organizationId:'grills',countId:d.countId,expectedRevision:1,type:'count.finalize',costPolicy:'explicit',lines:d.lines.map(l=>({lineId:l.lineId,movementId:randomUUID()})),capturedAt:now(),schemaVersion:1});
}
beforeAll(async()=>{
 db=await createDatabase();await seed(db,'moving_average',false);
 await db.exec("INSERT INTO units(organization_id,id,name) VALUES('grills','kg','كجم'),('grills','l','لتر'),('grills','portion','حصة');INSERT INTO locations(organization_id,id,name,kind) VALUES('grills','central','Main','مخزن'),('grills','other','Other','مخزن'),('bistro','foreign','Foreign','مخزن');INSERT INTO items(organization_id,id,name,sku,category,unit,unit_id,minimum) VALUES('grills','rice','Rice','R','Grains','كجم','kg',0),('grills','water','Water','W','Liquid','لتر','l',0);");
 generation=(await getSnapshot(db,access)).generation!;
 // 121 independent receipts prove the report is not reading the operational last-100 snapshot.
 for(let i=0;i<121;i++)await receive('rice','1','10');await receive('water','50','2');
 await physical('2026-10-09',[{itemId:'rice',unitId:'kg',quantity:'121'},{itemId:'water',unitId:'l',quantity:'50'}]);
 const recipeId=randomUUID(),versionId=randomUUID(),menuId=randomUUID(),base={organizationId:'grills',recipeId,capturedAt:now(),schemaVersion:1};
 await postRecipe(db,access,{...base,operationId:randomUUID(),type:'recipe.save',expectedRevision:0,definition:{code:'MEAL',name:'Meal',outputMode:'non_stocked',outputQuantity:'1',outputUnitId:'portion',effectiveDate:'2026-10-09',salesStockItemIds:['rice'],lines:[{lineId:randomUUID(),kind:'material',itemId:'rice',unitId:'kg',inputUnit:'base',enteredQuantity:'1',quantity:'1'},{lineId:randomUUID(),kind:'material',itemId:'water',unitId:'l',inputUnit:'base',enteredQuantity:'2',quantity:'2'}]}});
 await postRecipe(db,access,{...base,operationId:randomUUID(),type:'recipe.publish',expectedRevision:1,versionId});
 await postMenuItem(db,access,{operationId:randomUUID(),organizationId:'grills',type:'menu.save',expectedRevision:0,record:{id:menuId,source:'CSV',code:'MEAL',name:'Meal',versionId,outputPerSale:'1',active:true},capturedAt:now(),schemaVersion:1});
 const sales={operationId:randomUUID(),organizationId:'grills',locationId:'central',type:'sales.import',source:'CSV',reference:'Reconciliation sales',currency:'EGP',completedSalesOnly:true,capturedAt:now(),schemaVersion:1,lines:[{lineId:randomUUID(),transactionId:'ONE',lineKey:'1',businessDate:'2026-10-10',menuItemId:menuId,menuCode:'MEAL',menuName:'Meal',versionId,mappingRevision:1,outputPerSale:'1',quantity:'20',netAmount:'1000'}]};
 await postSalesImport(db,access,sales);await postSalesImport(db,access,{...sales,operationId:randomUUID(),lines:sales.lines.map(l=>({...l,lineId:randomUUID()}))});
 await postCommand(db,access,{operationId:randomUUID(),organizationId:'grills',locationId:'central',type:'waste.post',itemId:'rice',quantity:'2',reason:'Recorded spoilage',businessDate:'2026-10-10',capturedAt:now(),schemaVersion:1});
 await physical('2026-10-10',[{itemId:'rice',unitId:'kg',quantity:'96'},{itemId:'water',unitId:'l',quantity:'25'}]);
});afterAll(async()=>db.close());
it('combines full-history physical counts with unique pinned sales, including unchecked ingredients and different units',async()=>{
 const before=await getSnapshot(db,access),report=await getReport(db,access,q()),after=await getSnapshot(db,access);
 const rice=report.rows.find(r=>r.itemId==='rice')!,water=report.rows.find(r=>r.itemId==='water')!;
 expect(rice.comparison).toMatchObject({opening:'121',closing:'96',actual:'23',theoretical:'20',variance:'3',varianceCost:'30',recorded:'20',waste:'2',selectedRequired:'20',status:'complete'});
 expect(water.comparison).toMatchObject({actual:'25',theoretical:'40',variance:'-15',selectedRequired:'0',recorded:'0',varianceCost:'-30',status:'complete'});
 expect(water.unit).toBe('لتر');expect(rice.unit).toBe('كجم');expect(report.reconciliation).toMatchObject({complete:2,incomplete:0,priced:2,varianceCost:'0',actualCost:'280',theoreticalCost:'280'});
 expect(after.balances).toEqual(before.balances);expect(after.entries).toEqual(before.entries);expect(after.acceptedOperationIds).toEqual(before.acceptedOperationIds);
});
it('binds item/category/search/location filters to physical comparisons without filtering away underlying meal quantities',async()=>{
 const r=await getReport(db,access,q({itemId:'rice',category:'Grains',search:'RICE'}));expect(r.total).toBe(1);expect(r.rows[0].comparison?.theoretical).toBe('20');expect(r.reconciliation?.varianceCost).toBe('30');
 expect((await getReport(db,access,q({locationId:'other'}))).total).toBe(0);expect((await getReport(db,access,q({search:"' OR 1=1 --"}))).total).toBe(0);
 for(const extra of [{organizationId:'bistro'},{locationId:'foreign'},{itemId:'foreign'},{generation:randomUUID()}])await expect(getReport(db,access,q(extra))).rejects.toBeDefined();
 expect(reportQuerySchema.safeParse({...q(),posId:randomUUID()}).success).toBe(false);
});
it('paginates and sorts rows independently of complete totals, with missing counts explicit',async()=>{
 for(let i=0;i<12;i++){const id='extra-'+i;await db.query("INSERT INTO items(organization_id,id,name,sku,category,unit,unit_id,minimum) VALUES('grills',$1,$1,$1,'Extra','كجم','kg',0)",[id]);await receive(id,'1','10','2026-10-10');}
 const one=await getReport(db,access,q({pageSize:10,sort:'quantity_desc'})),two=await getReport(db,access,q({pageSize:10,page:2,sort:'quantity_desc'}));
 expect(one.total).toBe(14);expect(one.rows).toHaveLength(10);expect(two.rows).toHaveLength(4);expect(two.reconciliation).toEqual(one.reconciliation);expect(one.reconciliation).toMatchObject({complete:2,incomplete:12});expect(one.rows[0].itemId).toBe('rice');expect(two.rows.at(-1)?.itemId).toBe('water');
 const incomplete=one.rows.find(r=>r.itemId.startsWith('extra-'))!;expect(incomplete.comparison?.actual).toBeNull();expect(incomplete.comparison?.issues.length).toBeGreaterThan(0);
});
it('a later backdated receipt invalidates physical consumption rather than silently altering an old verified period',async()=>{
 await receive('rice','1','10','2026-10-10');const r=await getReport(db,access,q({itemId:'rice'}));expect(r.rows[0].comparison?.actual).toBeNull();expect(r.rows[0].comparison?.status).toBe('incomplete');expect(r.reconciliation?.priced).toBe(0);expect(decimal(r.rows[0].comparison!.recorded).toNumber()).toBe(20);
});
