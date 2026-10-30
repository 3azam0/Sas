import {beforeEach,afterEach,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {createDatabase,seed,getSnapshot,postCommand,postCentralKitchen,postTransfer,postSetupCommand,reconcileStock} from '@saas/server';
import type {Access,CentralCommand,CentralBatch} from '@saas/contracts';
import {schema} from '../packages/server/schema';
let db:PGlite,generation:string;
const access:Access={organizationId:'grills',userId:'warehouse',deviceId:randomUUID(),role:'operator',expiresAt:new Date(Date.now()+86400000).toISOString()},date='2026-10-10';
const uuid=()=>randomUUID();
async function snapshot(){return getSnapshot(db,access);}
async function state(id:string){return (await snapshot()).centralBatches!.find(b=>b.batchId===id)!;}
function base(batchId:string,expectedRevision:number){return {operationId:uuid(),organizationId:'grills',generation,batchId,expectedRevision,businessDate:date,capturedAt:new Date().toISOString(),schemaVersion:1 as const,notes:''};}
async function command(id:string,body:Record<string,unknown>){const b=await state(id);const c={...base(id,b?.revision??0),...body} as CentralCommand;const result=await postCentralKitchen(db,access,c);return {c,result,b:await state(id)};}
async function create(){const batchId=uuid();await postCentralKitchen(db,access,{...base(batchId,0),type:'central.create',locationId:'central',name:'دفعة كفتة',operationType:'manufacturing'});return batchId;}
const material=(itemId:string,quantity:string)=>({lineId:uuid(),itemId,unitId:'kg',quantity});
async function issue(id:string,lines=[material('beef','10')]){return command(id,{type:'central.issue',lines});}
async function receive(id:string,quantity:string,itemId='kofta'){return command(id,{type:'central.receive',recipient:'أمين المخزن',lines:[material(itemId,quantity)]});}
async function close(id:string,extra:Record<string,unknown>={}){const b=await state(id);return command(id,{type:'central.close',consumption:b.issues.map(i=>({issueLineId:i.lineId,quantity:String(Number(i.quantity)-Number(i.returned)-Number(i.lost))})),allocations:[],balanceReason:'',...extra});}
async function receipt(itemId:string,quantity:string,unitCost:string){await postCommand(db,access,{operationId:uuid(),organizationId:'grills',generation,locationId:'central',type:'receipt.post',itemId,quantity,unitCost,reason:'Test receipt',businessDate:date,capturedAt:new Date().toISOString(),schemaVersion:1});}
const balance=(s:Awaited<ReturnType<typeof snapshot>>,item:string,location='central')=>s.balances.find(b=>b.itemId===item&&b.locationId===location);
beforeEach(async()=>{
 db=await createDatabase();await seed(db,'moving_average',false);
 await db.exec("INSERT INTO units(organization_id,id,name) VALUES('grills','kg','كجم'),('grills','piece','قطعة');INSERT INTO locations(organization_id,id,name,kind) VALUES('grills','central','Main','مخزن'),('grills','cairo','Cairo','مطعم');INSERT INTO items(organization_id,id,name,sku,category,unit,unit_id,minimum) VALUES('grills','beef','Beef','B','Food','كجم','kg',0),('grills','onion','Onion','O','Food','كجم','kg',0),('grills','kofta','Kofta','K','Food','كجم','kg',0),('grills','mix','Mix','M','Food','كجم','kg',0),('grills','box','Box','X','Other','قطعة','piece',0);");
 generation=(await snapshot()).generation!;await receipt('beef','10','20');await receipt('beef','10','30');await receipt('onion','10','10');await receipt('kofta','5','40');
});
afterEach(async()=>{await db.close();});

it('issues a multi-ingredient batch at the pooled average, permits additional issues and deduplicates',async()=>{
 const id=await create(),first=await issue(id,[material('beef','10'),material('onion','2')]);
 expect(first.b).toMatchObject({reference:'PROD-000001',status:'in_progress',issuedAmount:'270.000000000000',wipAmount:'270.000000000000'});
 expect(first.b.issues[0].amount).toBe('250.000000000000');
 const before=await snapshot();expect(await postCentralKitchen(db,access,first.c)).toEqual(first.result);expect((await snapshot()).balances).toEqual(before.balances);
 await issue(id,[material('onion','1')]);expect((await state(id)).wipAmount).toBe('280.000000000000');expect(balance(await snapshot(),'onion')?.quantity).toBe('7.000000');
 await expect(postCentralKitchen(db,access,{...first.c,notes:'changed'})).rejects.toMatchObject({code:'PAYLOAD_CONFLICT'});
});

it('freezes the recipe cost reference when the batch is created and compares it with actual production cost',async()=>{
 const recipeId=uuid(),versionId=uuid(),definition={code:'REC-TEST',name:'كفتة معيارية',outputMode:'stocked',outputItemId:'kofta',outputUnitId:'kg',outputQuantity:'10',effectiveDate:date,lines:[{lineId:uuid(),kind:'material',itemId:'beef',unitId:'kg',inputUnit:'base',enteredQuantity:'8',quantity:'8'},{lineId:uuid(),kind:'material',itemId:'onion',unitId:'kg',inputUnit:'base',enteredQuantity:'2',quantity:'2'}]};
 await db.query("INSERT INTO recipes(organization_id,recipe_id,code,revision,state,payload,published_version_id) VALUES('grills',$1,'REC-TEST',1,'published',$2,$3)",[recipeId,JSON.stringify(definition),versionId]);
 await db.query("INSERT INTO recipe_versions(organization_id,version_id,recipe_id,version_number,payload) VALUES('grills',$1,$2,1,$3)",[versionId,recipeId,JSON.stringify(definition)]);
 const id=uuid();await postCentralKitchen(db,access,{...base(id,0),type:'central.create',locationId:'central',name:'دفعة مقارنة تكلفة',operationType:'manufacturing',recipeVersionId:versionId,plannedOutput:'10'});
 expect((await state(id)).costReference).toMatchObject({recipeVersionId:versionId,plannedOutput:'10',complete:true,batchCost:'220.000000000000',unitCost:'22.000000',lines:[{itemId:'beef',expectedQuantity:'8',amount:'200.000000000000'},{itemId:'onion',expectedQuantity:'2',amount:'20.000000000000'}]});
 await receipt('beef','10','100');expect((await state(id)).costReference?.batchCost).toBe('220.000000000000');
 await issue(id,[material('beef','9'),material('onion','1')]);await command(id,{type:'central.cost',amount:'15',reason:'تشغيل'});await receive(id,'10');await close(id);
 const closed=await state(id);expect(closed.costReference?.batchCost).toBe('220.000000000000');expect(closed).toMatchObject({status:'closed',outputAmount:'475.000000000000',processingAmount:'15.000000000000'});
});

it('holds partial receipts outside the available average, settles original-cost returns/losses and partially transfers to a real kitchen',async()=>{
 const initial=await snapshot(),id=await create();await issue(id,[material('beef','10'),material('onion','2')]);await receive(id,'6');
 expect(balance(await snapshot(),'kofta')).toEqual(balance(initial,'kofta'));
 await expect(postCommand(db,access,{operationId:uuid(),generation,organizationId:'grills',locationId:'central',type:'waste.post',itemId:'kofta',quantity:'6',reason:'Cannot use held output',businessDate:date,capturedAt:new Date().toISOString(),schemaVersion:1})).rejects.toMatchObject({code:'INSUFFICIENT_STOCK'});
 await issue(id,[material('onion','1')]);let b=await state(id);const onion=b.issues.find(i=>i.itemId==='onion')!,beef=b.issues.find(i=>i.itemId==='beef')!;
 await command(id,{type:'central.return',recipient:'أمين المخزن',lines:[{lineId:uuid(),issueLineId:onion.lineId,sourceId:onion.sources[0].sourceId,quantity:'0.5'}]});
 await command(id,{type:'central.loss',lines:[{lineId:uuid(),issueLineId:beef.lineId,quantity:'0.5',kind:'normal',reason:'فاقد تشغيل'}]});
 await command(id,{type:'central.cost',amount:'25',reason:'تشغيل'});await receive(id,'6');b=await state(id);
 expect(b).toMatchObject({status:'partially_received',returnedAmount:'5.000000000000',wipAmount:'300.000000000000'});
 await close(id);b=await state(id);expect(b).toMatchObject({status:'closed',outputAmount:'300.000000000000',wipAmount:'0.000000000000'});expect(b.receipts.map(r=>r.finalAmount)).toEqual(['150.000000000000','150.000000000000']);
 let s=await snapshot();expect(balance(s,'kofta')).toMatchObject({quantity:'17.000000',value:'500.000000000000'});expect(s.balances.reduce((a,b)=>a+Number(b.value),0)).toBe(825);
 await postSetupCommand(db,access,{operationId:uuid(),generation,organizationId:'grills',type:'kitchen.save',expectedRevision:0,record:{id:'kitchen',name:'Kitchen',active:true,locationId:'kitchen-location',parentLocationId:'central'},capturedAt:new Date().toISOString(),schemaVersion:1});
 const transferId=uuid(),lineId=uuid(),envelope={organizationId:'grills',generation,transferId,businessDate:date,reason:'Finished kofta',capturedAt:new Date().toISOString(),schemaVersion:1};
 await postTransfer(db,access,{...envelope,operationId:uuid(),type:'transfer.dispatch',expectedRevision:0,sourceId:'central',destinationId:'kitchen-location',lines:[{movementId:lineId,itemId:'kofta',unitId:'kg',quantity:'10'}]});
 await postTransfer(db,access,{...envelope,operationId:uuid(),type:'transfer.receive',expectedRevision:1,lines:[{movementId:uuid(),dispatchLineId:lineId,quantity:'4'}]});
 s=await snapshot();expect(balance(s,'kofta','kitchen-location')?.quantity).toBe('4.000000');expect(s.transfers!.find(t=>t.transferId===transferId)?.lines[0].remaining).toBe('6.000000');expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);
});

