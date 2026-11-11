import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createDatabase,seed,getReport,getSnapshot,postSetupCommand,postCommand,postKitchenIssue} from '@saas/server';
import {reportQuerySchema,type Access,type KitchenIssueDocument} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {postDocumentCorrection} from '../packages/server/document-corrections';

it('reports complete kitchen supply history once, including destination scope and transfers from another kitchen',async()=>{
 const db=await createDatabase(),org='grills',date='2026-10-10',now=()=>new Date().toISOString();
 const access:Access={organizationId:org,userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
 const setup=async(type:string,record:unknown)=>postSetupCommand(db,access,{operationId:randomUUID(),organizationId:org,type,record,expectedRevision:0,capturedAt:now(),schemaVersion:1});
 const query=(extra:Record<string,unknown>={})=>reportQuerySchema.parse({organizationId:org,kind:'kitchenSupply',from:date,to:date,...extra});
 try{
  await seed(db,'moving_average',false);
  await setup('unit.save',{id:'kg',name:'kg'});await setup('unit.save',{id:'litre',name:'litre'});await setup('location.save',{id:'main',name:'Main',kind:'مخزن',active:true});
  await setup('item.save',{id:'rice',name:'Rice',sku:'RICE',category:'Food',unitId:'kg',minimum:'0',purchaseUnits:[],active:true});
  await setup('item.save',{id:'oil',name:'Oil',sku:'OIL',category:'Food',unitId:'litre',minimum:'0',purchaseUnits:[],active:true});
  for(const id of ['k1','k2'])await setup('kitchen.save',{id,name:'Kitchen '+id,locationId:id,parentLocationId:'main',active:true});
  await postCommand(db,access,{operationId:randomUUID(),organizationId:org,locationId:'main',type:'receipt.post',itemId:'rice',quantity:'200',unitCost:'10',reason:'Receive',businessDate:date,capturedAt:now(),schemaVersion:1});
  await postCommand(db,access,{operationId:randomUUID(),organizationId:org,locationId:'main',type:'receipt.post',itemId:'oil',quantity:'20',unitCost:'5',reason:'Receive oil',businessDate:date,capturedAt:now(),schemaVersion:1});
  const transfer=(source:string,destination:string,quantity:string):KitchenIssueDocument=>({operationId:randomUUID(),organizationId:org,locationId:source,destinationLocationId:destination,kitchenId:destination,kitchen:'Captured',type:'kitchen.transfer',businessDate:date,reference:'Supply test',notes:'',currency:'EGP',capturedAt:now(),schemaVersion:1,lines:[{lineId:randomUUID(),itemId:'rice',unitId:'kg',quantity}]});
  // Real posting tests verify the report against paired incoming/outgoing ledger entries.
  for(let index=0;index<101;index++){const d=transfer('main','k1','1');d.lines[0].unitPrice='12';if(index===0)d.lines.push({lineId:randomUUID(),itemId:'oil',unitId:'litre',quantity:'2',unitPrice:'0'});await postKitchenIssue(db,access,d);}
  await postKitchenIssue(db,access,{...transfer('main','k1','1'),businessDate:'2026-10-09'});
  const nested=transfer('k1','k2','2');nested.lines[0].unitPrice='7';await postKitchenIssue(db,access,nested);
  await postKitchenIssue(db,access,{...transfer('main','k1','3'),type:'kitchen.issue',kitchenId:undefined,destinationLocationId:undefined,kitchen:'Legacy kitchen'});
  const before=await getSnapshot(db,access),all=await getReport(db,access,query()),page=await getReport(db,access,query({page:2,pageSize:100}));
  const byItem=await getReport(db,access,{...query(),kind:'kitchenSupplyByItem'});
  expect(byItem.rows.map(row=>[row.itemId,Number(row.quantity)])).toEqual([['oil',2],['rice',106]]);
  expect(byItem.kitchenSupplyKitchens).toEqual([
   {key:'kitchen:k1',label:'Kitchen k1'},{key:'kitchen:k2',label:'Kitchen k2'},{key:'legacy:Legacy kitchen',label:'Legacy kitchen (سابق)'}
  ]);
  expect(Object.fromEntries(Object.entries(byItem.rows[1].kitchenQuantities??{}).map(([key,quantity])=>[key,Number(quantity)])))
   .toEqual({'kitchen:k1':101,'kitchen:k2':2,'legacy:Legacy kitchen':3});
  expect(before.kitchenIssues).toHaveLength(100);expect(all.total).toBe(104);expect(page.rows).toHaveLength(4);expect(page.current).toEqual(all.current);
  expect(Number(all.current.kitchenSupplyCost)).toBe(1070);
  expect(Number(byItem.current.kitchenSupplyCost)).toBe(1070);
  expect(byItem.rows.map(row=>Number(row.kitchenSupplyCost))).toEqual([10,1060]);
  expect(Object.fromEntries(Object.entries(byItem.rows[1].kitchenCosts??{}).map(([key,value])=>[key,Number(value)])))
   .toEqual({'kitchen:k1':1010,'kitchen:k2':20,'legacy:Legacy kitchen':30});
  expect(all.current.kitchenSupplyDocuments).toBe(103);expect(all.current.kitchenSupplyItems).toBe(2);
  expect(Number(all.current.kitchenDocumentAmount)).toBe(1226);expect(Number(all.current.kitchenDocumentCost)).toBe(1040);expect(all.current.kitchenDocumentUnpriced).toBe(1);
  expect(Number(all.previous.kitchenDocumentAmount)).toBe(0);expect(all.previous.kitchenDocumentUnpriced).toBe(1);
  const allRows=[...all.rows,...(await getReport(db,access,query({pageSize:100}))).rows,...page.rows];
  expect(allRows.find(r=>r.itemId==='oil')?.documentUnitPrice).toBe('0');expect(Number(allRows.find(r=>r.itemId==='oil')?.documentAmount)).toBe(0);
  const legacy=allRows.find(r=>r.type==='kitchen.issue');expect(legacy?.documentUnitPrice).toBeNull();expect(legacy?.documentAmount).toBeNull();expect(legacy?.documentDifference).toBeNull();
  expect(decimal(all.current.kitchenTransferOut!).eq('1040')).toBe(true);expect(decimal(all.current.kitchenLegacyIssue!).eq('30')).toBe(true);
  expect(decimal(all.charts.daily[0].kitchenSupply!).eq('1040')).toBe(true);expect(decimal(all.charts.daily[0].kitchenLegacyIssue!).eq('30')).toBe(true);
  expect(all.charts.kitchenSupply?.find(k=>k.key==='k2')?.value).toBe('20.000000000000');
  expect(Number(all.previous.kitchenTransferOut)).toBe(10);expect(all.previous.kitchenSupplyDocuments).toBe(1);
  const dest=await getReport(db,access,query({locationId:'k2',kitchenId:'k2'}));expect(dest.total).toBe(1);expect(dest.rows[0].documentId).toBe(nested.operationId);expect(dest.rows[0].locationId).toBe('k1');expect(dest.rows[0].kitchenName).toBe('Kitchen k2');expect(Number(dest.rows[0].quantity)).toBe(2);expect(Number(dest.rows[0].unitCost)).toBe(10);
  expect(Number(dest.rows[0].documentUnitPrice)).toBe(7);expect(Number(dest.rows[0].documentAmount)).toBe(14);expect(Number(dest.rows[0].documentDifference)).toBe(-6);expect(Number(dest.current.kitchenDocumentAmount)).toBe(14);
  const filtered=await getReport(db,access,query({locationId:'main',kitchenId:'k1',category:'Food',itemId:'rice',search:'Supply test'}));expect(filtered.total).toBe(101);expect(Number(filtered.current.kitchenTransferOut)).toBe(1010);expect(filtered.current.kitchenSupplyDocuments).toBe(101);
  const byDocument=await getReport(db,access,query({search:'KI-'+nested.operationId.toUpperCase()}));expect(byDocument.total).toBe(1);
  const empty=await getReport(db,access,query({from:'2026-10-01',to:'2026-10-02'}));expect(empty.total).toBe(0);expect(empty.current.kitchenSupplyDocuments).toBe(0);expect(empty.charts.kitchenSupply).toEqual([]);
  expect(Number(empty.current.kitchenDocumentAmount)).toBe(0);expect(empty.current.kitchenDocumentUnpriced).toBe(0);
  await expect(getReport(db,{...access,organizationId:'bistro'},query())).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(getReport(db,access,query({locationId:'foreign'}))).rejects.toMatchObject({code:'FORBIDDEN'});
  const after=await getSnapshot(db,access);expect(after.balances).toEqual(before.balances);expect(after.acceptedOperationIds).toEqual(before.acceptedOperationIds);
 }finally{await db.close();}
},120000);

it('allows kitchen filters for supply and consumption reports while rejecting them elsewhere',()=>{
 const base={organizationId:'grills',from:'2026-10-10',to:'2026-10-10',kitchenId:'k1'};
 expect(reportQuerySchema.safeParse({...base,kind:'kitchenSupply'}).success).toBe(true);
 expect(reportQuerySchema.safeParse({...base,kind:'kitchens'}).success).toBe(true);
 expect(reportQuerySchema.safeParse({...base,kind:'purchasing'}).success).toBe(false);
});

it.each(['fifo','moving_average'] as const)('separates a priced document from blended %s allocations without changing stock',async method=>{
 const db=await createDatabase(),org='grills',date='2026-10-10',now=new Date().toISOString();
 const access:Access={organizationId:org,userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
 try{
  await seed(db,method,false);
  for(const [type,record] of [['unit.save',{id:'kg',name:'kg'}],['location.save',{id:'main',name:'Main',kind:'مخزن',active:true}],['item.save',{id:'rice',name:'Rice',sku:'RICE',category:'Food',unitId:'kg',minimum:'0',purchaseUnits:[],active:true}],['kitchen.save',{id:'k1',name:'Kitchen',locationId:'k1',parentLocationId:'main',active:true}]] as const)await postSetupCommand(db,access,{operationId:randomUUID(),organizationId:org,type,record,expectedRevision:0,capturedAt:now,schemaVersion:1});
  for(const unitCost of ['10','20'])await postCommand(db,access,{operationId:randomUUID(),organizationId:org,locationId:'main',type:'receipt.post',itemId:'rice',quantity:'1',unitCost,reason:'Receive',businessDate:date,capturedAt:now,schemaVersion:1});
  await postKitchenIssue(db,access,{operationId:randomUUID(),organizationId:org,locationId:'main',destinationLocationId:'k1',kitchenId:'k1',kitchen:'Kitchen',type:'kitchen.transfer',businessDate:date,reference:'Blended',notes:'',currency:'EGP',capturedAt:now,schemaVersion:1,lines:[{lineId:randomUUID(),itemId:'rice',unitId:'kg',quantity:'2',unitPrice:'25'}]});
  const before=await getSnapshot(db,access);
  for(const locationId of ['','main','k1']){
   const report=await getReport(db,access,reportQuerySchema.parse({organizationId:org,kind:'kitchenSupply',from:date,to:date,locationId}));
   expect(report.total).toBe(1);expect(report.current.kitchenSupplyDocuments).toBe(1);expect(Number(report.rows[0].unitCost)).toBe(15);expect(Number(report.rows[0].amount)).toBe(30);expect(Number(report.rows[0].documentAmount)).toBe(50);expect(Number(report.rows[0].documentDifference)).toBe(20);expect(Number(report.current.kitchenDocumentAmount)).toBe(50);expect(Number(report.current.kitchenDocumentCost)).toBe(30);
  }
  const after=await getSnapshot(db,access);expect(after.balances).toEqual(before.balances);expect(after.entries).toEqual(before.entries);expect(Number(after.balances.find(b=>b.locationId==='k1')?.value)).toBe(30);
 }finally{await db.close();}
},60000);

it('groups effective kitchen issue quantities by item, document date and receiving kitchen',async()=>{
 const db=await createDatabase(),org='grills',date='2026-10-10',now=()=>new Date().toISOString();
 const access:Access={organizationId:org,userId:'owner',role:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
 try{
  await seed(db,'moving_average',false);
  await db.exec(`
   INSERT INTO units(organization_id,id,name,revision) VALUES('grills','kg','كجم',1),('grills','litre','لتر',1);
   INSERT INTO locations(organization_id,id,name,kind) VALUES('grills','main','Main','stock'),('grills','k1','Kitchen 1','kitchen'),('grills','k2','Kitchen 2','kitchen'),('grills','k3','Kitchen 3','kitchen');
   INSERT INTO kitchens(organization_id,id,name,active,revision,location_id,parent_location_id) VALUES('grills','k1','Kitchen 1',true,1,'k1','main'),('grills','k2','Kitchen 2',true,1,'k2','main'),('grills','k3','Kitchen 3',true,1,'k3','main');
   INSERT INTO items(organization_id,id,name,sku,category,unit,unit_id,minimum) VALUES
    ('grills','rice','Rice','RICE','Food','كجم','kg',0),('grills','oil','Oil','OIL','Food','لتر','litre',0);
  `);
  const generation=(await getSnapshot(db,access)).generation!;
  const base=()=>({organizationId:org,generation,operationId:randomUUID(),locationId:'main',businessDate:date,capturedAt:now(),schemaVersion:1 as const});
  for(const itemId of ['rice','oil'])await postCommand(db,access,{...base(),type:'receipt.post',itemId,quantity:'50',unitCost:'2',reason:'Test stock'});
  const transfer=(quantity:string,businessDate=date):KitchenIssueDocument=>({
   ...base(),businessDate,type:'kitchen.transfer',destinationLocationId:'k1',kitchenId:'k1',kitchen:'Kitchen 1',
   reference:'',notes:'',currency:'EGP',lines:[{lineId:randomUUID(),itemId:'rice',unitId:'kg',quantity}]
  });
  const oil=()=>({lineId:randomUUID(),itemId:'oil',unitId:'litre',quantity:'2.25'});
  const original=transfer('10','2026-10-09');
  original.lines.push(oil());
  await postKitchenIssue(db,access,original);
  const correction=()=>({organizationId:org,generation,operationId:randomUUID(),sourceId:original.operationId,reason:'Correct kitchen issue'});
  const [rice]=original.lines;
  await postDocumentCorrection(db,access,{...correction(),kind:'kitchen_quantity',lineId:rice.lineId,expectedRevision:0,quantity:'8'});
  await postDocumentCorrection(db,access,{...correction(),kind:'kitchen_edit',expectedRevision:1,document:{
   ...original,businessDate:date,kitchenId:'k2',destinationLocationId:'k2',kitchen:'Kitchen 2',lines:[{...rice,quantity:'4'}]
  }});
  await postDocumentCorrection(db,access,{...correction(),kind:'kitchen_quantity',lineId:rice.lineId,expectedRevision:2,quantity:'5.125'});
  const other=transfer('3');
  other.lines.push(oil());
  await postKitchenIssue(db,access,other);
  await postKitchenIssue(db,access,transfer('7','2026-10-11'));
  const voided=transfer('9');
  await postKitchenIssue(db,access,voided);
  await postDocumentCorrection(db,access,{...correction(),sourceId:voided.operationId,businessDate:date,kind:'kitchen_void'});

  const query=(filters:Record<string,unknown>={})=>reportQuerySchema.parse({organizationId:org,generation,kind:'kitchenSupplyByItem',from:date,to:date,...filters});
  const summarize=async(filters:Record<string,unknown>={})=>(await getReport(db,access,query(filters))).rows
   .map(row=>[row.itemId,row.unit,Number(row.quantity)]);
  expect(await summarize({sort:'quantity_desc'})).toEqual([['rice','كجم',8.125],['oil','لتر',2.25]]);
  expect(await summarize({kitchenId:'k2',locationId:'k2'})).toEqual([['rice','كجم',5.125]]);
  expect(await summarize({kitchenId:'k1',search:'rice'})).toEqual([['rice','كجم',3]]);
  expect(await summarize({from:'2026-10-09',to:'2026-10-09'})).toEqual([]);
  expect(await summarize({to:'2026-10-11',itemId:'rice'})).toEqual([['rice','كجم',15.125]]);
  const breakdown=await getReport(db,access,query({page:99,sort:'quantity_desc'}));
  expect(breakdown).toMatchObject({page:1,total:2,kitchenSupplyKitchens:[
   {key:'kitchen:k1',label:'Kitchen 1'},{key:'kitchen:k2',label:'Kitchen 2'},{key:'kitchen:k3',label:'Kitchen 3'}
  ]});
  expect(breakdown.rows.map(row=>Object.fromEntries(
   Object.entries(row.kitchenQuantities??{}).map(([key,quantity])=>[key,Number(quantity)])
  ))).toEqual([{'kitchen:k1':3,'kitchen:k2':5.125},{'kitchen:k1':2.25}]);
  for(const row of breakdown.rows){
   const total=Object.values(row.kitchenQuantities??{}).reduce((sum,quantity)=>sum.add(quantity),decimal('0'));
   expect(total.eq(row.quantity)).toBe(true);
  }
  expect(Number(breakdown.current.kitchenSupplyCost)).toBe(20.75);
  expect(breakdown.rows.map(row=>Number(row.kitchenSupplyCost))).toEqual([16.25,4.5]);
  expect(Object.fromEntries(Object.entries(breakdown.rows[0].kitchenCosts??{}).map(([key,value])=>[key,Number(value)])))
   .toEqual({'kitchen:k1':6,'kitchen:k2':10.25});
  const single=await getReport(db,access,query({kitchenId:'k2'}));
  expect(Number(single.current.kitchenSupplyCost)).toBe(10.25);
  expect(Number(single.rows[0].kitchenSupplyCost)).toBe(10.25);
  expect(single.kitchenSupplyKitchens).toEqual([]);
  expect(single.rows[0].kitchenQuantities).toBeUndefined();
  await expect(getReport(db,{...access,organizationId:'bistro'},query())).rejects.toMatchObject({code:'FORBIDDEN'});
 }finally{await db.close();}
},120000);
