import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {createDatabase,seed,postRecipe,postMenuItem,postSalesImport,postCommand,postCount,getSnapshot} from '@saas/server';
import type {Access,RecipeDefinition,RecipeVersion,SalesImportDocument,SalesLine,CountDefinition} from '@saas/contracts';
import {salesStockRequirements} from '../packages/domain/sales';
import {salesReport} from '../packages/domain/sales-report';
let db:PGlite;
const now=()=>new Date().toISOString(),date='2026-10-10',access:Access={organizationId:'grills',userId:'client-owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
beforeAll(async()=>{db=await createDatabase();await seed(db,'fifo',false);await db.exec("INSERT INTO units(organization_id,id,name) VALUES('grills','kg','كجم');INSERT INTO items(organization_id,id,name,sku,category,unit,unit_id,minimum) VALUES('grills','rice','Rice','R','Food','كجم','kg',0),('grills','beef','Beef','B','Food','كجم','kg',0),('grills','prep','Preparation','P','Food','كجم','kg',0);");});
afterAll(async()=>{await db.close();});
async function receive(locationId:string,itemId='rice',quantity='10',unitCost='20'){await postCommand(db,access,{operationId:randomUUID(),organizationId:'grills',locationId,itemId,type:'receipt.post',quantity,unitCost,reason:'Fixture receipt',businessDate:date,capturedAt:now(),schemaVersion:1});}
async function fixture(selected:string[]=['rice'],method='fifo',stocked=false){
 await db.query('UPDATE organizations SET costing_method=$1 WHERE id=$2',[method,'grills']);
 const locationId=randomUUID(),recipeId=randomUUID(),versionId=randomUUID(),menuId=randomUUID();await db.query("INSERT INTO locations(organization_id,id,name,kind) VALUES('grills',$1,'Fixture warehouse','مخزن')",[locationId]);
 const definition:RecipeDefinition={code:recipeId,name:'Client meal',outputMode:stocked?'stocked':'non_stocked',...(stocked?{outputItemId:'prep'}:{}),outputUnitId:'kg',outputQuantity:'1',effectiveDate:date,salesStockItemIds:selected,lines:[{lineId:randomUUID(),kind:'material',itemId:'rice',unitId:'kg',inputUnit:'base',enteredQuantity:'1',quantity:'1'},{lineId:randomUUID(),kind:'material',itemId:'beef',unitId:'kg',inputUnit:'base',enteredQuantity:'2',quantity:'2'}]};
 const envelope={organizationId:'grills',recipeId,capturedAt:now(),schemaVersion:1};await postRecipe(db,access,{...envelope,operationId:randomUUID(),expectedRevision:0,type:'recipe.save',definition});await postRecipe(db,access,{...envelope,operationId:randomUUID(),expectedRevision:1,type:'recipe.publish',versionId});
 const record={id:menuId,source:'POS',code:menuId.toUpperCase(),name:'Client meal',versionId,outputPerSale:'1',active:true};await postMenuItem(db,access,{operationId:randomUUID(),organizationId:'grills',expectedRevision:0,type:'menu.save',record,capturedAt:now(),schemaVersion:1});
 const line=(order=randomUUID(),quantity='3'):SalesLine=>({lineId:randomUUID(),transactionId:order,lineKey:'1',businessDate:date,menuItemId:menuId,menuCode:record.code,menuName:record.name,mappingRevision:1,versionId,outputPerSale:'1',quantity,netAmount:'100'});
 const doc=(lines=[line()]):SalesImportDocument=>({operationId:randomUUID(),organizationId:'grills',type:'sales.import',source:'POS',locationId,currency:'EGP',reference:'Client sales',completedSalesOnly:true,capturedAt:now(),schemaVersion:1,lines});
 return {locationId,recipeId,versionId,definition,record,line,doc,envelope};
}
it('deducts selected ingredients under FIFO and average while estimating every ingredient',async()=>{
 for(const [method,cost] of [['fifo','70.000000000000'],['moving_average','84.000000000000']]){
  const f=await fixture(['rice'],method);await receive(f.locationId,'rice','2','20');await receive(f.locationId,'rice','8','30');await receive(f.locationId,'beef','20','40');
  const d=f.doc();await postSalesImport(db,access,d);const s=await getSnapshot(db,access),p=s.salesImports!.find(p=>p.document.operationId===d.operationId)!;
  expect(p.stockDeductions).toMatchObject([{itemId:'rice',quantity:'3.000000',amount:cost}]);expect(p.stockShortages).toEqual([]);
  expect(s.balances.find(b=>b.locationId===f.locationId&&b.itemId==='beef')?.quantity).toBe('20.000000');
  expect(salesReport(s,f.locationId).lines.map(l=>[l.itemId,l.quantity])).toEqual([['rice','3'],['beef','6']]);
  expect(s.reconciliation?.filter(r=>r.locationId===f.locationId).every(r=>r.matches)).toBe(true);
  expect((await db.query("SELECT actor FROM audit_events WHERE operation_id=$1",[p.stockDeductions![0].movementId])).rows[0]).toMatchObject({actor:access.userId});
 }
});
it('accepts shortages, deducts available stock, and never backfills or repeats the original deduction',async()=>{
 const f=await fixture(['rice','beef'],'moving_average');await receive(f.locationId,'rice','2','20');const d=f.doc();await postSalesImport(db,access,d);let s=await getSnapshot(db,access),p=s.salesImports!.find(p=>p.document.operationId===d.operationId)!;
 expect(p.acceptedLineIds).toEqual([d.lines[0].lineId]);expect(p.stockDeductions).toMatchObject([{itemId:'rice',quantity:'2.000000',amount:'40.000000000000'}]);
 expect(p.stockShortages).toEqual([{itemId:'beef',businessDate:date,requiredQuantity:'6.000000',deductedQuantity:'0.000000',shortageQuantity:'6.000000'},{itemId:'rice',businessDate:date,requiredQuantity:'3.000000',deductedQuantity:'2.000000',shortageQuantity:'1.000000'}]);
 expect(s.balances.find(b=>b.locationId===f.locationId)?.quantity).toBe('0.000000');
 await receive(f.locationId,'rice','10','30');await postSalesImport(db,access,d);await postSalesImport(db,access,f.doc([{...d.lines[0],lineId:randomUUID()}]));s=await getSnapshot(db,access);
 expect(s.balances.find(b=>b.locationId===f.locationId)?.quantity).toBe('10.000000');expect(s.entries.filter(e=>e.locationId===f.locationId&&e.type==='sales.issue')).toHaveLength(1);
 expect(s.salesImports!.find(p=>p.document.operationId===d.operationId)?.stockShortages).toEqual(p.stockShortages);
});
it('accepts zero-stock sales and highlights each shortage without creating negative inventory',async()=>{
 const f=await fixture(['rice','beef']);const d=f.doc();await postSalesImport(db,access,d);const s=await getSnapshot(db,access),p=s.salesImports!.find(p=>p.document.operationId===d.operationId)!;
 expect(p.stockDeductions).toEqual([]);expect(p.stockShortages).toHaveLength(2);expect(p.netAmount).toBe('100.000000');expect(s.balances.filter(b=>b.locationId===f.locationId)).toEqual([]);
});
it('serializes competing imports, accepts both sales and reports only the unmet stock',async()=>{
 const f=await fixture(['rice'],'moving_average');await receive(f.locationId);const a=f.doc([f.line(randomUUID(),'6')]),b=f.doc([f.line(randomUUID(),'6')]);await Promise.all([postSalesImport(db,access,a),postSalesImport(db,access,b)]);const s=await getSnapshot(db,access),imports=s.salesImports!.filter(p=>[a.operationId,b.operationId].includes(p.document.operationId));
 expect(imports).toHaveLength(2);expect(imports.reduce((n,p)=>n+p.acceptedLineIds.length,0)).toBe(2);expect(imports.flatMap(p=>p.stockDeductions??[]).reduce((n,r)=>n+Number(r.quantity),0)).toBe(10);expect(imports.flatMap(p=>p.stockShortages??[]).reduce((n,r)=>n+Number(r.shortageQuantity),0)).toBe(2);expect(s.balances.find(b=>b.locationId===f.locationId)?.quantity).toBe('0.000000');expect(s.reconciliation?.find(b=>b.locationId===f.locationId)?.matches).toBe(true);
});
it('rolls back earlier issues if a later selected material has an invalid configuration',async()=>{
 const f=await fixture(['rice','beef']);await receive(f.locationId,'rice','10','20');await receive(f.locationId,'beef','10','40');const before=await getSnapshot(db,access),d=f.doc();await db.query("UPDATE items SET active=false WHERE organization_id='grills' AND id='rice'");
 try{await expect(postSalesImport(db,access,d)).rejects.toMatchObject({code:'INVALID_REFERENCE'});const after=await getSnapshot(db,access);expect(after.balances.filter(b=>b.locationId===f.locationId)).toEqual(before.balances.filter(b=>b.locationId===f.locationId));expect(after.salesImports?.some(p=>p.document.operationId===d.operationId)).toBe(false);expect(after.entries.filter(e=>e.locationId===f.locationId)).toEqual(before.entries.filter(e=>e.locationId===f.locationId));}finally{await db.query("UPDATE items SET active=true WHERE organization_id='grills' AND id='rice'");}
});
it('deducts only fresh overlap, keeps accepted sales pinned, and rolls back genuine conflicts',async()=>{
 const f=await fixture();await receive(f.locationId);const original=f.doc();await postSalesImport(db,access,original);
 const overlap=f.doc([{...original.lines[0],lineId:randomUUID()},f.line()]);await postSalesImport(db,access,overlap);let s=await getSnapshot(db,access);expect(s.balances.find(b=>b.locationId===f.locationId)?.quantity).toBe('4.000000');
 const before=s.entries.filter(e=>e.locationId===f.locationId),conflict=f.doc([f.line(),{...original.lines[0],lineId:randomUUID(),netAmount:'101'}]);await expect(postSalesImport(db,access,conflict)).rejects.toMatchObject({code:'EXTERNAL_CONFLICT'});
 s=await getSnapshot(db,access);expect(s.entries.filter(e=>e.locationId===f.locationId)).toEqual(before);
});
it('does not apply new selections to old sales or legacy calculation-only versions',async()=>{
 const f=await fixture([]);await receive(f.locationId);const old=f.doc();await postSalesImport(db,access,old);const next=randomUUID();
 await postRecipe(db,access,{...f.envelope,operationId:randomUUID(),expectedRevision:2,type:'recipe.save',definition:{...f.definition,salesStockItemIds:['rice']}});await postRecipe(db,access,{...f.envelope,operationId:randomUUID(),expectedRevision:3,type:'recipe.publish',versionId:next});
 await postMenuItem(db,access,{operationId:randomUUID(),organizationId:'grills',expectedRevision:1,type:'menu.save',record:{...f.record,versionId:next},capturedAt:now(),schemaVersion:1});
 await postSalesImport(db,access,f.doc([{...old.lines[0],lineId:randomUUID()}]));await postSalesImport(db,access,f.doc([{...f.line(),versionId:next,mappingRevision:2}]));const s=await getSnapshot(db,access);
 expect(s.balances.find(b=>b.locationId===f.locationId)?.quantity).toBe('7.000000');expect(s.salesImports!.find(p=>p.document.operationId===old.operationId)?.stockDeductions).toEqual([]);
});
it('sells stocked preparations without deducting their raw ingredients a second time',async()=>{
 const f=await fixture(['prep'],'moving_average',true);await receive(f.locationId,'prep','5','25');await receive(f.locationId,'rice','10','20');const d=f.doc();await postSalesImport(db,access,d);const s=await getSnapshot(db,access);
 expect(s.balances.find(b=>b.locationId===f.locationId&&b.itemId==='prep')?.quantity).toBe('2.000000');expect(s.balances.find(b=>b.locationId===f.locationId&&b.itemId==='rice')?.quantity).toBe('10.000000');
 await expect(postRecipe(db,access,{...f.envelope,operationId:randomUUID(),expectedRevision:2,type:'recipe.save',definition:{...f.definition,salesStockItemIds:['rice']}})).rejects.toMatchObject({code:'INVALID_SALES_STOCK'});
});
it('rounds aggregate selected quantities once and respects nested preparation boundaries',()=>{
 const child:RecipeVersion={recipeId:randomUUID(),versionId:randomUUID(),versionNumber:1,publishedAt:now(),definition:{code:'CHILD',name:'Prepared stock',outputMode:'stocked',outputItemId:'prep',outputUnitId:'kg',outputQuantity:'1',effectiveDate:date,lines:[{lineId:randomUUID(),kind:'material',itemId:'rice',unitId:'kg',inputUnit:'base',enteredQuantity:'2',quantity:'2'}]}};
 const root:RecipeVersion={recipeId:randomUUID(),versionId:randomUUID(),versionNumber:1,publishedAt:now(),definition:{code:'ROOT',name:'Meal',outputMode:'non_stocked',outputUnitId:'kg',outputQuantity:'3',effectiveDate:date,salesStockItemIds:['prep'],lines:[{lineId:randomUUID(),kind:'recipe',versionId:child.versionId,unitId:'kg',inputUnit:'base',enteredQuantity:'1',quantity:'1'}]}};
 const sale:SalesLine={lineId:randomUUID(),transactionId:'R',lineKey:'1',businessDate:date,menuItemId:randomUUID(),menuCode:'R',menuName:'Meal',mappingRevision:1,versionId:root.versionId,outputPerSale:'1',quantity:'1',netAmount:'1'};
 expect(salesStockRequirements({recipeVersions:[child,root]},[sale,{...sale,lineId:randomUUID(),transactionId:'S'},{...sale,lineId:randomUUID(),transactionId:'T'}])).toEqual([{itemId:'prep',businessDate:date,quantity:'1.000000'}]);
});
it('records old/new balance and actor, values increases explicitly, and rejects a stale edit',async()=>{
 const f=await fixture([],'moving_average');await receive(f.locationId);let s=await getSnapshot(db,access);
 const d:CountDefinition={operationId:randomUUID(),organizationId:'grills',countId:randomUUID(),expectedRevision:0,capturedAt:now(),schemaVersion:1,type:'count.save',entryMode:'balance_edit',locationId:f.locationId,businessDate:date,reason:'Correct physical quantity',cutoffAt:s.fetchedAt,stockSequence:s.stockCheckpoints!.find(p=>p.locationId===f.locationId)!.sequence,currency:'EGP',lines:[{lineId:randomUUID(),itemId:'rice',unitId:'kg',expectedQuantity:'10',countedQuantity:'12',surplusUnitCost:'30'}]};
 const finalize={operationId:randomUUID(),organizationId:'grills',countId:d.countId,expectedRevision:1,capturedAt:now(),schemaVersion:1,type:'count.finalize',costPolicy:'explicit',lines:[{lineId:d.lines[0].lineId,movementId:randomUUID()}]};await postCount(db,access,d);await postCount(db,access,finalize);s=await getSnapshot(db,access);
 expect(s.balances.find(b=>b.locationId===f.locationId)).toMatchObject({quantity:'12.000000',value:'260.000000000000'});expect(s.counts!.find(c=>c.countId===d.countId)?.document).toMatchObject({entryMode:'balance_edit',lines:[{expectedQuantity:'10',countedQuantity:'12'}]});expect((await db.query('SELECT actor FROM audit_events WHERE operation_id=$1',[finalize.operationId])).rows[0]).toMatchObject({actor:access.userId});
 const stale={...d,operationId:randomUUID(),countId:randomUUID(),stockSequence:s.stockCheckpoints!.find(p=>p.locationId===f.locationId)!.sequence,cutoffAt:s.fetchedAt,lines:[{...d.lines[0],lineId:randomUUID(),expectedQuantity:'12',countedQuantity:'7'}]};await postCount(db,access,stale);await receive(f.locationId,'beef','1','5');await expect(postCount(db,access,{...finalize,operationId:randomUUID(),countId:stale.countId,lines:[{lineId:stale.lines[0].lineId,movementId:randomUUID()}]})).rejects.toMatchObject({code:'STALE_COUNT'});
});
