import {beforeAll,afterAll,beforeEach,it,expect} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {createDatabase,seed,postCommand,postWorkshopCommand,getSnapshot} from '@saas/server';
import type {Access} from '@saas/contracts';
import type {WorkshopCommand,MeatKind} from '../packages/contracts/butchery';
import {decimal} from '@saas/domain';
let db:PGlite;
const access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
const base=()=>({operationId:randomUUID(),organizationId:'grills' as const,businessDate:'2026-10-26',capturedAt:new Date().toISOString(),schemaVersion:1 as const,reason:'اختبار جزارة'});
const send=(c:WorkshopCommand)=>postWorkshopCommand(db,access,c);
async function product(name:string,meatKind:MeatKind){const itemId=randomUUID();await send({...base(),type:'product.create',itemId,name,meatKind});return itemId;}
async function receive(itemId:string,quantity:string,unitCost:string,locationId='central'){await postCommand(db,access,{...base(),type:'receipt.post',itemId,quantity,unitCost,locationId});}
async function transfer(itemId:string,quantity:string,sourceId='central',destinationId='butchery'){const c:WorkshopCommand={...base(),type:'transfer.dispatch',itemId,quantity,sourceId,destinationId};await send(c);await send({...base(),type:'transfer.receive',transferId:c.operationId,quantity});return c.operationId;}
const beef=(itemId:string,outputs:{itemId:string;quantity:string;costShare:string}[],overrides:Record<string,unknown>={})=>({...base(),type:'butchery.process' as const,mode:'beef' as const,itemId,quantity:'10',slaughterLoss:'0',cuttingLoss:'1',processingCost:'100',outputs,...overrides});
beforeAll(async()=>{db=await createDatabase();await seed(db);});
beforeEach(async()=>{await db.exec('TRUNCATE valuation_heads,valuation_edges,valuation_nodes,cost_adjustments,production_batches,audit_events,layer_allocations,command_receipts,stock_entries,cost_layers,stock_balances,workshop_documents,transfers RESTART IDENTITY;');});
afterAll(async()=>{await db.close();});

it('processes beef with unequal costs, splits destinations and preserves in-transit value',async()=>{
 const a=await product('قطع مطبخ أ','beef_product'),b=await product('قطع مطبخ ب','beef_product');
 await receive('beef','10','100');await transfer('beef','10');
 const c=beef('beef',[{itemId:a,quantity:'6',costShare:'80'},{itemId:b,quantity:'3',costShare:'20'}]);
 const [first,retry]=await Promise.all([send(c),send(c)]);expect(first).toEqual(retry);expect(first.amount).toBe('1100.000000000000');
 let s=await getSnapshot(db,access);const balance=(at:string,id:string)=>s.balances.find(v=>v.locationId===at&&v.itemId===id)!;
 expect(balance('butchery','beef').quantity).toBe('0.000000');expect(balance('butchery',a).value).toBe('880.000000000000');expect(balance('butchery',b).value).toBe('220.000000000000');
 const dispatch:WorkshopCommand={...base(),type:'transfer.dispatch',sourceId:'butchery',destinationId:'cairo',itemId:a,quantity:'4'};await send(dispatch);
 s=await getSnapshot(db,access);expect(balance('cairo',a)).toBeUndefined();expect(s.transfers?.find(t=>t.id===dispatch.operationId)?.remaining).toBe('4.000000');
 const receipt:WorkshopCommand={...base(),type:'transfer.receive',transferId:dispatch.operationId,quantity:'1'};await Promise.all([send(receipt),send(receipt)]);
 await transfer(a,'2','butchery','central');
 s=await getSnapshot(db,access);expect(balance('cairo',a).quantity).toBe('1.000000');expect(balance('central',a).quantity).toBe('2.000000');expect(s.transfers?.find(t=>t.id===dispatch.operationId)?.remaining).toBe('3.000000');
 const stockValue=s.balances.reduce((n,v)=>n.add(v.value),decimal('0')),transitValue=s.transfers!.reduce((n,t)=>n.add(t.remainingValue),decimal('0'));
 expect(stockValue.add(transitValue).toFixed(12)).toBe('1100.000000000000');
 const document=s.workshopDocuments?.find(d=>d.id===c.operationId);expect((document?.details.legs as string[])).toHaveLength(3);expect(document?.details.allocations).toBeTruthy();
 await expect(send({...c,processingCost:'101'})).rejects.toMatchObject({code:'PAYLOAD_CONFLICT'});
 await expect(send({...base(),type:'transfer.receive',transferId:dispatch.operationId,quantity:'4'})).rejects.toMatchObject({code:'INVALID_COMMAND'});
});