it('rejects unexplained material/weight balances and requires complete explicit cost allocations',async()=>{
 const id=await create();await issue(id);await receive(id,'6');await receive(id,'3','mix');
 await expect(command(id,{type:'central.close',consumption:[],allocations:[],balanceReason:''})).rejects.toMatchObject({code:'UNSETTLED_MATERIALS'});
 await expect(close(id)).rejects.toMatchObject({code:'WEIGHT_IMBALANCE',message:expect.stringContaining('إجمالي المواد المستهلكة بعد المرتجعات والفاقد 10 كجم، وإجمالي المنتجات المستلمة 9 كجم، والفرق 1 كجم')});
 const b=await state(id);await command(id,{type:'central.loss',lines:[{lineId:uuid(),issueLineId:b.issues[0].lineId,quantity:'1',reason:'تشغيل',kind:'normal'}]});
 await expect(close(id)).rejects.toMatchObject({code:'INVALID_COST_ALLOCATION'});
 await close(id,{allocations:[{itemId:'kofta',share:'75'},{itemId:'mix',share:'25'}]});
 expect((await state(id)).receipts.map(r=>r.finalAmount)).toEqual(['187.500000000000','62.500000000000']);expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);
});

it('separates abnormal losses while capitalizing normal yield loss',async()=>{
 const id=await create();await issue(id);const b=await state(id);
 await command(id,{type:'central.loss',lines:[{lineId:uuid(),issueLineId:b.issues[0].lineId,quantity:'0.5',reason:'فاقد طبيعي',kind:'normal'}]});
 await command(id,{type:'central.loss',lines:[{lineId:uuid(),issueLineId:b.issues[0].lineId,quantity:'0.5',reason:'تلف غير طبيعي',kind:'abnormal'}]});
 await receive(id,'9');await close(id);expect(await state(id)).toMatchObject({abnormalAmount:'12.500000000000',expenseAmount:'12.500000000000',outputAmount:'237.500000000000'});
});

