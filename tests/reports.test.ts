import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createDatabase,seed,getReport,postCommand,postKitchenIssue,postRecipe,postMenuItem,postSalesImport,postProduction,getSnapshot} from '@saas/server';
import {reportQuerySchema,type Access,type ReportQuery,type SalesImportDocument,type SalesLine} from '@saas/contracts';
import {previousReportRange,reportCsv} from '../packages/domain/reporting';
import {decimal} from '@saas/domain';
let db:Awaited<ReturnType<typeof createDatabase>>,generation:string,menuId:string,versionId:string;
const now=()=>new Date().toISOString(),access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
const query=(extra:Partial<ReportQuery>={}):ReportQuery=>reportQuerySchema.parse({organizationId:'grills',generation,kind:'purchasing',from:'2026-10-10',to:'2026-10-10',locationId:'central',...extra});
beforeAll(async()=>{
 db=await createDatabase();await seed(db,'moving_average',false);
 await db.exec("INSERT INTO units(organization_id,id,name) VALUES('grills','kg','كجم'),('grills','portion','حصة'),('bistro','kg','كجم');INSERT INTO locations(organization_id,id,name,kind) VALUES('grills','central','Main','مخزن'),('grills','other','Other','مخزن'),('bistro','private','Private','مخزن');INSERT INTO items(organization_id,id,name,sku,category,unit,unit_id,minimum) VALUES('grills','rice','Rice','R','Grains','كجم','kg',0),('grills','pepper','Pepper','P','Spice','كجم','kg',0),('bistro','secret','Secret','S','Private','كجم','kg',0);");
 generation=(await getSnapshot(db,access)).generation!;
 const receive=async(date:string,reason:string)=>postCommand(db,access,{operationId:randomUUID(),organizationId:'grills',locationId:'central',type:'receipt.post',itemId:'rice',quantity:'1',unitCost:'10',reason,businessDate:date,capturedAt:now(),schemaVersion:1});
 await receive('2026-10-09','Previous period');
 for(let index=0;index<121;index++)await receive('2026-10-10','BI receipt '+index);
 const recipeId=randomUUID();versionId=randomUUID();const base={organizationId:'grills',recipeId,capturedAt:now(),schemaVersion:1};
 await postRecipe(db,access,{...base,operationId:randomUUID(),expectedRevision:0,type:'recipe.save',definition:{code:recipeId,name:'Rice meal',outputMode:'non_stocked',outputQuantity:'2',outputUnitId:'portion',effectiveDate:'2026-10-09',salesStockItemIds:['rice'],lines:[{lineId:randomUUID(),kind:'material',itemId:'rice',unitId:'kg',inputUnit:'base',enteredQuantity:'1',quantity:'1'}]}});
 await postRecipe(db,access,{...base,operationId:randomUUID(),expectedRevision:1,type:'recipe.publish',versionId});
 menuId=randomUUID();await postMenuItem(db,access,{operationId:randomUUID(),organizationId:'grills',expectedRevision:0,type:'menu.save',record:{id:menuId,source:'POS',code:'RICE',name:'Rice meal',versionId,outputPerSale:'1',active:true},capturedAt:now(),schemaVersion:1});
});afterAll(async()=>db.close());
it('aggregates all history beyond the 100-record snapshot and pages independently of complete totals',async()=>{
 const report=await getReport(db,access,query()),page2=await getReport(db,access,query({page:2,pageSize:100,sort:'amount_desc'}));
 expect(report.total).toBe(121);expect(report.rows).toHaveLength(25);expect(decimal(report.current.received).toNumber()).toBe(1210);expect(decimal(report.previous.received).toNumber()).toBe(10);expect(decimal(report.charts.daily[0].received).toNumber()).toBe(1210);expect(page2.rows).toHaveLength(21);expect(page2.current).toEqual(report.current);expect(new Set(page2.rows.map(r=>r.id)).size).toBe(21);expect((await getSnapshot(db,access)).entries).toHaveLength(100);
});
it('supports category/material/no-supplier/search filters and clamps pages without claiming a historical balance',async()=>{
 const r=await getReport(db,access,query({supplierId:'__none__',search:'BI receipt 120',page:20}));
 expect(r.total).toBe(1);expect(r.page).toBe(1);expect(r.rows[0].reference).toBe('BI receipt 120');expect(decimal(r.current.received).toNumber()).toBe(10);
 const inventory=await getReport(db,access,query({kind:'inventory',itemId:'rice',category:'Grains',from:'2026-10-09',to:'2026-10-09'}));
 expect(decimal(inventory.stock.value).toNumber()).toBe(1220);expect(inventory.rows[0].unitCost).not.toBeNull();expect(inventory.rows[0].date).not.toBe('2026-10-09');
});
it('keeps kitchen issues, waste and count adjustments separate with posted costs and legacy kitchen drilldowns',async()=>{
 const issue=await postKitchenIssue(db,access,{operationId:randomUUID(),organizationId:'grills',locationId:'central',type:'kitchen.issue',kitchen:'Kitchen A',businessDate:'2026-10-10',reference:'',notes:'',capturedAt:now(),schemaVersion:1,currency:'EGP',lines:[{lineId:randomUUID(),itemId:'rice',unitId:'kg',quantity:'2'}]});
 const waste=await postCommand(db,access,{operationId:randomUUID(),organizationId:'grills',locationId:'central',type:'waste.post',itemId:'rice',quantity:'1',reason:'Spoilage',businessDate:'2026-10-10',capturedAt:now(),schemaVersion:1});
 await db.query("INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date) VALUES('grills',$1,'central','rice',-1,-5,'count.adjust','Fixture count','2026-10-10')",[randomUUID()]);
 const kitchen=await getReport(db,access,query({kind:'kitchens',kitchenId:'Kitchen A'})),w=await getReport(db,access,query({kind:'waste'}));
 expect(kitchen.total).toBe(1);expect(kitchen.charts.kitchens[0].label).toBe('Kitchen A');expect(decimal(kitchen.current.kitchen).eq(issue.amount!)).toBe(true);
 expect(decimal(w.current.waste).eq(waste.amount!)).toBe(true);expect(decimal(w.current.countDecrease).toNumber()).toBe(5);expect(w.total).toBe(2);expect(decimal(w.current.kitchen).toNumber()).toBe(20);
});
it('records accepted sales once and separates all-ingredient estimates from actual selected deductions',async()=>{
 const line=(id:string):SalesLine=>({lineId:randomUUID(),transactionId:id,lineKey:'1',businessDate:'2026-10-10',menuItemId:menuId,menuCode:'RICE',menuName:'Rice meal',mappingRevision:1,versionId,outputPerSale:'1',quantity:'2',netAmount:'100'});
 const doc=(lines:SalesLine[]):SalesImportDocument=>({operationId:randomUUID(),organizationId:'grills',type:'sales.import',source:'POS',locationId:'central',currency:'EGP',reference:'BI sales',completedSalesOnly:true,capturedAt:now(),schemaVersion:1,lines});
 // Undo the deliberately isolated count fixture before the posting engine reconciles stock.
 await db.query("DELETE FROM stock_entries WHERE organization_id='grills' AND reason='Fixture count'");
 const original=line('ONE');await postSalesImport(db,access,doc([original]));await postSalesImport(db,access,doc([{...original,lineId:randomUUID()},line('TWO')]));
 const r=await getReport(db,access,query({kind:'sales',itemId:menuId}));
 expect(r.total).toBe(2);expect(decimal(r.current.sales).toNumber()).toBe(200);expect(decimal(r.current.estimatedSalesCost!).toNumber()).toBe(20);expect(decimal(r.current.estimatedMargin!).toNumber()).toBe(180);expect(decimal(r.current.foodCostPercent!).toNumber()).toBe(10);
 // The menu filter is a dish ID; selected ingredient deductions are separately scoped to the whole location.
 expect(r.rows.every(row=>decimal(row.estimatedCost!).toNumber()===10)).toBe(true);
 const all=await getReport(db,access,query({kind:'sales'}));expect(decimal(all.current.salesDeduction).toNumber()).toBe(20);
 const balance=(await db.query<{quantity:string;value:string}>("SELECT quantity::text,value::text FROM stock_balances WHERE organization_id='grills' AND location_id='central' AND item_id='rice'")).rows[0];
 await db.query("UPDATE stock_balances SET quantity=0,value=0 WHERE organization_id='grills' AND location_id='central' AND item_id='rice'");
 const missing=await getReport(db,access,query({kind:'sales'}));expect(missing.current.estimatedSalesCost).toBeNull();expect(missing.rows[0].estimatedCost).toBeNull();
 await db.query("UPDATE stock_balances SET quantity=$1,value=$2 WHERE organization_id='grills' AND location_id='central' AND item_id='rice'",[balance.quantity,balance.value]);
});
it('protects tenant, generation, expiry, foreign filters, dates and SQL-like searches',async()=>{
 for(const extra of [{organizationId:'bistro'},{locationId:'private'},{itemId:'secret'}])await expect(getReport(db,access,query(extra))).rejects.toMatchObject({code:'FORBIDDEN'});
 await expect(getReport(db,access,query({generation:randomUUID()}))).rejects.toMatchObject({code:'STALE_GENERATION'});
 await expect(getReport(db,{...access,expiresAt:'invalid'},query())).rejects.toMatchObject({code:'FORBIDDEN'});
 await expect(getReport(db,access,query({from:'2099-01-01',to:'2099-01-02'}))).rejects.toMatchObject({code:'INVALID_REPORT'});
 const empty=await getReport(db,access,query({search:"' OR 1=1 --"}));expect(empty.total).toBe(0);expect(empty.current.received).toBe('0');
 expect(reportQuerySchema.safeParse({...query(),from:'2025-01-01'}).success).toBe(false);
});
it('queries production and empty periods without mutating any accepted operation',async()=>{
 const before=await getSnapshot(db,access),r=await getReport(db,access,query({kind:'production'})),empty=await getReport(db,access,query({from:'2026-10-01',to:'2026-10-02'}));
 expect(r.total).toBe(0);expect(r.current.productionInput).toBe('0');expect(empty.total).toBe(0);expect(empty.charts.daily).toHaveLength(2);const after=await getSnapshot(db,access);expect(after.balances).toEqual(before.balances);expect(after.entries).toEqual(before.entries);expect(after.acceptedOperationIds).toEqual(before.acceptedOperationIds);
});
it('uses equal previous periods and escapes formulas in complete CSV exports',()=>{
 expect(previousReportRange('2026-10-01','2026-10-12')).toEqual({from:'2026-09-19',to:'2026-09-30'});
 const csv=reportCsv([['=SUM(A1)','+CMD','-CMD','@user','-1.25','a,"b"']]);expect(csv).toContain("'=SUM(A1)");expect(csv).toContain("'+CMD");expect(csv).toContain("'-CMD");expect(csv).toContain('" -1.25"'.replace(' ',''));expect(csv).toContain('a,""b""');
});

