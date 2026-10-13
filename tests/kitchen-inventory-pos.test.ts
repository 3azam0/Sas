import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createDatabase,seed,getSnapshot,postSetupCommand,postCommand,postKitchenIssue,postRecipe,postMenuItem,postSalesImport,getReport} from '@saas/server';
import {reportQuerySchema,type Access,type KitchenIssueDocument,type SalesImportDocument,type SalesLine} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {previewSales} from '../packages/domain/sales';

it.each(['fifo','moving_average'] as const)('transfers value and routes shared meals by POS with shortages and duplicate safety (%s)',async method=>{
 const db=await createDatabase(),now=()=>new Date().toISOString(),date='2026-10-10',org='grills';
 const access:Access={organizationId:org,userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
 const setup=async(type:string,record:unknown,revision=0)=>postSetupCommand(db,access,{operationId:randomUUID(),organizationId:org,type,record,expectedRevision:revision,capturedAt:now(),schemaVersion:1});
 try{
  await seed(db,method,false);
  await setup('unit.save',{id:'kg',name:'kg'});await setup('location.save',{id:'main',name:'Main',kind:'مخزن',active:true});
  for(const id of ['rice','pepper'])await setup('item.save',{id,name:id+' material',sku:id.toUpperCase(),category:'Food',unitId:'kg',minimum:'0',purchaseUnits:[],active:true});
  for(const id of ['k1','k2'])await setup('kitchen.save',{id,name:'Kitchen '+id,locationId:id,parentLocationId:'main',active:true});
  for(const id of ['p1','p2'])await setup('pos.save',{id,name:'POS '+id,source:'POS',kitchenId:id==='p1'?'k1':'k2',active:true});
  for(const [quantity,unitCost] of [['2','20'],['8','30']])await postCommand(db,access,{operationId:randomUUID(),organizationId:org,locationId:'main',type:'receipt.post',itemId:'rice',quantity,unitCost,reason:'Receive',businessDate:date,capturedAt:now(),schemaVersion:1});
  await postCommand(db,access,{operationId:randomUUID(),organizationId:org,locationId:'main',type:'receipt.post',itemId:'pepper',quantity:'10',unitCost:'7',reason:'Receive',businessDate:date,capturedAt:now(),schemaVersion:1});
  const transfer=(k:string,q:string):KitchenIssueDocument=>({operationId:randomUUID(),organizationId:org,locationId:'main',destinationLocationId:k,kitchenId:k,kitchen:'Captured',type:'kitchen.transfer',businessDate:date,reference:'',notes:'',currency:'EGP',capturedAt:now(),schemaVersion:1,lines:[{lineId:randomUUID(),itemId:'rice',unitId:'kg',quantity:q}]});
  const total=(s:Awaited<ReturnType<typeof getSnapshot>>)=>s.balances.reduce((n,b)=>n.add(b.value),decimal('0'));
  const before=await getSnapshot(db,access),d=transfer('k1','3');await postKitchenIssue(db,access,d);await postKitchenIssue(db,access,d);await postKitchenIssue(db,access,transfer('k2','1'));
  let s=await getSnapshot(db,access);expect(total(s).eq(total(before))).toBe(true);expect(s.balances.find(b=>b.locationId==='k1'&&b.itemId==='rice')?.quantity).toBe('3.000000');expect(s.reconciliation?.every(r=>r.matches)).toBe(true);
  const supply=await getReport(db,access,reportQuerySchema.parse({organizationId:org,kind:'kitchenSupply',from:date,to:date}));
  expect(supply.total).toBe(2);expect(supply.current.kitchenSupplyDocuments).toBe(2);expect(Number(supply.current.kitchenTransferOut)).toBe(method==='fifo'?100:112);expect(supply.rows.every(r=>r.type==='kitchen.transfer.out')).toBe(true);
  expect(Number(supply.rows.find(r=>r.documentId===d.operationId)?.unitCost)).toBeCloseTo(method==='fifo'?70/3:28,6);
  const stable=JSON.stringify(s.balances);await expect(postKitchenIssue(db,access,transfer('k1','99'))).rejects.toBeDefined();expect(JSON.stringify((await getSnapshot(db,access)).balances)).toBe(stable);
  await expect(setup('kitchen.save',{id:'k1',name:'Kitchen k1',locationId:'k1',parentLocationId:'main',active:false},1)).rejects.toMatchObject({code:'KITCHEN_HAS_STOCK'});
  await expect(setup('location.save',{id:'k1',name:'Bypass',kind:'مخزن',active:false},1)).rejects.toMatchObject({code:'MANAGED_LOCATION'});
  const recipeId=randomUUID(),versionId=randomUUID(),base={organizationId:org,recipeId,capturedAt:now(),schemaVersion:1};
  await postRecipe(db,access,{...base,operationId:randomUUID(),expectedRevision:0,type:'recipe.save',definition:{code:'MEAL',name:'Shared rice meal',outputMode:'non_stocked',outputQuantity:'1',outputUnitId:'kg',effectiveDate:date,salesStockItemIds:['rice'],lines:['rice','pepper'].map(id=>({lineId:randomUUID(),kind:'material',itemId:id,unitId:'kg',inputUnit:'base',enteredQuantity:'1',quantity:'1'}))}});
  await postRecipe(db,access,{...base,operationId:randomUUID(),expectedRevision:1,type:'recipe.publish',versionId});
  const menuId=randomUUID();await postMenuItem(db,access,{operationId:randomUUID(),organizationId:org,type:'menu.save',expectedRevision:0,record:{id:menuId,source:'POS',code:'MEAL',name:'Shared rice meal',versionId,outputPerSale:'1',kitchenIds:['k1','k2'],active:true},capturedAt:now(),schemaVersion:1});
  const line=(quantity='2'):SalesLine=>({lineId:randomUUID(),transactionId:'SAME-TICKET',lineKey:'1',businessDate:date,menuItemId:menuId,menuCode:'MEAL',menuName:'Shared rice meal',mappingRevision:1,versionId,outputPerSale:'1',quantity,netAmount:'100'});
  const sale=(pos:string,kitchen:string,lines=[line()]):SalesImportDocument=>({operationId:randomUUID(),organizationId:org,type:'sales.import',source:'POS',posId:pos,posRevision:1,kitchenId:kitchen,locationId:kitchen,currency:'EGP',reference:'POS sale',completedSalesOnly:true,capturedAt:now(),schemaVersion:1,lines});
  const one=sale('p1','k1'),two=sale('p2','k2');await postSalesImport(db,access,one);await postSalesImport(db,access,two);await postSalesImport(db,access,one);
  const duplicate=sale('p2','k2',[{...two.lines[0],lineId:randomUUID()}]);await postSalesImport(db,access,duplicate);
  s=await getSnapshot(db,access);expect(s.balances.find(b=>b.locationId==='main'&&b.itemId==='rice')?.quantity).toBe('6.000000');expect(s.balances.find(b=>b.locationId==='main'&&b.itemId==='pepper')?.quantity).toBe('10.000000');expect(s.balances.find(b=>b.locationId==='k1'&&b.itemId==='rice')?.quantity).toBe('1.000000');expect(s.balances.find(b=>b.locationId==='k2'&&b.itemId==='rice')?.quantity).toBe('0.000000');expect(s.salesImports?.find(p=>p.document.operationId===two.operationId)?.stockShortages?.[0].shortageQuantity).toBe('1.000000');expect(s.salesImports?.find(p=>p.document.operationId===duplicate.operationId)?.netAmount).toBe('0.000000');expect(s.reconciliation?.every(r=>r.matches)).toBe(true);
  const report=await getReport(db,access,reportQuerySchema.parse({organizationId:org,kind:'kitchens',from:date,to:date}));expect(report.total).toBe(2);expect(decimal(report.current.kitchenTransferIn??'0').gt(0)).toBe(true);expect(decimal(report.current.kitchen).eq(report.current.salesDeduction)).toBe(true);
  const p2Report=await getReport(db,access,reportQuerySchema.parse({organizationId:org,kind:'sales',posId:'p2',from:date,to:date}));expect(p2Report.total).toBe(1);expect(p2Report.current.sales).toBe('100');expect(p2Report.rows[0].posName).toBe('POS p2');expect(p2Report.shortages?.[0].missing).toBe('1.000000');
  const p1Report=await getReport(db,access,reportQuerySchema.parse({organizationId:org,kind:'sales',posId:'p1',from:date,to:date}));expect(p1Report.shortages).toEqual([]);
  await expect(postSalesImport(db,access,{...sale('p1','k1'),kitchenId:'k2',locationId:'k2'})).rejects.toMatchObject({code:'INVALID_POS'});
  await expect(postSalesImport(db,{...access,organizationId:'bistro'},sale('p1','k1'))).rejects.toMatchObject({code:'FORBIDDEN'});
  await setup('pos.save',{id:'p2',name:'POS p2',source:'POS',kitchenId:'k1',active:true},1);
  const moved={...sale('p2','k1',[{...two.lines[0],lineId:randomUUID()}]),posRevision:2};expect(previewSales(s,moved).duplicateCount).toBe(1);await postSalesImport(db,access,moved);expect((await getSnapshot(db,access)).balances).toEqual(s.balances);
  await expect(setup('pos.save',{id:'p2',name:'POS p2',source:'OTHER',kitchenId:'k1',active:true},2)).rejects.toMatchObject({code:'IMMUTABLE_CODE'});
 }finally{await db.close();}
});