it('uses linked reversals for issue, held receipt and unused closed output, then reconciles a new closing cost',async()=>{
 const initial=await snapshot(),id=await create(),issued=await issue(id);await command(id,{type:'central.reverse',targetOperationId:issued.c.operationId,reason:'تصحيح الصرف'});
 expect((await state(id)).issues).toEqual([]);expect((await snapshot()).balances).toEqual(initial.balances);
 await issue(id);const received=await receive(id,'10');await command(id,{type:'central.reverse',targetOperationId:received.c.operationId,reason:'تصحيح الاستلام'});expect((await state(id)).receipts).toEqual([]);
 await receive(id,'10');const closed=await close(id);await command(id,{type:'central.reverse',targetOperationId:closed.c.operationId,reason:'مصاريف ناقصة'});expect(await state(id)).toMatchObject({status:'partially_received',wipAmount:'250.000000000000'});
 expect(balance(await snapshot(),'kofta')).toEqual(balance(initial,'kofta'));await command(id,{type:'central.cost',amount:'50',reason:'مصاريف تشغيل'});await close(id);expect((await state(id)).outputAmount).toBe('300.000000000000');expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);
});

it('reverses returns, losses and processing costs without deleting their audit trail',async()=>{
 const id=await create();await issue(id);let b=await state(id),issueLine=b.issues[0];
 const returned=await command(id,{type:'central.return',recipient:'أمين المخزن',lines:[{lineId:uuid(),issueLineId:issueLine.lineId,sourceId:issueLine.sources[0].sourceId,quantity:'2'}]});
 expect((await state(id)).issues[0].returned).toBe('2');expect(balance(await snapshot(),'beef')?.quantity).toBe('12.000000');
 await command(id,{type:'central.reverse',targetOperationId:returned.c.operationId,reason:'إلغاء مرتجع خاطئ'});
 expect((await state(id)).issues[0].returned).toBe('0');expect(balance(await snapshot(),'beef')?.quantity).toBe('10.000000');
 b=await state(id);issueLine=b.issues[0];const lost=await command(id,{type:'central.loss',lines:[{lineId:uuid(),issueLineId:issueLine.lineId,quantity:'1',reason:'فاقد مسجل بالخطأ',kind:'normal'}]});
 expect((await state(id)).issues[0].lost).toBe('1');await command(id,{type:'central.reverse',targetOperationId:lost.c.operationId,reason:'إلغاء الفاقد'});
 expect((await state(id)).issues[0].lost).toBe('0');expect((await state(id)).losses).toEqual([]);
 const cost=await command(id,{type:'central.cost',amount:'50',reason:'تكلفة تجريبية'});expect((await state(id)).processingAmount).toBe('50.000000000000');
 await command(id,{type:'central.reverse',targetOperationId:cost.c.operationId,reason:'إلغاء تكلفة التشغيل'});expect((await state(id)).processingCosts).toEqual([]);expect((await state(id)).processingAmount).toBe('0.000000000000');
 const actions=((await snapshot()).centralActions??[]).filter((a:any)=>a.batchId===id);expect(actions.filter((a:any)=>a.command.type==='central.reverse')).toHaveLength(3);expect(actions.filter((a:any)=>a.reversedBy)).toHaveLength(3);
 expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);
});

