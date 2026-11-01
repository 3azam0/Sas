import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {createDatabase,seed,postCommand,postWorkshopCommand,getSnapshot} from '@saas/server';
import type {Access} from '@saas/contracts';
import {convertUnit} from '../packages/server/production';
let db:PGlite;
const access:Access={organizationId:'grills',userId:'warehouse',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
const base=()=>({operationId:randomUUID(),organizationId:'grills',businessDate:'2026-10-29',capturedAt:new Date().toISOString(),schemaVersion:1,reason:'production test'});
const send=(c:Record<string,unknown>)=>postWorkshopCommand(db,access,{...base(),...c});
const receipt=(itemId:string,quantity:string,unitCost:string)=>postCommand(db,access,{...base(),type:'receipt.post',locationId:'central',itemId,quantity,unitCost});
async function product(name:string,role='finished',unit='كجم'){const itemId=randomUUID();await send({type:'catalog.create',itemId,name,unit,role});return itemId;}
async function create(output:string,balanceMode='mass',outputs?:unknown[]){const batchId=randomUUID();await send({type:'production.create',batchId,name:'دفعة كفتة',operationType:'manufacturing',recipient:'الشيف أحمد',balanceMode,outputs:outputs||[{itemId:output,quantity:'14',costShare:'100'}]});return batchId;}
async function batch(id:string){return (await getSnapshot(db,access)).productionBatches!.find(b=>b.id===id)!;}
beforeAll(async()=>{db=await createDatabase();await seed(db);});
beforeEach(async()=>{await db.exec('TRUNCATE valuation_heads,valuation_edges,valuation_nodes,cost_adjustments,production_batches,audit_events,layer_allocations,command_receipts,stock_entries,cost_layers,stock_balances,workshop_documents,transfers RESTART IDENTITY');});
afterAll(async()=>{await db.close();});

it('settles multi-input kofta, original-cost returns, partial receipts, downstream stock/transit/consumed costs',async()=>{
 const onion=await product('بصل','raw'),kofta=await product('كفتة');await receipt('beef','10','100');await receipt('beef','10','160');await receipt(onion,'5','10');
 const id=await create(kofta);await send({type:'production.issue',batchId:id,recipient:'أحمد',lines:[{itemId:'beef',quantity:'10',unit:'كجم'},{itemId:onion,quantity:'5000',unit:'جم'}]});
 let b=await batch(id);expect(b.wipValue).toBe('1350.000000000000');expect(b.issues.find(i=>i.itemId==='beef')?.amount).toBe('1300.000000000000');
 const onionIssue=b.issues.find(i=>i.itemId===onion)!;await receipt(onion,'1','100');
 const returned=await send({type:'production.return',batchId:id,issueId:onionIssue.id,quantity:'0.5'});expect(returned.amount).toBe('5.000000000000');
 await send({type:'production.receive',batchId:id,itemId:kofta,quantity:'7',provisionalValue:'600'});
 const dispatchId=randomUUID();await send({operationId:dispatchId,type:'transfer.dispatch',sourceId:'central',destinationId:'cairo',itemId:kofta,quantity:'4'});await send({type:'transfer.receive',transferId:dispatchId,quantity:'3'});
 await postCommand(db,access,{...base(),type:'waste.post',locationId:'cairo',itemId:kofta,quantity:'1'});
 await send({type:'production.cost',batchId:id,amount:'55'});
 await send({type:'production.receive',batchId:id,itemId:kofta,quantity:'7',provisionalValue:'600'});
 b=await batch(id);const close={...base(),type:'production.close',batchId:id,reconciliationNote:'',usages:b.issues.map(i=>({issueId:i.id,consumed:i.itemId===onion?'4':'10',loss:i.itemId===onion?'0.5':'0',lossReason:i.itemId===onion?'فاقد تجهيز':''}))};
 const posted=await send(close);expect(posted.amount).toBe('1400.000000000000');expect(await send(close)).toEqual(posted);
 b=await batch(id);expect(b.status).toBe('closed');expect(b.wipValue).toBe('0.000000000000');
 const s=await getSnapshot(db,access);const stock=(at:string)=>s.balances.find(v=>v.locationId===at&&v.itemId===kofta)!;
 expect(stock('central').quantity).toBe('10.000000');expect(Number(stock('central').value)).toBeCloseTo(1000,8);expect(Number(stock('cairo').value)).toBeCloseTo(200,8);
 expect(Number(s.transfers!.find(t=>t.id===dispatchId)!.remainingValue)).toBeCloseTo(100,8);
 expect(s.costAdjustments!.filter(a=>a.kind==='consumed').reduce((n,a)=>n+Number(a.amount),0)).toBeCloseTo(100-600/7,8);
 await expect(send({type:'production.cost',batchId:id,amount:'1'})).rejects.toThrow('مغلقة');
});

it('supports additional material issues and rejects unexplained closure without changing anything',async()=>{
 const out=await product('لحم مجهز');await receipt('beef','10','100');const id=await create(out);await send({type:'production.issue',batchId:id,recipient:'أحمد',lines:[{itemId:'beef',quantity:'5',unit:'كجم'}]});await receipt('beef','5','200');await send({type:'production.issue',batchId:id,recipient:'أحمد',lines:[{itemId:'beef',quantity:'5',unit:'كجم'}]});
 const b=await batch(id);expect(b.issues.map(i=>i.amount)).toEqual(['500.000000000000','750.000000000000']);await send({type:'production.receive',batchId:id,itemId:out,quantity:'9',provisionalValue:'1000'});
 const before=await getSnapshot(db,access);await expect(send({type:'production.close',batchId:id,reconciliationNote:'',usages:b.issues.map(i=>({issueId:i.id,consumed:'5',loss:'0',lossReason:''}))})).rejects.toThrow('وزن');expect((await getSnapshot(db,access)).balances).toEqual(before.balances);expect((await batch(id)).status).toBe('partially_received');
});

it('allocates multiple outputs and rejects excess returns, tenant access and atomic concurrent overissues',async()=>{
 const a=await product('منتج ألف'),b=await product('منتج باء');await receipt('beef','10','100');const id=await create(a,'mass',[{itemId:a,quantity:'6',costShare:'80'},{itemId:b,quantity:'3',costShare:'20'}]);
 const issue={type:'production.issue',batchId:id,recipient:'أحمد',lines:[{itemId:'beef',quantity:'10',unit:'كجم'}]};const competing=await Promise.allSettled([send(issue),send(issue)]);expect(competing.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 const x=await batch(id);await expect(send({type:'production.return',batchId:id,issueId:x.issues[0].id,quantity:'11'})).rejects.toThrow('يتجاوز');
 await send({type:'production.receive',batchId:id,itemId:a,quantity:'6',provisionalValue:'500'});await send({type:'production.receive',batchId:id,itemId:b,quantity:'3',provisionalValue:'300'});
 await send({type:'production.close',batchId:id,reconciliationNote:'',usages:[{issueId:x.issues[0].id,consumed:'9',loss:'1',lossReason:'تقطيع'}]});
 const s=await getSnapshot(db,access);expect(s.balances.find(v=>v.itemId===a)?.value).toBe('800.000000000000');expect(s.balances.find(v=>v.itemId===b)?.value).toBe('200.000000000000');
 await expect(postWorkshopCommand(db,{...access,organizationId:'bistro'},{...base(),type:'production.cost',batchId:id,amount:'1'})).rejects.toMatchObject({code:'FORBIDDEN'});
});

it('counts at average cost and rejects stale count snapshots; validates compatible units',async()=>{
 await receipt('beef','10','100');await receipt('beef','10','160');const c={type:'inventory.count',locationId:'central',itemId:'beef',quantity:'19',expectedQuantity:'20',expectedValue:'2600',expectedRevision:(await getSnapshot(db,access)).balances.find(b=>b.itemId==='beef')!.revision!,unitCost:'0'};expect((await send(c)).amount).toBe('130.000000000000');await expect(send(c)).rejects.toThrow('حدثت حركة');
 expect(convertUnit('500','جم','كجم')).toBe('0.500000');expect(convertUnit('1','لتر','مل')).toBe('1000.000000');expect(()=>convertUnit('1','لتر','كجم')).toThrow('غير متوافقة');
});

it('reverses an untouched receipt with linked history and cancels a fully returned batch',async()=>{
 const out=await product('منتج قابل للعكس');await receipt('beef','2','100');const id=await create(out);await send({type:'production.issue',batchId:id,recipient:'أحمد',lines:[{itemId:'beef',quantity:'2',unit:'كجم'}]});const r=randomUUID();await send({operationId:r,type:'production.receive',batchId:id,itemId:out,quantity:'2',provisionalValue:'200'});await send({type:'production.reverse',batchId:id,targetOperationId:r});const b=await batch(id);expect(b.receipts[0].reversed).toBe(true);await send({type:'production.return',batchId:id,issueId:b.issues[0].id,quantity:'2'});await send({type:'production.cancel',batchId:id});expect((await batch(id)).status).toBe('cancelled');
});

it('records losses before closing and atomically rolls back a multi-line overissue',async()=>{
 const out=await product('منتج فاقد');await receipt('beef','10','100');const id=await create(out);const before=await getSnapshot(db,access);
 await expect(send({type:'production.issue',batchId:id,recipient:'أحمد',lines:[{itemId:'beef',quantity:'5',unit:'كجم'},{itemId:'chicken',quantity:'1',unit:'كجم'}]})).rejects.toMatchObject({code:'INSUFFICIENT_STOCK'});expect((await getSnapshot(db,access)).balances).toEqual(before.balances);expect((await batch(id)).issues).toHaveLength(0);
 await send({type:'production.issue',batchId:id,recipient:'أحمد',lines:[{itemId:'beef',quantity:'10',unit:'كجم'}]});const i=(await batch(id)).issues[0];await send({type:'production.loss',batchId:id,issueId:i.id,quantity:'1'});await expect(send({type:'production.return',batchId:id,issueId:i.id,quantity:'10'})).rejects.toThrow('يتجاوز');await send({type:'production.receive',batchId:id,itemId:out,quantity:'9',provisionalValue:'1000'});await send({type:'production.close',batchId:id,reconciliationNote:'',usages:[{issueId:i.id,consumed:'9',loss:'1',lossReason:'تقطيع'}]});expect((await batch(id)).finalCost).toBe('1000.000000000000');
});

it('preserves all fractional issue value across repeated unused returns',async()=>{
 const out=await product('منتج كسور');await receipt('beef','3','0.333333');const id=await create(out);await send({type:'production.issue',batchId:id,recipient:'أحمد',lines:[{itemId:'beef',quantity:'3',unit:'كجم'}]});const i=(await batch(id)).issues[0];for(let n=0;n<3;n++)await send({type:'production.return',batchId:id,issueId:i.id,quantity:'1'});await send({type:'production.cancel',batchId:id});expect((await batch(id)).wipValue).toBe('0.000000000000');expect((await getSnapshot(db,access)).balances.find(b=>b.itemId==='beef')?.value).toBe('0.999999000000');
});

it('retains sheep slaughter measurements in the staged production workflow',async()=>{
 const sheep=randomUUID(),out=randomUUID();await send({type:'product.create',itemId:sheep,name:'ضاني حي إنتاج',meatKind:'sheep_live'});await send({type:'product.create',itemId:out,name:'ضاني مجهز إنتاج',meatKind:'lamb_product'});await receipt(sheep,'20','100');const id=randomUUID();await send({type:'production.create',batchId:id,name:'دفعة ذبح',operationType:'butchery',recipient:'أحمد',balanceMode:'mass',outputs:[{itemId:out,quantity:'10',costShare:'100'}]});await send({type:'production.issue',batchId:id,recipient:'أحمد',lines:[{itemId:sheep,quantity:'20',unit:'كجم'}]});await send({type:'production.receive',batchId:id,itemId:out,quantity:'10',provisionalValue:'2000'});const i=(await batch(id)).issues[0];await send({type:'production.close',batchId:id,reconciliationNote:'',butchery:{mode:'lamb',headCount:1,carcassWeight:'12',slaughterLoss:'8',cuttingLoss:'2'},usages:[{issueId:i.id,consumed:'10',loss:'10',lossReason:'ذبح وتقطيع'}]});expect((await batch(id)).finalCost).toBe('2000.000000000000');
});

it('propagates final source cost into an open downstream production batch',async()=>{
 const intermediate=await product('منتج وسيط تكلفة','intermediate'),finished=await product('منتج تابع تكلفة');await receipt('beef','10','100');const source=await create(intermediate);await send({type:'production.issue',batchId:source,recipient:'أحمد',lines:[{itemId:'beef',quantity:'10',unit:'كجم'}]});await send({type:'production.receive',batchId:source,itemId:intermediate,quantity:'10',provisionalValue:'500'});const downstream=await create(finished);await send({type:'production.issue',batchId:downstream,recipient:'أحمد',lines:[{itemId:intermediate,quantity:'10',unit:'كجم'}]});const i=(await batch(source)).issues[0];await send({type:'production.close',batchId:source,reconciliationNote:'',usages:[{issueId:i.id,consumed:'10',loss:'0',lossReason:''}]});expect((await batch(downstream)).wipValue).toBe('1000.000000000000');
});

it('blocks source revaluation after a dependent production batch has already closed',async()=>{
 const intermediate=await product('منتج وسيط مغلق','intermediate'),finished=await product('منتج تابع مغلق');await receipt('beef','10','100');const source=await create(intermediate);await send({type:'production.issue',batchId:source,recipient:'أحمد',lines:[{itemId:'beef',quantity:'10',unit:'كجم'}]});await send({type:'production.receive',batchId:source,itemId:intermediate,quantity:'10',provisionalValue:'500'});const downstream=await create(finished);await send({type:'production.issue',batchId:downstream,recipient:'أحمد',lines:[{itemId:intermediate,quantity:'10',unit:'كجم'}]});await send({type:'production.receive',batchId:downstream,itemId:finished,quantity:'10',provisionalValue:'500'});const d=(await batch(downstream)).issues[0];await send({type:'production.close',batchId:downstream,reconciliationNote:'',usages:[{issueId:d.id,consumed:'10',loss:'0',lossReason:''}]});const i=(await batch(source)).issues[0],before=await getSnapshot(db,access);await expect(send({type:'production.close',batchId:source,reconciliationNote:'',usages:[{issueId:i.id,consumed:'10',loss:'0',lossReason:''}]})).rejects.toMatchObject({code:'DEPENDENT_BATCH_CLOSED'});expect((await getSnapshot(db,access)).balances).toEqual(before.balances);expect((await batch(source)).status).toBe('partially_received');
});
