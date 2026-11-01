import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {createDatabase,seed,postSetupCommand,postCommand,getSnapshot} from '@saas/server';
import {setupCommandSchema,type SetupCommand,type Access,type Command} from '@saas/contracts';
import {schema} from '../packages/server/schema';
let db:PGlite;
const access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
function setup(type:SetupCommand['type'],record:unknown,expectedRevision=0){return setupCommandSchema.parse({operationId:randomUUID(),organizationId:'grills',type,record,expectedRevision,capturedAt:new Date().toISOString(),schemaVersion:1});}
function stock(itemId:string,locationId:string,extra:Partial<Command>={}):Command{return{operationId:randomUUID(),organizationId:'grills',itemId,locationId,type:'receipt.post',quantity:'10',unitCost:'12',reason:'اختبار استلام',businessDate:'2026-10-09',capturedAt:new Date().toISOString(),schemaVersion:1,...extra};}
async function fixture(){
 const unit=setup('unit.save',{id:randomUUID(),name:`وحدة ${randomUUID()}`});
 const supplier=setup('supplier.save',{id:randomUUID(),name:'مورد الاختبار',phone:'01012345678',email:'',address:'القاهرة',active:true});
 const location=setup('location.save',{id:randomUUID(),name:'مطبخ اختبار',kind:'مطبخ تحضير',active:true});
 const pack={id:randomUUID(),name:'عبوة خمسة',factor:'5'};
 const item=setup('item.save',{id:randomUUID(),name:'مادة اختبار',sku:randomUUID(),category:'مواد جافة',unitId:unit.record.id,minimum:'2',active:true,purchaseUnits:[pack]});
 for(const c of [unit,supplier,location,item])await postSetupCommand(db,access,c);
 return {unit,supplier,location,item,pack};
}
beforeAll(async()=>{db=await createDatabase();await seed(db,'fifo');});
afterAll(async()=>{await db.close();});