it('prevents reversing a closed batch after downstream stock use, without changing accepted transactions',async()=>{
 const id=await create();await issue(id);await receive(id,'10');const closed=await close(id);
 await postCommand(db,access,{operationId:uuid(),generation,organizationId:'grills',locationId:'central',type:'waste.post',itemId:'kofta',quantity:'1',reason:'Downstream use',businessDate:date,capturedAt:new Date().toISOString(),schemaVersion:1});const before=await snapshot();
 await expect(command(id,{type:'central.reverse',targetOperationId:closed.c.operationId,reason:'تعديل لاحق'})).rejects.toMatchObject({code:'REVERSAL_STOCK_USED'});expect((await snapshot()).balances).toEqual(before.balances);expect((await state(id)).status).toBe('closed');
});

it('rolls back the entire issue if a later ingredient is insufficient and serializes concurrent reservations',async()=>{
 const id=await create(),before=await snapshot();await expect(issue(id,[material('beef','3'),material('onion','11')])).rejects.toMatchObject({code:'INSUFFICIENT_STOCK'});expect((await snapshot()).balances).toEqual(before.balances);expect((await state(id)).issues).toEqual([]);
 const revision=(await state(id)).revision,commands=[1,2].map(()=>({...base(id,revision),type:'central.issue',lines:[material('beef','15')]}));const results=await Promise.allSettled(commands.map(c=>postCentralKitchen(db,access,c)));expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(balance(await snapshot(),'beef')?.quantity).toBe('5.000000');
});