it('reports posted production input, waste, output unit cost and attainment without treating it as sales expense',async()=>{
 const id=randomUUID(),version=randomUUID(),base={organizationId:'grills',recipeId:id,capturedAt:now(),schemaVersion:1};
 await db.query("INSERT INTO items(organization_id,id,name,sku,category,unit,unit_id,minimum) VALUES('grills','prepared','Prepared rice','PREP','Preparation','حصة','portion',0)");
 await postRecipe(db,access,{...base,operationId:randomUUID(),expectedRevision:0,type:'recipe.save',definition:{code:id,name:'Prepared rice',outputMode:'stocked',outputItemId:'prepared',outputUnitId:'portion',outputQuantity:'2',effectiveDate:'2026-10-09',lines:[{lineId:randomUUID(),kind:'material',itemId:'rice',unitId:'kg',inputUnit:'base',enteredQuantity:'1',quantity:'1'}]}});
 await postRecipe(db,access,{...base,operationId:randomUUID(),expectedRevision:1,type:'recipe.publish',versionId:version});
 await postProduction(db,access,{operationId:randomUUID(),organizationId:'grills',type:'production.post',versionId:version,inputLocationId:'central',outputLocationId:'central',plannedOutput:'4',actualOutput:'3',outputMovementId:randomUUID(),reference:'BI batch',wasteReason:'Preparation loss',businessDate:'2026-10-10',capturedAt:now(),schemaVersion:1,currency:'EGP',lines:[{movementId:randomUUID(),itemId:'rice',unitId:'kg',quantity:'2',abnormalWaste:'0.2',wasteReason:'Preparation loss'}]});
 const r=await getReport(db,access,query({kind:'production'}));expect(r.total).toBe(1);expect(decimal(r.current.productionInput).toNumber()).toBe(20);expect(decimal(r.current.productionWaste).toNumber()).toBe(2);expect(r.rows[0].quantity).toBe('3');expect(Number(r.rows[0].unitCost)).toBe(6);expect(Number(r.rows[0].extra)).toBe(75);
});
it('nets supplier returns and reversals while preserving the distinct supplier reference valuation',async()=>{
 const ids=[randomUUID(),randomUUID(),randomUUID()];
 try{
  for(const [index,type,quantity,amount,reference] of [[0,'purchase.receive',10,100,null],[1,'purchase.return',-2,-20,-30],[2,'purchase.reverse',-1,-10,-15]] as const)await db.query("INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,reference_amount) VALUES('grills',$1,'other','rice',$2,$3,$4,'BI supplier fixture','2026-10-10',$5)",[ids[index],quantity,amount,type,reference]);
  const r=await getReport(db,access,query({locationId:'other'}));expect(Number(r.current.received)).toBe(100);expect(Number(r.current.returned)).toBe(20);expect(Number(r.current.reversed)).toBe(10);expect(Number(r.current.netReceived)).toBe(70);expect(Number(r.current.returnReference)).toBe(30);expect(r.total).toBe(3);
 }finally{await db.query("DELETE FROM stock_entries WHERE organization_id='grills' AND operation_id=ANY($1::uuid[])",[ids]);}
});