it('creates scoped setup, receives packs into a new location and consumes FIFO',async()=>{
 const f=await fixture();
 const receipt=stock(f.item.record.id,f.location.record.id,{supplierId:f.supplier.record.id,purchaseUnitId:f.pack.id,enteredQuantity:'2'});
 expect((await postCommand(db,access,receipt)).amount).toBe('120.000000000000');
 await postCommand(db,access,stock(f.item.record.id,f.location.record.id,{type:'waste.post',quantity:'2',unitCost:undefined}));
 const snapshot=await getSnapshot(db,access);
 expect(snapshot.balances.find(b=>b.itemId===f.item.record.id)).toMatchObject({quantity:'8.000000',value:'96.000000000000'});
 expect(snapshot.items.find(i=>i.id===f.item.record.id)?.purchaseUnits).toEqual([f.pack]);
 const entry=(await db.query('SELECT supplier_id,entered_quantity::text FROM stock_entries WHERE operation_id=$1',[receipt.operationId])).rows[0];
 expect(entry).toMatchObject({supplier_id:f.supplier.record.id,entered_quantity:'2.000000'});
 const other=await getSnapshot(db,{...access,organizationId:'bistro'});expect(other.items.some(i=>i.id===f.item.record.id)).toBe(false);
 expect(other.suppliers?.some(s=>s.id===f.supplier.record.id)).toBe(false);
});
it('deduplicates setup retries and rejects changed operation payloads',async()=>{
 const c=setup('unit.save',{id:randomUUID(),name:`وحدة ${randomUUID()}`});
 const results=await Promise.all([postSetupCommand(db,access,c),postSetupCommand(db,access,c)]);expect(results[0]).toEqual(results[1]);
 expect((await db.query('SELECT 1 FROM audit_events WHERE operation_id=$1',[c.operationId])).rows).toHaveLength(1);
 await expect(postSetupCommand(db,access,{...c,record:{...c.record,name:'اسم مختلف'}})).rejects.toMatchObject({code:'PAYLOAD_CONFLICT'});
});
it('rejects stale edits, cross-tenant commands and cross-tenant unit references',async()=>{
 const f=await fixture();
 await postSetupCommand(db,access,setup('item.save',{...f.item.record,name:'اسم محدث'},1));
 await expect(postSetupCommand(db,access,setup('item.save',{...f.item.record,name:'تعديل قديم'},1))).rejects.toMatchObject({code:'REVISION_CONFLICT'});
 await expect(postSetupCommand(db,access,{...f.item,organizationId:'bistro'})).rejects.toMatchObject({code:'FORBIDDEN'});
 const otherUnit=setup('unit.save',{id:randomUUID(),name:`وحدة أخرى ${randomUUID()}`});
 await postSetupCommand(db,{...access,organizationId:'bistro'},{...otherUnit,organizationId:'bistro'});
 await expect(postSetupCommand(db,access,setup('item.save',{...f.item.record,id:randomUUID(),sku:randomUUID(),unitId:otherUnit.record.id}))).rejects.toMatchObject({code:'MISSING_UNIT'});
});
it('preserves base units and old packs while allowing additional packs',async()=>{
 const f=await fixture();
 await expect(postSetupCommand(db,access,setup('item.save',{...f.item.record,unitId:'كجم'},1))).rejects.toMatchObject({code:'UNIT_LOCKED'});
 await expect(postSetupCommand(db,access,setup('item.save',{...f.item.record,purchaseUnits:[{...f.pack,factor:'6'}]},1))).rejects.toMatchObject({code:'PACK_LOCKED'});
 await expect(postSetupCommand(db,access,setup('item.save',{...f.item.record,purchaseUnits:[]},1))).rejects.toMatchObject({code:'PACK_LOCKED'});
 const next={id:randomUUID(),name:'عبوة عشرة',factor:'10'};
 await postSetupCommand(db,access,setup('item.save',{...f.item.record,purchaseUnits:[f.pack,next]},1));
 expect((await getSnapshot(db,access)).items.find(i=>i.id===f.item.record.id)?.purchaseUnits).toHaveLength(2);
});
it('rejects invalid conversions and unavailable suppliers before any stock writes',async()=>{
 const f=await fixture();
 const c=stock(f.item.record.id,f.location.record.id,{purchaseUnitId:f.pack.id,enteredQuantity:'3'});
 await expect(postCommand(db,access,c)).rejects.toMatchObject({code:'INVALID_CONVERSION'});
 await expect(postCommand(db,access,{...c,purchaseUnitId:undefined,enteredQuantity:undefined,supplierId:randomUUID()})).rejects.toMatchObject({code:'INVALID_SUPPLIER'});
 expect((await getSnapshot(db,access)).entries.some(e=>e.itemId===f.item.record.id)).toBe(false);
});
it('deactivates a record without erasing stock or accepted operation history',async()=>{
 const f=await fixture();const c=stock(f.item.record.id,f.location.record.id);await postCommand(db,access,c);
 await postSetupCommand(db,access,setup('item.save',{...f.item.record,active:false},1));
 await expect(postCommand(db,access,stock(f.item.record.id,f.location.record.id))).rejects.toMatchObject({code:'INACTIVE_RECORD'});
 expect((await postCommand(db,access,c)).outcome).toBe('accepted');
 expect((await getSnapshot(db,access)).balances.find(b=>b.itemId===f.item.record.id)?.quantity).toBe('10.000000');
});
it('rolls back duplicate codes and setup audit failures completely',async()=>{
 const f=await fixture();const duplicate=setup('item.save',{...f.item.record,id:randomUUID()});
 await expect(postSetupCommand(db,access,duplicate)).rejects.toMatchObject({code:'DUPLICATE_RECORD'});
 expect((await getSnapshot(db,access)).acceptedOperationIds).not.toContain(duplicate.operationId);
 await db.exec("ALTER TABLE audit_events ADD CONSTRAINT reject_setup_fault CHECK(action <> 'supplier.save') NOT VALID;");
 const rejected=setup('supplier.save',{id:randomUUID(),name:'مورد مرفوض',phone:'',email:'',address:'',active:true});
 try{await expect(postSetupCommand(db,access,rejected)).rejects.toThrow();expect((await getSnapshot(db,access)).suppliers?.some(s=>s.id===rejected.record.id)).toBe(false);}finally{await db.exec('ALTER TABLE audit_events DROP CONSTRAINT reject_setup_fault;');}
});
it('reruns the additive migration without losing stock or duplicating renamed units',async()=>{
 const f=await fixture();await postCommand(db,access,stock(f.item.record.id,f.location.record.id));
 await postSetupCommand(db,access,setup('unit.save',{...f.unit.record,name:`اسم وحدة ${randomUUID()}`},1));
 const before=await getSnapshot(db,access);await db.exec(schema);const after=await getSnapshot(db,access);
 expect(after.units).toEqual(before.units);expect(after.balances).toEqual(before.balances);expect(after.acceptedOperationIds).toEqual(before.acceptedOperationIds);
});
