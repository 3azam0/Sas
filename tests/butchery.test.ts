import {beforeAll,afterAll,beforeEach,it,expect,vi} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {createDatabase,seed,getSnapshot,postCommand,postTransfer,postButchery,reconcileStock,postCosting} from '@saas/server';
import {resetDevelopmentOrganization} from '../packages/server/development';
import {schema} from '../packages/server/schema';
import type {Access,TransferDispatch,TransferCommand} from '@saas/contracts';
import type {ButcheryCommand,MeatKind} from '../packages/contracts/butchery';
import {decimal} from '@saas/domain';

let db:PGlite,generation:string;
const access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const base=()=>({generation,operationId:randomUUID(),organizationId:'grills',businessDate:today(),capturedAt:new Date().toISOString(),schemaVersion:1 as const,reason:'اختبار الجزارة'});
const send=(c:ButcheryCommand)=>postButchery(db,access,c);
async function product(meatKind:MeatKind){const itemId=randomUUID();await send({...base(),type:'product.create',itemId,name:'صنف '+itemId,unitId:'kg',meatKind});return itemId;}
async function receipt(itemId:string,q:string,cost:string,locationId='central'){return postCommand(db,access,{...base(),locationId,itemId,type:'receipt.post',quantity:q,unitCost:cost});}
async function input(){const id=await product('beef_input');await receipt(id,'2','100');await receipt(id,'8','150');return id;}
const beef=(itemId:string,outputs:{itemId:string;quantity:string;costShare:string}[],extra:Record<string,unknown>={})=>({...base(),type:'butchery.process' as const,locationId:'central',mode:'beef' as const,itemId,quantity:'10',slaughterLoss:'0',cuttingLoss:'1',processingCost:'100',outputs,...extra});
beforeAll(async()=>{
 db=await createDatabase();await seed(db,'fifo',false);
 for(const org of ['grills','bistro']){await db.query("INSERT INTO units(organization_id,id,name) VALUES($1,'kg','كجم'),($1,'piece','قطعة')",[org]);await db.query("INSERT INTO locations(organization_id,id,name,kind) VALUES($1,'central','المطبخ المركزي','مطبخ'),($1,'cairo','مطبخ الفرع','مطبخ')",[org]);}
});
beforeEach(async()=>{await db.transaction(async tx=>{await resetDevelopmentOrganization(tx,'grills','fifo',false);await resetDevelopmentOrganization(tx,'bistro','fifo',false);await tx.query('DELETE FROM butchery_catalog');});generation=(await getSnapshot(db,access)).generation!;});
afterAll(async()=>{vi.unstubAllEnvs();await db.close();});

it('allocates differing costs atomically and reconciles every leg and duplicate delivery',async()=>{
 const raw=await input(),a=await product('beef_product'),b=await product('beef_product');
 const c=beef(raw,[{itemId:a,quantity:'6',costShare:'80'},{itemId:b,quantity:'3',costShare:'20'}]);
 const [first,retry]=await Promise.all([send(c),send(c)]);expect(first).toEqual(retry);expect(first.amount).toBe('1500.000000000000');
 const s=await getSnapshot(db,access),p=s.butcheryDocuments!.find(p=>p.document.operationId===c.operationId)!;
 expect(p).toMatchObject({inputAmount:'1400.000000000000',amount:'1500.000000000000',method:'fifo',outputs:[{itemId:a,amount:'1200.000000000000',unitCost:'200.000000'},{itemId:b,amount:'300.000000000000',unitCost:'100.000000'}]});
 expect(s.balances.find(b=>b.itemId===raw)?.quantity).toBe('0.000000');expect(s.entries.filter(e=>e.butcheryId===c.operationId)).toHaveLength(3);expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);
 await expect(send({...c,processingCost:'101'})).rejects.toMatchObject({code:'PAYLOAD_CONFLICT'});
});

it('uses pooled moving average and blends new co-products with existing stock',async()=>{
 await db.query("UPDATE organizations SET costing_method='moving_average' WHERE id='grills'");
 const raw=await input(),a=await product('beef_product');await receipt(a,'1','100');
 const c=beef(raw,[{itemId:a,quantity:'9',costShare:'100'}],{quantity:'5',cuttingLoss:'0',outputs:[{itemId:a,quantity:'5',costShare:'100'}]});await send(c);
 const s=await getSnapshot(db,access);expect(s.butcheryDocuments!.find(d=>d.document.operationId===c.operationId)).toMatchObject({inputAmount:'700.000000000000',amount:'800.000000000000',method:'moving_average'});
 expect(s.balances.find(b=>b.itemId===a)).toMatchObject({quantity:'6.000000',value:'900.000000000000'});expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);
});