it('shows immutable selected-material shortages by base unit and does not backfill them after a later receipt',async()=>{
 const quantity=(await db.query<{quantity:string}>("SELECT quantity::text FROM stock_balances WHERE organization_id='grills' AND location_id='central' AND item_id='rice'")).rows[0].quantity;
 const line:SalesLine={lineId:randomUUID(),transactionId:'SHORTAGE',lineKey:'1',businessDate:'2026-10-10',menuItemId:menuId,menuCode:'RICE',menuName:'Rice meal',mappingRevision:1,versionId,outputPerSale:'1',quantity:'500',netAmount:'1000'};
 await postSalesImport(db,access,{operationId:randomUUID(),organizationId:'grills',type:'sales.import',source:'POS',locationId:'central',currency:'EGP',reference:'BI shortage',completedSalesOnly:true,capturedAt:now(),schemaVersion:1,lines:[line]});
 const r=await getReport(db,access,query({kind:'sales'}));expect(r.shortages).toHaveLength(1);expect(r.shortages![0].unit).toBe('كجم');expect(Number(r.shortages![0].required)).toBe(250);expect(decimal(r.shortages![0].deducted).eq(quantity)).toBe(true);expect(decimal(r.shortages![0].missing).eq(decimal('250').sub(quantity))).toBe(true);
 await postCommand(db,access,{operationId:randomUUID(),organizationId:'grills',locationId:'central',type:'receipt.post',itemId:'rice',quantity:'2',unitCost:'10',reason:'After shortage',businessDate:'2026-10-10',capturedAt:now(),schemaVersion:1});
 expect((await getReport(db,access,query({kind:'sales'}))).shortages).toEqual(r.shortages);
});
