import {BusinessError,type Snapshot,type OrderDraft,type OrderPayment,type POSOrdersSnapshot,type ImportedSales,type POSOrder} from '@saas/contracts';
import {decimal} from './index';
import {posTotal} from './pos';
export const orderTotal=(draft:OrderDraft)=>decimal(posTotal(draft.lines)).add(draft.service==='delivery'?(draft.deliveryFee||'0'):'0').toFixed(2);
export function legacyPOSOrder(sale:ImportedSales):POSOrder|undefined{
 const d=sale.document;if(!d.checkout||!d.posId||!d.kitchenId||sale.posOrderId)return;
 const ids=new Set([...(sale.stockDeductions??[]).map(s=>s.itemId),...(sale.stockShortages??[]).map(s=>s.itemId)]);
 return {draft:{id:d.operationId,posId:d.posId,service:d.checkout.service,customer:{name:'',phone:'',address:''},deliveryFee:'0',note:d.checkout.note,lines:d.lines.map(l=>({...l,unitPrice:d.checkout!.lines.find(m=>m.lineId===l.lineId)!.unitPrice,note:d.checkout!.lines.find(m=>m.lineId===l.lineId)!.note}))},revision:0,reference:d.reference,state:'paid',locationId:d.locationId,kitchenId:d.kitchenId,businessDate:d.lines[0].businessDate,cashier:'سجل سابق',createdAt:d.capturedAt,updatedAt:d.capturedAt,paidAt:d.capturedAt,total:sale.netAmount,stock:[...ids].map(itemId=>{const actual=(sale.stockDeductions??[]).filter(s=>s.itemId===itemId),short=(sale.stockShortages??[]).filter(s=>s.itemId===itemId);return {itemId,deducted:actual.reduce((v,s)=>v.add(s.quantity),decimal('0')).toFixed(6),required:actual.reduce((v,s)=>v.add(s.quantity),decimal('0')).add(short.reduce((v,s)=>v.add(s.shortageQuantity),decimal('0'))).toFixed(6),amount:actual.reduce((v,s)=>v.add(s.amount),decimal('0')).toFixed(12)};})};
}
export function qibliTablesAllowed(kitchen?:{name:string}){
 const name=kitchen?.name.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'')??'';
 return /(?:^|[^\p{L}\p{N}])(?:ال)?قبلي(?:$|[^\p{L}\p{N}])/u.test(name);
}
export function validateOrderContext(snapshot:Pick<Snapshot,'pointsOfSale'|'kitchens'|'locations'>,draft:OrderDraft){
 const pos=snapshot.pointsOfSale?.find(p=>p.id===draft.posId&&p.active),kitchen=snapshot.kitchens?.find(k=>k.id===pos?.kitchenId&&k.active),location=snapshot.locations.find(l=>l.id===kitchen?.locationId&&l.active!==false);
 if(!pos||!kitchen||!location)throw new BusinessError('INVALID_POS','نقطة البيع أو المطبخ غير متاح.');
 if(draft.service==='table'&&!qibliTablesAllowed(kitchen))throw new BusinessError('TABLES_QIBLI_ONLY','الطاولات متاحة لقبلي فقط.');
 return {pos,kitchen,location};
}
export function settleOrderDifference(difference:string,payments:OrderPayment[],refunds:OrderPayment[],received:string){
 const delta=decimal(difference),sum=(rows:OrderPayment[])=>rows.reduce((v,p)=>v.add(p.amount),decimal('0'));
 for(const rows of [payments,refunds])if(new Set(rows.map(p=>p.method)).size!==rows.length||rows.some(p=>decimal(p.amount).lte(0)))throw new BusinessError('INVALID_PAYMENT','اختر كل طريقة مرة واحدة بمبلغ موجب.');
 if(delta.gte(0)?(!sum(payments).eq(delta)||refunds.length>0):(!sum(refunds).eq(delta.neg())||payments.length>0))throw new BusinessError('PAYMENT_MISMATCH','تقسيم التحصيل أو الرد يجب أن يساوي فرق الفاتورة.');
 const cash=payments.find(p=>p.method==='cash')?.amount??'0';
 if(decimal(received).lt(cash)||decimal(cash).isZero()&&!decimal(received).isZero())throw new BusinessError('CASH_SHORT','راجع النقدي المستلم.');
 return {cashChange:decimal(received).sub(cash).toFixed(2),cashReceived:decimal(received).toFixed(2)};
}
export function posCollectionReport(data:POSOrdersSnapshot,filters:{from?:string;to?:string;posId?:string;cashier?:string;service?:string;tableId?:string;method?:string}={}){
 const matches=(r:{businessDate:string;posId:string;actor:string;service:string;tableId?:string;method:string})=>(!filters.from||r.businessDate>=filters.from)&&(!filters.to||r.businessDate<=filters.to)&&(!filters.posId||r.posId===filters.posId)&&(!filters.cashier||r.actor===filters.cashier)&&(!filters.service||r.service===filters.service)&&(!filters.tableId||r.tableId===filters.tableId)&&(!filters.method||r.method===filters.method);
 const rows=data.collections.filter(matches),amount=(kind:string)=>rows.filter(r=>r.kind===kind).reduce((v,r)=>v.add(r.amount),decimal('0')).toFixed(2);
 return {rows,collected:amount('collection'),refunded:amount('refund'),net:decimal(amount('collection')).sub(amount('refund')).toFixed(2),byMethod:['cash','instapay','visa'].map(method=>({method,total:rows.filter(r=>r.method===method).reduce((v,r)=>v.add(decimal(r.amount).mul(r.kind==='refund'?-1:1)),decimal('0')).toFixed(2)})),openOrders:data.orders.filter(o=>o.state==='open'&&(!filters.posId||o.draft.posId===filters.posId))};
}
