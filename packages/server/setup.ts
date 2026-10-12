import {assertGeneration,planIssue,applyIssue} from './valuation';
import type {Database} from './database';
import {createHash} from 'node:crypto';
import {setupCommandSchema,BusinessError,type Access,type CommandResult,type PurchaseUnit} from '@saas/contracts';

export async function postSetupCommand(db:Database,access:Access,input:unknown):Promise<CommandResult>{
  const parsed=setupCommandSchema.safeParse(input);
  if(!parsed.success)throw new BusinessError('INVALID_COMMAND','تحقق من بيانات الإعداد.',400);
  const c=parsed.data,org=c.organizationId;
  if(org!==access.organizationId||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','الجلسة لا تسمح بتعديل هذه المؤسسة.',403);
  const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
  try{return await db.transaction(async tx=>{
    const organization=await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);
 await assertGeneration(tx,c.organizationId,c.generation);
    if(!organization.rows.length)throw new BusinessError('FORBIDDEN','المؤسسة غير متاحة.',403);
    const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[org,c.operationId])).rows[0];
    if(prior){if(prior.payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','معرّف العملية مستخدم لبيانات مختلفة.');return prior.result;}
    const table={ 'unit.save':'units','supplier.save':'suppliers','location.save':'locations','item.save':'items','kitchen.save':'kitchens'}[c.type];
    const previous=(await tx.query<{revision:number;unit_id?:string;purchase_units?:PurchaseUnit[]}>(`SELECT * FROM ${table} WHERE organization_id=$1 AND id=$2`,[org,c.record.id])).rows[0];
    if((previous?.revision??0)!==c.expectedRevision)throw new BusinessError('REVISION_CONFLICT','تغيرت البيانات على جهاز آخر. ألغِ التعديل المرفوض ثم افتح السجل من جديد.');
    const r=c.record,revision=c.expectedRevision+1;
    if(c.type==='unit.save'){
      await tx.query('INSERT INTO units(organization_id,id,name,revision) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,id) DO UPDATE SET name=$3,revision=$4',[org,r.id,r.name,revision]);
      await tx.query('UPDATE items SET unit=$3 WHERE organization_id=$1 AND unit_id=$2',[org,r.id,r.name]);
    }else if(c.type==='kitchen.save'){
      const k=c.record;
      await tx.query('INSERT INTO kitchens(organization_id,id,name,active,revision) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,id) DO UPDATE SET name=$3,active=$4,revision=$5',[org,k.id,k.name,k.active,revision]);
    }else if(c.type==='supplier.save'){
      const s=c.record;
      await tx.query('INSERT INTO suppliers(organization_id,id,name,phone,email,address,active,revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(organization_id,id) DO UPDATE SET name=$3,phone=$4,email=$5,address=$6,active=$7,revision=$8',[org,s.id,s.name,s.phone,s.email,s.address,s.active,revision]);
    }else if(c.type==='location.save'){
      const l=c.record;
      await tx.query('INSERT INTO locations(organization_id,id,name,kind,active,revision) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(organization_id,id) DO UPDATE SET name=$3,kind=$4,active=$5,revision=$6',[org,l.id,l.name,l.kind,l.active,revision]);
    }else{
      const i=c.record;
      const unit=(await tx.query<{name:string}>('SELECT name FROM units WHERE organization_id=$1 AND id=$2',[org,i.unitId])).rows[0];
      if(!unit)throw new BusinessError('MISSING_UNIT','وحدة المخزون لم تتم مزامنتها أو تخص مؤسسة أخرى.');
      if(previous&&previous.unit_id!==i.unitId)throw new BusinessError('UNIT_LOCKED','وحدة المخزون الأساسية ثابتة بعد إنشاء المادة. أنشئ مادة جديدة لوحدة مختلفة.');
      for(const pack of previous?.purchase_units??[]){const next=i.purchaseUnits.find(p=>p.id===pack.id);if(!next||next.factor!==pack.factor||next.name!==pack.name)throw new BusinessError('PACK_LOCKED','وحدات الشراء السابقة ثابتة؛ أضف وحدة جديدة للتحويل المختلف.');}
      await tx.query('INSERT INTO items(organization_id,id,name,sku,category,unit,minimum,unit_id,purchase_units,active,revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(organization_id,id) DO UPDATE SET name=$3,sku=$4,category=$5,minimum=$7,purchase_units=$9,active=$10,revision=$11',[org,i.id,i.name,i.sku,i.category,unit.name,i.minimum,i.unitId,JSON.stringify(i.purchaseUnits),i.active,revision]);
    }
    await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[org,access.userId,c.operationId,c.type]);
    const result:CommandResult={operationId:c.operationId,outcome:'accepted'};
    await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,c.operationId,hash,JSON.stringify(result)]);
    return result;
  });}catch(error){if((error as {code?:string}).code==='23505')throw new BusinessError('DUPLICATE_RECORD','الكود أو الاسم مستخدم بالفعل في المؤسسة.');throw error;}
}