it('blocks excessive returns/losses, stale generations, read-only users, foreign tenants and future/closed dates',async()=>{
 const id=await create();await issue(id);const b=await state(id),i=b.issues[0];
 await expect(command(id,{type:'central.return',recipient:'أمين المخزن',lines:[{lineId:uuid(),issueLineId:i.lineId,sourceId:i.sources[0].sourceId,quantity:'11'}]})).rejects.toMatchObject({code:'EXCESS_RETURN'});
 await expect(command(id,{type:'central.loss',lines:[{lineId:uuid(),issueLineId:i.lineId,quantity:'11',kind:'normal',reason:'خاطئ'}]})).rejects.toMatchObject({code:'EXCESS_LOSS'});
 const c={...base(id,b.revision),type:'central.cost',amount:'1',reason:'تشغيل'};
 await expect(postCentralKitchen(db,{...access,role:'viewer'},c)).rejects.toMatchObject({code:'READ_ONLY_ACCOUNT'});
 await expect(postCentralKitchen(db,{...access,organizationId:'bistro'},c)).rejects.toMatchObject({code:'FORBIDDEN'});
 await expect(postCentralKitchen(db,access,{...c,generation:uuid()})).rejects.toMatchObject({code:'STALE_GENERATION'});
 await expect(postCentralKitchen(db,access,{...c,businessDate:'2099-01-01'})).rejects.toMatchObject({code:'FUTURE_DATE'});
 await db.query("INSERT INTO day_closures VALUES('grills','central','2026-10-10',1,'owner','closed',now())");await expect(postCentralKitchen(db,access,c)).rejects.toMatchObject({code:'PERIOD_CLOSED'});
});

it('requires an explanation across incompatible units and handles a fully lost batch without inventing products',async()=>{
 let id=await create();await issue(id);await command(id,{type:'central.receive',recipient:'أمين المخزن',lines:[{lineId:uuid(),itemId:'box',unitId:'piece',quantity:'10'}]});
 await expect(close(id)).rejects.toMatchObject({code:'BALANCE_REASON_REQUIRED'});await close(id,{balanceReason:'الناتج معدود؛ جميع المواد مستهلكة طبقًا للتسوية'});
 id=await create();await issue(id);const i=(await state(id)).issues[0];await command(id,{type:'central.loss',lines:[{lineId:uuid(),issueLineId:i.lineId,quantity:'10',reason:'فشل التشغيل',kind:'normal'}]});await close(id,{balanceReason:'فشل التشغيل بالكامل'});expect(await state(id)).toMatchObject({outputAmount:'0.000000000000',expenseAmount:'250.000000000000',wipAmount:'0.000000000000'});
});

it('preserves legacy FIFO issue-source values and repeats the additive schema without losing batches',async()=>{
 await db.query("UPDATE organizations SET costing_method='fifo' WHERE id='grills'");await db.query('UPDATE cost_layers SET remaining_value=NULL');const id=await create();await issue(id,[material('beef','12')]);const i=(await state(id)).issues[0];expect(i.amount).toBe('260.000000000000');
 await command(id,{type:'central.return',recipient:'أمين المخزن',lines:[{lineId:uuid(),issueLineId:i.lineId,sourceId:i.sources[0].sourceId,quantity:'2'}]});await receive(id,'10');await close(id);expect((await state(id)).outputAmount).toBe('220.000000000000');
 await db.exec(schema);expect((await state(id)).status).toBe('closed');expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);
});

it('does not allow optional package weights to override an output already measured in kilograms',async()=>{
 const id=await create();await issue(id);await command(id,{type:'central.receive',recipient:'Warehouse',lines:[{...material('kofta','12'),weightKg:'10'}]});await expect(close(id)).rejects.toMatchObject({code:'WEIGHT_IMBALANCE'});expect((await state(id)).status).toBe('partially_received');
});