it('slaughters only sheep and reconciles live, usable carcass and cutting weights',async()=>{
 const live=await product('ضاني حي مخصص','sheep_live'),cut=await product('منتج ضاني خاص','lamb_product');await receive(live,'100','50');await transfer(live,'100');
 const c:WorkshopCommand={...base(),type:'butchery.process',mode:'lamb',itemId:live,quantity:'100',headCount:2,carcassWeight:'60',slaughterLoss:'40',cuttingLoss:'10',processingCost:'200',outputs:[{itemId:cut,quantity:'50',costShare:'100'}]};
 await expect(send({...c,carcassWeight:'61'})).rejects.toMatchObject({code:'INVALID_COMMAND'});
 await expect(send({...c,headCount:undefined})).rejects.toMatchObject({code:'INVALID_COMMAND'});
 await send(c);const s=await getSnapshot(db,access);expect(s.balances.find(b=>b.itemId===cut)?.value).toBe('5200.000000000000');expect(s.workshopDocuments?.find(d=>d.id===c.operationId)?.command).toMatchObject({headCount:2,carcassWeight:'60'});
});

it('rejects wrong species, units, repeated products, invalid shares and missing input stock atomically',async()=>{
 const a=await product('شرائح اختبار','beef_product'),lamb=await product('ضاني اختبار','lamb_product');await receive('beef','10','100');await transfer('beef','10');
 const c=beef('beef',[{itemId:a,quantity:'9',costShare:'100'}]);const before=await getSnapshot(db,access);
 for(const invalid of [
  {...c,outputs:[{itemId:a,quantity:'9',costShare:'99'}]},
  {...c,outputs:[{itemId:lamb,quantity:'9',costShare:'100'}]},
  {...c,outputs:[{itemId:a,quantity:'5',costShare:'50'},{itemId:a,quantity:'4',costShare:'50'}]},
  {...c,itemId:'chicken'}, {...c,quantity:'11',cuttingLoss:'2'}
 ])await expect(send(invalid)).rejects.toThrow();
 const after=await getSnapshot(db,access);expect(after.balances).toEqual(before.balances);expect(after.entries).toEqual(before.entries);expect(after.workshopDocuments).toEqual(before.workshopDocuments);
 await db.exec("ALTER TABLE audit_events ADD CONSTRAINT workshop_fault CHECK(action <> 'butchery.process');");
 await expect(send(c)).rejects.toThrow();expect((await getSnapshot(db,access)).balances).toEqual(before.balances);
 await db.exec('ALTER TABLE audit_events DROP CONSTRAINT workshop_fault;');
});

it('retains all assigned value through repeating fractional costs and final depletion',async()=>{
 const a=await product('كسور تكلفة','beef_product');await receive('beef','3','0.333333');await transfer('beef','3');
 await send(beef('beef',[{itemId:a,quantity:'7',costShare:'100'}],{quantity:'3',cuttingLoss:'0',outputs:[{itemId:a,quantity:'3',costShare:'100'}],processingCost:'0.000001'}));
 const id=await transfer(a,'3','butchery','alex');expect(id).toBeTruthy();
 for(let i=0;i<3;i++)await postCommand(db,access,{...base(),type:'waste.post',locationId:'alex',itemId:a,quantity:'1'});
 const s=await getSnapshot(db,access);expect(s.balances.filter(b=>b.itemId===a).every(b=>decimal(b.value).isZero()&&decimal(b.quantity).isZero())).toBe(true);
 const allocations=await db.query<{amount:string}>('SELECT sum(amount)::text AS amount FROM layer_allocations a JOIN cost_layers l ON l.id=a.layer_id AND l.organization_id=a.organization_id WHERE l.location_id=$1 AND l.item_id=$2',['alex',a]);expect(allocations.rows[0].amount).toBe('1.000000000000');
});

it('isolates catalog, documents and transfers by tenant and refuses expired access',async()=>{
 const c:WorkshopCommand={...base(),type:'product.create',itemId:randomUUID(),name:'صنف معزول',meatKind:'beef_product'};await send(c);
 const other={...access,organizationId:'bistro' as const};expect((await getSnapshot(db,other)).items.some(i=>i.id===c.itemId)).toBe(false);
 await expect(postWorkshopCommand(db,other,c)).rejects.toMatchObject({code:'FORBIDDEN'});
 await expect(postWorkshopCommand(db,{...access,expiresAt:'invalid'},c)).rejects.toMatchObject({code:'FORBIDDEN'});
 await receive('beef','1','100');const dispatch:WorkshopCommand={...base(),type:'transfer.dispatch',sourceId:'central',destinationId:'butchery',itemId:'beef',quantity:'1'};await send(dispatch);
 await expect(postWorkshopCommand(db,other,{...base(),organizationId:'bistro',type:'transfer.receive',transferId:dispatch.operationId,quantity:'1'})).rejects.toMatchObject({code:'INVALID_COMMAND'});
 expect((await getSnapshot(db,other)).transfers).toHaveLength(0);
});