it('posts live sheep only after slaughter and cutting mass balances reconcile',async()=>{
 const raw=await product('sheep_live'),a=await product('lamb_product');await receipt(raw,'100','50');
 const c:ButcheryCommand={...base(),type:'butchery.process',mode:'lamb',locationId:'central',itemId:raw,quantity:'100',headCount:2,carcassWeight:'60',slaughterLoss:'40',cuttingLoss:'10',processingCost:'200',outputs:[{itemId:a,quantity:'50',costShare:'100'}]};
 await expect(send({...c,headCount:undefined})).rejects.toMatchObject({code:'INVALID_BUTCHERY'});
 await expect(send({...c,carcassWeight:'61'})).rejects.toMatchObject({code:'INVALID_BUTCHERY'});
 await send(c);expect((await getSnapshot(db,access)).balances.find(b=>b.itemId===a)?.value).toBe('5200.000000000000');
});

it('uses existing transfer dispatch/partial receipts for direct kitchen delivery with original allocated costs',async()=>{
 const raw=await input(),a=await product('beef_product');await send(beef(raw,[{itemId:a,quantity:'9',costShare:'100'}]));
 const d:TransferDispatch={...base(),type:'transfer.dispatch',transferId:randomUUID(),expectedRevision:0,sourceId:'central',destinationId:'cairo',lines:[{movementId:randomUUID(),itemId:a,unitId:'kg',quantity:'6'}]};await postTransfer(db,access,d);
 const r:TransferCommand={...base(),type:'transfer.receive',transferId:d.transferId,expectedRevision:1,lines:[{movementId:randomUUID(),dispatchLineId:d.lines[0].movementId,quantity:'2'}]};await postTransfer(db,access,r);
 const s=await getSnapshot(db,access),transit=s.transfers!.find(t=>t.transferId===d.transferId)!;expect(transit).toMatchObject({state:'partial',lines:[{remaining:'4.000000'}]});expect(s.balances.find(b=>b.itemId===a&&b.locationId==='cairo')?.quantity).toBe('2.000000');
 const value=s.balances.reduce((n,b)=>n.add(b.value),decimal('0')).add(transit.lines[0].remainingValue);expect(value.toFixed(12)).toBe('1500.000000000000');expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);
});

it('rejects wrong kinds, changed units, inactive references, repeated outputs, invalid shares and insufficient stock without effects',async()=>{
 const raw=await input(),a=await product('beef_product'),lamb=await product('lamb_product');const c=beef(raw,[{itemId:a,quantity:'9',costShare:'100'}]);
 const before=await getSnapshot(db,access);
 for(const bad of [{...c,outputs:[{itemId:a,quantity:'9',costShare:'99'}]},{...c,outputs:[{itemId:lamb,quantity:'9',costShare:'100'}]},{...c,outputs:[{itemId:a,quantity:'5',costShare:'50'},{itemId:a,quantity:'4',costShare:'50'}]},{...c,quantity:'11',cuttingLoss:'2'}])await expect(send(bad)).rejects.toThrow();
 await db.query("UPDATE items SET active=false WHERE organization_id='grills' AND id=$1",[a]);await expect(send(c)).rejects.toMatchObject({code:'INVALID_BUTCHERY'});await db.query("UPDATE items SET active=true,unit_id='piece' WHERE organization_id='grills' AND id=$1",[a]);await expect(send(c)).rejects.toMatchObject({code:'INVALID_BUTCHERY'});await db.query("UPDATE items SET unit_id='kg' WHERE organization_id='grills' AND id=$1",[a]);
 const after=await getSnapshot(db,access);expect(after.balances).toEqual(before.balances);expect(after.layers).toEqual(before.layers);expect(after.entries).toEqual(before.entries);expect(after.butcheryDocuments).toEqual(before.butcheryDocuments);
});

