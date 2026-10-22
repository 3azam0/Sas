import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createDatabase,seed,getReport,getSnapshot,postSetupCommand,postCommand,postKitchenIssue} from '@saas/server';
import {reportQuerySchema,type Access,type KitchenIssueDocument} from '@saas/contracts';
import {decimal} from '@saas/domain';

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
  for(let index=0;index<101;index++){const d=transfer('main','k1','1');if(index===0)d.lines.push({lineId:randomUUID(),itemId:'oil',unitId:'litre',quantity:'2'});await postKitchenIssue(db,access,d);}
  await postKitchenIssue(db,access,{...transfer('main','k1','1'),businessDate:'2026-10-09'});
  const nested=transfer('k1','k2','2');await postKitchenIssue(db,access,nested);
  await postKitchenIssue(db,access,{...transfer('main','k1','3'),type:'kitchen.issue',kitchenId:undefined,destinationLocationId:undefined,kitchen:'Legacy kitchen'});
  const before=await getSnapshot(db,access),all=await getReport(db,access,query()),page=await getReport(db,access,query({page:2,pageSize:100}));
  expect(before.kitchenIssues).toHaveLength(100);expect(all.total).toBe(104);expect(page.rows).toHaveLength(4);expect(page.current).toEqual(all.current);
  expect(all.current.kitchenSupplyDocuments).toBe(103);expect(all.current.kitchenSupplyItems).toBe(2);
  expect(decimal(all.current.kitchenTransferOut!).eq('1040')).toBe(true);expect(decimal(all.current.kitchenLegacyIssue!).eq('30')).toBe(true);
  expect(decimal(all.charts.daily[0].kitchenSupply!).eq('1040')).toBe(true);expect(decimal(all.charts.daily[0].kitchenLegacyIssue!).eq('30')).toBe(true);
  expect(all.charts.kitchenSupply?.find(k=>k.key==='k2')?.value).toBe('20.000000000000');
  expect(Number(all.previous.kitchenTransferOut)).toBe(10);expect(all.previous.kitchenSupplyDocuments).toBe(1);
  const dest=await getReport(db,access,query({locationId:'k2',kitchenId:'k2'}));expect(dest.total).toBe(1);expect(dest.rows[0].documentId).toBe(nested.operationId);expect(dest.rows[0].locationId).toBe('k1');expect(dest.rows[0].kitchenName).toBe('Kitchen k2');expect(Number(dest.rows[0].quantity)).toBe(2);expect(Number(dest.rows[0].unitCost)).toBe(10);
  const filtered=await getReport(db,access,query({locationId:'main',kitchenId:'k1',category:'Food',itemId:'rice',search:'Supply test'}));expect(filtered.total).toBe(101);expect(Number(filtered.current.kitchenTransferOut)).toBe(1010);expect(filtered.current.kitchenSupplyDocuments).toBe(101);
  const byDocument=await getReport(db,access,query({search:'KI-'+nested.operationId.toUpperCase()}));expect(byDocument.total).toBe(1);
  const empty=await getReport(db,access,query({from:'2026-10-01',to:'2026-10-02'}));expect(empty.total).toBe(0);expect(empty.current.kitchenSupplyDocuments).toBe(0);expect(empty.charts.kitchenSupply).toEqual([]);
  await expect(getReport(db,{...access,organizationId:'bistro'},query())).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(getReport(db,access,query({locationId:'foreign'}))).rejects.toMatchObject({code:'FORBIDDEN'});
  const after=await getSnapshot(db,access);expect(after.balances).toEqual(before.balances);expect(after.acceptedOperationIds).toEqual(before.acceptedOperationIds);
 }finally{await db.close();}
},60000);

it('allows kitchen filters for supply and consumption reports while rejecting them elsewhere',()=>{
 const base={organizationId:'grills',from:'2026-10-10',to:'2026-10-10',kitchenId:'k1'};
 expect(reportQuerySchema.safeParse({...base,kind:'kitchenSupply'}).success).toBe(true);
 expect(reportQuerySchema.safeParse({...base,kind:'kitchens'}).success).toBe(true);
 expect(reportQuerySchema.safeParse({...base,kind:'purchasing'}).success).toBe(false);
});
