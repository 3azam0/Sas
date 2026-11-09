import {createHash,randomUUID} from 'node:crypto';
import {BusinessError,posOrderCommandSchema,orderDraftSchema,type Access,type CommandResult,type POSOrder,type POSOrdersSnapshot,type POSShift,type CollectionEntry,type OrderChange,type DiningTable,type PointOfSale,type Kitchen,type Location,type OrderDraft,type OrderStock,type MenuItem} from '@saas/contracts';
import type {Database,QueryDatabase} from './database';
import {decimal} from '@saas/domain';
import {egyptDate} from '../domain/reporting';
import {orderTotal,qibliTablesAllowed,validateOrderContext,settleOrderDifference,legacyPOSOrder} from '../domain/pos-orders';
import {validateSale,salesStockRequirements} from '../domain/sales';
import {posLineAmount,posSaleReference} from '../domain/pos';
import {assertGeneration,planIssue,applyIssue} from './valuation';
import {assertInventoryWrite,assertInventoryManager,assertInventoryDateOpen} from './inventory-permissions';
import {addIncomingStock} from './incoming';
import {recipeSnapshot} from './recipes';
import {reconcileStock} from './counts';
import {projectPOSOrder} from './pos-sales-projection';
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function posOrdersSnapshot(tx:QueryDatabase,org:string):Promise<{posOrders:POSOrdersSnapshot}>{
 const read=async<T>(table:string,order:string)=>(await tx.query<{payload:T}>(`SELECT payload FROM ${table} WHERE organization_id=$1 ORDER BY ${order}`,[org])).rows.map(r=>r.payload);
 return {posOrders:{tables:(await tx.query<DiningTable>('SELECT id::text,pos_id AS "posId",name,seats,active,revision FROM pos_dining_tables WHERE organization_id=$1 ORDER BY name,id',[org])).rows,orders:await read<POSOrder>('pos_orders',"payload->>'updatedAt',id"),changes:await read<OrderChange>('pos_order_changes',"payload->>'at',order_id,revision"),collections:await read<CollectionEntry>('pos_collections',"payload->>'at',operation_id,method"),shifts:await read<POSShift>('pos_shifts',"payload->>'openedAt',id")}};
}
async function context(tx:QueryDatabase,org:string){return {pointsOfSale:(await tx.query<PointOfSale>('SELECT id,name,source,kitchen_id AS "kitchenId",active,revision FROM points_of_sale WHERE organization_id=$1',[org])).rows,kitchens:(await tx.query<Kitchen>('SELECT id,name,active,location_id AS "locationId" FROM kitchens WHERE organization_id=$1',[org])).rows,locations:(await tx.query<Location>('SELECT id,active FROM locations WHERE organization_id=$1',[org])).rows};}
export async function postPOSOrder(db:Database,access:Access,input:unknown):Promise<CommandResult>{
 assertInventoryWrite(access);const parsed=posOrderCommandSchema.safeParse(input);
 if(!parsed.success)throw new BusinessError('INVALID_POS_ORDER',parsed.error.issues.map(i=>i.message).join(' · '),400);
 const c=parsed.data,org=c.organizationId,hash=digest(c);
 if(org!==access.organizationId||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','الجلسة لا تسمح بهذا الطلب.',403);
 try{return await db.transaction(async tx=>{
  await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);await assertGeneration(tx,org,c.generation);
  const receipt=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[org,c.operationId])).rows[0];
  if(receipt){if(receipt.payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','معرّف العملية مستخدم لبيانات مختلفة.');return receipt.result;}
  const timestamp=new Date(),now=timestamp.toISOString(),date=egyptDate(timestamp);
  const finish=async(amount?:string)=>{const result:CommandResult={operationId:c.operationId,outcome:'accepted',...(amount===undefined?{}:{amount})};await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,c.operationId,hash,JSON.stringify(result)]);await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[org,access.userId,c.operationId,c.type]);return result;};
  if(c.type==='table.save'){
   assertInventoryManager(access);const ctx=await context(tx,org),pos=ctx.pointsOfSale.find(p=>p.id===c.record.posId&&p.active),kitchen=ctx.kitchens.find(k=>k.id===pos?.kitchenId&&k.active);
   if(!pos||!qibliTablesAllowed(kitchen))throw new BusinessError('TABLES_QIBLI_ONLY','إدارة الطاولات لقبلي فقط.');
   const old=(await tx.query<{revision:number;pos_id:string}>('SELECT revision,pos_id FROM pos_dining_tables WHERE organization_id=$1 AND id=$2',[org,c.record.id])).rows[0];
   if((old?.revision??0)!==c.expectedRevision)throw new BusinessError('REVISION_CONFLICT','تغير تعريف الطاولة. حدّث البيانات.');
   if(old&&old.pos_id!==c.record.posId)throw new BusinessError('IMMUTABLE_POS','الطاولة مرتبطة بنقطة البيع الأصلية.');
   if(!c.record.active&&(await tx.query("SELECT 1 FROM pos_orders WHERE organization_id=$1 AND table_id=$2 AND state='open'",[org,c.record.id])).rows.length)throw new BusinessError('TABLE_OCCUPIED','حصّل الطلب أو انقله قبل تعطيل الطاولة.');
   await tx.query('INSERT INTO pos_dining_tables VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(organization_id,id) DO UPDATE SET name=$4,seats=$5,active=$6,revision=$7',[org,c.record.id,c.record.posId,c.record.name,c.record.seats,c.record.active,c.expectedRevision+1]);return finish();
  }
  if(c.type==='shift.open'){
   if(c.expectedRevision!==0)throw new BusinessError('REVISION_CONFLICT','بيانات الوردية غير صالحة.');
   const ctx=await context(tx,org);if(!ctx.pointsOfSale.some(p=>p.id===c.posId&&p.active))throw new BusinessError('INVALID_POS','نقطة البيع غير نشطة.');
   const shift:POSShift={id:c.operationId,posId:c.posId,cashier:access.userId,openedAt:now,openingCash:c.openingCash};
   await tx.query('INSERT INTO pos_shifts(organization_id,id,pos_id,cashier,payload) VALUES($1,$2,$3,$4,$5)',[org,shift.id,c.posId,access.userId,JSON.stringify(shift)]);return finish();
  }
  if(c.type==='shift.close'){
   const shift=(await tx.query<{payload:POSShift}>('SELECT payload FROM pos_shifts WHERE organization_id=$1 AND id=$2 FOR UPDATE',[org,c.shiftId])).rows[0]?.payload;
   if(!shift||shift.closedAt)throw new BusinessError('SHIFT_CLOSED','الوردية غير متاحة أو أغلقت بالفعل.');
   if(shift.cashier!==access.userId)assertInventoryManager(access);
   const rows=(await tx.query<{amount:string;kind:string}>("SELECT amount::text,kind FROM pos_collections WHERE organization_id=$1 AND shift_id=$2 AND method='cash'",[org,shift.id])).rows;
   const expected=rows.reduce((v,r)=>v.add(decimal(r.amount).mul(r.kind==='refund'?-1:1)),decimal(shift.openingCash)).toFixed(2);
   const closed:POSShift={...shift,closedAt:now,countedCash:c.countedCash,expectedCash:expected,difference:decimal(c.countedCash).sub(expected).toFixed(2),note:c.note};
   await tx.query('UPDATE pos_shifts SET closed_at=$3,payload=$4 WHERE organization_id=$1 AND id=$2',[org,shift.id,now,JSON.stringify(closed)]);return finish(expected);
  }
  let original:POSOrder|undefined=(await tx.query<{payload:POSOrder}>('SELECT payload FROM pos_orders WHERE organization_id=$1 AND id=$2 FOR UPDATE',[org,c.draft.id])).rows[0]?.payload;
  let adopting=false;
  if(!original&&c.type==='order.amend'){
   const prior=(await tx.query<{result:import('@saas/contracts').ImportedSales}>('SELECT result FROM sales_imports WHERE organization_id=$1 AND operation_id=$2',[org,c.draft.id])).rows[0]?.result;
   if(prior){
    if((await tx.query('SELECT 1 FROM finance_entries f JOIN sales_details d ON d.organization_id=f.organization_id AND d.line_id=f.sale_line_id WHERE d.organization_id=$1 AND d.import_id=$2',[org,c.draft.id])).rows.length)throw new BusinessError('LEGACY_CORRECTION','لهذه الفاتورة مرتجع سابق في السجل المالي؛ راجعه قبل تعديلها.');
    original=legacyPOSOrder(prior);adopting=!!original;
   }
  }
  if((original?.revision??0)!==c.expectedRevision)throw new BusinessError('REVISION_CONFLICT','الطلب تغير على جهاز آخر. حدّث وافتح أحدث طلب.');
  if(c.type==='order.amend'&&original?.state!=='paid'||c.type!=='order.amend'&&original?.state==='paid')throw new BusinessError('ORDER_PAID','استخدم تعديل الفاتورة المدفوعة مع سبب وفرق التحصيل.');
  if(c.type==='order.pay'&&!c.draft.lines.length)throw new BusinessError('EMPTY_ORDER','أضف صنفاً قبل الدفع.');
  if(original&&original.draft.posId!==c.draft.posId)throw new BusinessError('IMMUTABLE_POS','الطلب يحتفظ بنقطة البيع الأصلية.');
  const ctx=await context(tx,org),route=validateOrderContext(ctx,c.draft);
  if(original&&(original.locationId!==route.location.id||original.kitchenId!==route.kitchen.id))throw new BusinessError('ROUTING_CHANGED','تغير مطبخ نقطة البيع. راجع الطلب الأصلي قبل المتابعة.');
  if(c.draft.tableId){
   const preserveHistoricalTable=c.type==='order.amend'&&original?.draft.tableId===c.draft.tableId;
   if(!(await tx.query('SELECT 1 FROM pos_dining_tables WHERE organization_id=$1 AND id=$2 AND pos_id=$3 AND (active OR $4)',[org,c.draft.tableId,c.draft.posId,preserveHistoricalTable])).rows.length)throw new BusinessError('INVALID_TABLE','اختر طاولة نشطة لنقطة البيع.');
   if(c.type!=='order.amend'&&(await tx.query("SELECT 1 FROM pos_orders WHERE organization_id=$1 AND table_id=$2 AND state='open' AND id<>$3",[org,c.draft.tableId,c.draft.id])).rows.length)throw new BusinessError('TABLE_OCCUPIED','الطاولة مشغولة بطلب آخر.');
  }
  // Resolve trusted prices and recipes on the server. Unchanged paid lines retain their historical price.
  const menus=(await tx.query<{payload:MenuItem;revision:number}>('SELECT payload,revision FROM menu_items WHERE organization_id=$1',[org])).rows;
  const versions=await recipeSnapshot(tx,org);
  const lines=c.draft.lines.map(line=>{
   const prior=original?.draft.lines.find(l=>l.menuItemId===line.menuItemId),stored=menus.find(m=>m.payload.id===line.menuItemId),menu=stored&&{...stored.payload,revision:stored.revision};
   if(original?.state==='paid'&&prior){if(!decimal(line.unitPrice).eq(prior.unitPrice))throw new BusinessError('PRICE_CHANGED','احتفظ بسعر الصنف الأصلي.');return {...prior,quantity:line.quantity,note:line.note};}
   if(!menu||menu.source!==route.pos.source||!menu.kitchenIds?.includes(route.kitchen.id)||!menu.active||menu.sellingPrice===undefined)throw new BusinessError('INVALID_MENU','أحد الأصناف غير متاح لهذا المطبخ.');
   if(!decimal(line.unitPrice).eq(menu.sellingPrice)||line.mappingRevision!==menu.revision||line.versionId!==menu.versionId||!decimal(line.outputPerSale).eq(menu.outputPerSale))throw new BusinessError('PRICE_CHANGED','تغير سعر الصنف أو وصفته. حدّث الأصناف وأعد فتح الطلب.');
   const clean={...line,menuName:menu.name,menuCode:menu.code};validateSale({...versions,menuItems:[menu]},route.pos.source,{...clean,lineKey:clean.lineId,transactionId:posSaleReference(c.draft.id),businessDate:date,netAmount:posLineAmount(clean.unitPrice,clean.quantity)},true,route.kitchen.id);return clean;
  });
  const draft=orderDraftSchema.parse({...c.draft,lines}),total=orderTotal(draft);
  if(decimal(total).gt('999999999.99'))throw new BusinessError('TOTAL_TOO_LARGE','إجمالي الطلب يتجاوز الحد.');
  const paid=c.type!=='order.save',difference=decimal(total).sub(original?.state==='paid'?original.total:'0').toFixed(2);
  let shift:POSShift|undefined,cash={cashChange:'0.00',cashReceived:'0.00'};
  if(paid){
   await assertInventoryDateOpen(tx,org,route.location.id,date);
   cash=settleOrderDifference(difference,c.payments,c.type==='order.amend'?c.refunds:[],c.cashReceived);
   shift=(await tx.query<{payload:POSShift}>('SELECT payload FROM pos_shifts WHERE organization_id=$1 AND pos_id=$2 AND cashier=$3 AND closed_at IS NULL FOR UPDATE',[org,draft.posId,access.userId])).rows[0]?.payload;
   if(!shift)throw new BusinessError('SHIFT_REQUIRED','افتح وردية قبل التحصيل أو تعديل الفاتورة.');
  }
  const stock=paid?await adjustOrderStock(tx,org,route.location.id,c.operationId,draft,original?.stock??[],versions,date,original?.reference??posSaleReference(draft.id)):[];
  const order:POSOrder={draft,revision:c.expectedRevision+1,reference:original?.reference??posSaleReference(draft.id),state:paid?'paid':'open',locationId:route.location.id,kitchenId:route.kitchen.id,businessDate:c.type==='order.pay'?date:original?.businessDate??date,cashier:c.type==='order.pay'?access.userId:original?.cashier??access.userId,createdAt:original?.createdAt??now,updatedAt:now,...(paid?{paidAt:original?.paidAt??now}:{}),total,stock};
  await tx.query('INSERT INTO pos_orders VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(organization_id,id) DO UPDATE SET table_id=$4,state=$5,revision=$6,payload=$7',[org,draft.id,draft.posId,draft.tableId??null,order.state,order.revision,JSON.stringify(order)]);
  const change:OrderChange={operationId:c.operationId,orderId:draft.id,revision:order.revision,actor:access.userId,at:now,reason:c.type==='order.amend'?c.reason:c.type==='order.pay'?'تحصيل الفاتورة':'حفظ الطلب',before:original??null,after:order};
  await tx.query('INSERT INTO pos_order_changes VALUES($1,$2,$3,$4,$5)',[org,c.operationId,draft.id,order.revision,JSON.stringify(change)]);
  if(c.type==='order.amend')await tx.query("SELECT set_config('fodo.pos_amendment',$1,true)",[c.operationId]);
  if(paid)await projectPOSOrder(tx,org,order,route.pos,route.kitchen,c.generation,adopting);
  if(adopting&&original){
   const legacyShift:POSShift={id:original.draft.id,posId:draft.posId,cashier:original.cashier,openedAt:original.paidAt!,openingCash:'0',closedAt:original.paidAt!,expectedCash:original.total,countedCash:original.total,difference:'0',note:'فاتورة نقدية سابقة'};
   await tx.query('INSERT INTO pos_shifts VALUES($1,$2,$3,$4,$5,$6)',[org,legacyShift.id,draft.posId,legacyShift.cashier,legacyShift.closedAt,JSON.stringify(legacyShift)]);
   if(decimal(original.total).gt(0)){
    const row:CollectionEntry={operationId:original.draft.id,orderId:draft.id,shiftId:legacyShift.id,posId:draft.posId,actor:original.cashier,at:original.paidAt!,businessDate:original.businessDate,method:'cash',amount:decimal(original.total).toFixed(2),kind:'collection',service:original.draft.service,cashReceived:decimal(original.total).toFixed(2),cashChange:'0.00'};
    await tx.query('INSERT INTO pos_collections VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[org,row.operationId,row.method,row.kind,draft.id,row.shiftId,row.amount,JSON.stringify(row)]);
   }
  }
  if(paid&&shift){
   const refunds=c.type==='order.amend'?c.refunds:[],rows=c.payments.length?c.payments:refunds;
   for(const payment of rows){const row:CollectionEntry={operationId:c.operationId,orderId:draft.id,shiftId:shift.id,posId:draft.posId,actor:access.userId,at:now,businessDate:date,method:payment.method,amount:payment.amount,kind:c.payments.length?'collection':'refund',service:draft.service,tableId:draft.tableId,cashReceived:payment.method==='cash'?cash.cashReceived:'0.00',cashChange:payment.method==='cash'?cash.cashChange:'0.00'};await tx.query('INSERT INTO pos_collections VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[org,c.operationId,row.method,row.kind,draft.id,shift.id,row.amount,JSON.stringify(row)]);}
  }
  return finish(paid?difference:undefined);
 });}catch(error){if((error as {code?:string}).code==='23505')throw new BusinessError('POS_CONFLICT','الطاولة مشغولة أو الاسم مستخدم أو توجد وردية مفتوحة. حدّث البيانات.');throw error;}
}
async function adjustOrderStock(tx:QueryDatabase,org:string,locationId:string,operationId:string,draft:OrderDraft,previous:OrderStock[],versions:Awaited<ReturnType<typeof recipeSnapshot>>,date:string,reference:string){
 const requirements=salesStockRequirements(versions,draft.lines.map(l=>({...l,transactionId:reference,lineKey:l.lineId,businessDate:date,netAmount:posLineAmount(l.unitPrice,l.quantity)})));
 const required=new Map(requirements.map(r=>[r.itemId,r.quantity]));const ids=new Set([...required.keys(),...previous.map(r=>r.itemId)]),stock:OrderStock[]=[];
 // Metadata-only changes never turn an old stock shortage into a second issue.
 for(const itemId of ids){
  const old=previous.find(r=>r.itemId===itemId)??{itemId,required:'0',deducted:'0',amount:'0'},target=required.get(itemId)??'0',delta=decimal(target).sub(old.required);
  let deducted=decimal(old.deducted),amount=decimal(old.amount);
  if(!delta.isZero()){
   await assertInventoryDateOpen(tx,org,locationId,date);
   const before=await reconcileStock(tx,org);if(before.some(b=>b.locationId===locationId&&b.itemId===itemId&&!b.matches))throw new BusinessError('RECONCILIATION_MISMATCH','رصيد المخزون لا يطابق الحركات.');
   const movementId=randomUUID();
   if(delta.gt(0)){
    const balance=(await tx.query<{quantity:string}>('SELECT quantity::text FROM stock_balances WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 FOR UPDATE',[org,locationId,itemId])).rows[0];
    const available=decimal(balance?.quantity??'0');const quantity=(available.gt(0)?(delta.lt(available)?delta:available):decimal('0')).toFixed(6);
    if(decimal(quantity).gt(0)){
     const plan=await planIssue(tx,org,locationId,itemId,quantity);await applyIssue(tx,org,locationId,itemId,movementId,quantity,plan);
     await tx.query('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[org,movementId,locationId,itemId,decimal(quantity).neg().toFixed(6),decimal(plan.amount).neg().toFixed(12),'sales.issue',reference+' / '+operationId,date]);
     deducted=deducted.add(quantity);amount=amount.add(plan.amount);
    }
   }else{
    // Consume the unfulfilled part first: a shortage was never deducted and cannot be returned.
    const remaining=deducted.sub(target),quantity=remaining.gt(0)?remaining:decimal('0');
    if(quantity.gt(0)){
     const value=quantity.eq(deducted)?amount:amount.mul(quantity).div(deducted).toDecimalPlaces(12);
     await addIncomingStock(tx,{organizationId:org,operationId:movementId,locationId,itemId,quantity:quantity.toFixed(6),unitCost:value.div(quantity).toFixed(12),amount:value.toFixed(12),type:'sales.return',reason:reference+' / '+operationId,businessDate:date});deducted=deducted.sub(quantity);amount=amount.sub(value);
    }
   }
   const after=await reconcileStock(tx,org);if(after.some(b=>b.locationId===locationId&&b.itemId===itemId&&!b.matches))throw new BusinessError('RECONCILIATION_MISMATCH','فشلت مطابقة فرق مخزون الفاتورة.');
  }
  stock.push({itemId,required:decimal(target).toFixed(6),deducted:deducted.toFixed(6),amount:amount.toFixed(12)});
 }
 return stock;
}