it('rolls back all stock and batch records if the final audit insertion fails',async()=>{
 const raw=await input(),a=await product('beef_product');const c=beef(raw,[{itemId:a,quantity:'9',costShare:'100'}]),before=await getSnapshot(db,access);
 await db.exec("ALTER TABLE audit_events ADD CONSTRAINT reject_butchery CHECK(action <> 'butchery.process')");await expect(send(c)).rejects.toThrow();await db.exec('ALTER TABLE audit_events DROP CONSTRAINT reject_butchery');
 const after=await getSnapshot(db,access);expect(after.balances).toEqual(before.balances);expect(after.layers).toEqual(before.layers);expect(after.butcheryDocuments).toEqual(before.butcheryDocuments);expect(after.acceptedOperationIds).toEqual(before.acceptedOperationIds);
});

it('conserves fractional assigned costs through FIFO outputs and full depletion, including zero-share by-products',async()=>{
 const raw=await product('beef_input'),a=await product('beef_product'),free=await product('beef_product');await receipt(raw,'3','0.333333');
 const c=beef(raw,[{itemId:a,quantity:'2',costShare:'100'},{itemId:free,quantity:'1',costShare:'0'}],{quantity:'3',cuttingLoss:'0',processingCost:'0.000001'});await send(c);
 const s=await getSnapshot(db,access);expect(s.balances.find(b=>b.itemId===a)?.value).toBe('1.000000000000');expect(s.balances.find(b=>b.itemId===free)?.value).toBe('0.000000000000');
 await postCommand(db,access,{...base(),type:'waste.post',locationId:'central',itemId:a,quantity:'2'});expect((await getSnapshot(db,access)).balances.find(b=>b.itemId===a)?.value).toBe('0.000000000000');expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);
});

it('isolates tenants and rejects stale generations, invalid access, reused operation IDs and future dates',async()=>{
 const a=await product('beef_product'),command:ButcheryCommand={...base(),type:'product.classify',itemId:a,meatKind:'beef_product'};
 await expect(postButchery(db,{...access,organizationId:'bistro'},command)).rejects.toMatchObject({code:'FORBIDDEN'});
 await expect(postButchery(db,{...access,expiresAt:'invalid'},command)).rejects.toMatchObject({code:'FORBIDDEN'});
 await expect(send({...command,generation:randomUUID()})).rejects.toMatchObject({code:'STALE_GENERATION'});
 await expect(send({...command,businessDate:'2099-01-01'})).rejects.toMatchObject({code:'FUTURE_DATE'});
 expect((await getSnapshot(db,{...access,organizationId:'bistro'})).butcheryCatalog).toEqual([]);
 const raw=await input(),c=beef(raw,[{itemId:a,quantity:'9',costShare:'100'}]);const prior=(await getSnapshot(db,access)).entries[0].operationId;await expect(send({...c,operationId:prior})).rejects.toMatchObject({code:'PAYLOAD_CONFLICT'});
});

it('classifies existing kg products without duplicating stock and preserves catalog type',async()=>{
 const raw=await input(),before=(await getSnapshot(db,access)).balances;
 await send({...base(),type:'product.classify',itemId:raw,meatKind:'beef_input'});expect((await getSnapshot(db,access)).balances).toEqual(before);
 await expect(send({...base(),type:'product.classify',itemId:raw,meatKind:'sheep_live'})).rejects.toMatchObject({code:'INVALID_BUTCHERY'});
 await expect(send({...base(),type:'product.create',itemId:randomUUID(),name:'وحدة غير صالحة',unitId:'piece',meatKind:'beef_product'})).rejects.toMatchObject({code:'INVALID_BUTCHERY'});
});

it('keeps batch history through additive schema replay and deletes it before a development reset clears referenced catalog',async()=>{
 const raw=await input(),a=await product('beef_product');await send(beef(raw,[{itemId:a,quantity:'9',costShare:'100'}]));await db.exec(schema);expect((await getSnapshot(db,access)).butcheryDocuments!.some(d=>d.document.type==='butchery.process')).toBe(true);
 vi.stubEnv('SAAS_DEMO_MODE','1');const s=await getSnapshot(db,access);await postCosting(db,access,{operationId:randomUUID(),organizationId:'grills',generation:s.generation,expectedRevision:s.costing!.revision,method:'moving_average',resetSamples:true});expect((await getSnapshot(db,access)).butcheryDocuments).toEqual([]);expect((await getSnapshot(db,access)).butcheryCatalog!.length).toBeGreaterThan(0);
 await db.transaction(tx=>resetDevelopmentOrganization(tx,'grills','fifo',true));expect((await getSnapshot(db,access)).butcheryCatalog).toEqual([]);
});
