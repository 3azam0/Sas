import {BusinessError,salesImportSchema,posCartSchema,type Snapshot,type POSCart,type SalesImportDocument} from '@saas/contracts';
import {decimal} from './index';
import {egyptDate} from './reporting';
import {resolveSalesRouting,validateSale} from './sales';
export const posSaleReference=(id:string)=>'FD-'+id.toUpperCase();
export const posLineAmount=(price:string,quantity:string)=>decimal(price).mul(quantity).toDecimalPlaces(2,4).toFixed(2);
export const posTotal=(lines:{unitPrice:string;quantity:string}[])=>lines.reduce((sum,l)=>sum.add(posLineAmount(l.unitPrice,l.quantity)),decimal('0')).toFixed(2);
export function posCash(total:string,received:string){const change=decimal(received).sub(total);if(change.lt(0))throw new BusinessError('CASH_SHORT','المبلغ المستلم أقل من الإجمالي.');return {total:decimal(total).toFixed(2),received:decimal(received).toFixed(2),change:change.toFixed(2)};}
export function validateCheckout(snapshot:Pick<Snapshot,'menuItems'>,doc:SalesImportDocument){
 const checkout=doc.checkout;if(!checkout){if(doc.lines.some(l=>/^FD-[A-F0-9-]{36}$/i.test(l.transactionId)))throw new BusinessError('NATIVE_SALE_IMPORT','هذا معرّف بيع FooDo؛ راجع الإيصال الأصلي بدلاً من استيراده مرة ثانية.');return;}
 if(!doc.posId||doc.file||doc.lines.some(l=>l.transactionId!==posSaleReference(doc.operationId)||l.businessDate!==doc.lines[0].businessDate))throw new BusinessError('INVALID_CHECKOUT','معرّف إيصال نقطة البيع أو تاريخه غير صالح.');
 for(const line of doc.lines){const meta=checkout.lines.find(l=>l.lineId===line.lineId),menu=snapshot.menuItems?.find(m=>m.id===line.menuItemId);if(!meta||menu?.sellingPrice===undefined||!decimal(meta.unitPrice).eq(menu.sellingPrice))throw new BusinessError('PRICE_CHANGED','سعر بيع الصنف تغير أو لم يحدد. راجع البيع والأسعار قبل المتابعة.');if(!decimal(line.netAmount).eq(posLineAmount(meta.unitPrice,line.quantity)))throw new BusinessError('INVALID_CHECKOUT','قيمة سطر البيع لا تطابق الكمية وسعر الوحدة.');}
 const total=doc.lines.reduce((sum,l)=>sum.add(l.netAmount),decimal('0'));if(total.gt('999999999.99'))throw new BusinessError('TOTAL_TOO_LARGE','إجمالي الإيصال يتجاوز الحد.');posCash(total.toFixed(2),checkout.cashReceived);
}
export function checkoutCart(snapshot:Snapshot,input:POSCart,cashReceived:string,capturedAt=new Date().toISOString()):SalesImportDocument{
 const cart=posCartSchema.parse(input);if(snapshot.organizationId!==cart.organizationId||snapshot.generation!==cart.generation)throw new BusinessError('STALE_CART','السلة تخص مؤسسة أو نسخة بيانات أخرى.');if(!snapshot.capabilities?.counterPOS)throw new BusinessError('POS_BACKEND_REQUIRED','يلزم تحديث خدمة نقطة البيع قبل إتمام البيع.');
 const ref=posSaleReference(cart.id),date=egyptDate(),doc=salesImportSchema.parse({operationId:cart.id,generation:cart.generation,organizationId:cart.organizationId,type:'sales.import',source:cart.source,locationId:cart.locationId,posId:cart.posId,posRevision:cart.posRevision,kitchenId:cart.kitchenId,currency:'EGP',reference:ref,completedSalesOnly:true,capturedAt,schemaVersion:1,checkout:{channel:'foodo',service:cart.service,cashReceived,note:cart.note,lines:cart.lines.map(l=>({lineId:l.lineId,unitPrice:l.unitPrice,note:l.note}))},lines:cart.lines.map(l=>({...l,transactionId:ref,lineKey:l.lineId,businessDate:date,netAmount:posLineAmount(l.unitPrice,l.quantity)}))});
 resolveSalesRouting(snapshot,doc);for(const line of doc.lines)validateSale(snapshot,doc.source,line,true,doc.kitchenId);validateCheckout(snapshot,doc);return doc;
}
export function createPOSCart(snapshot:Snapshot,posId:string):POSCart{
 const pos=snapshot.pointsOfSale?.find(p=>p.id===posId&&p.active),kitchen=snapshot.kitchens?.find(k=>k.id===pos?.kitchenId&&k.active&&k.locationId);if(!pos||!kitchen?.locationId)throw new BusinessError('INVALID_POS','اختر نقطة بيع ومطبخاً نشطين.');const now=new Date().toISOString();return {id:crypto.randomUUID(),organizationId:snapshot.organizationId,generation:snapshot.generation,revision:0,sourceDeviceId:snapshot.access.deviceId,posId:pos.id,posRevision:pos.revision,kitchenId:kitchen.id,locationId:kitchen.locationId,source:pos.source,state:'current',service:'counter',label:'',note:'',createdAt:now,updatedAt:now,lines:[]};
}
export function refreshPOSCart(snapshot:Snapshot,cart:POSCart):POSCart{
 const pos=snapshot.pointsOfSale?.find(p=>p.id===cart.posId);if(!pos||pos.kitchenId!==cart.kitchenId||!snapshot.kitchens?.some(k=>k.id===cart.kitchenId&&k.locationId===cart.locationId))throw new BusinessError('POS_CHANGED','تغير مطبخ نقطة البيع؛ راجع السلة.');
 return {...cart,posRevision:pos.revision,lines:cart.lines.map(l=>{const menu=snapshot.menuItems?.find(m=>m.id===l.menuItemId&&m.active&&m.source===cart.source&&m.kitchenIds?.includes(cart.kitchenId));if(!menu||menu.sellingPrice===undefined)throw new BusinessError('INVALID_MENU','أحد الأصناف غير متاح أو بلا سعر.');return {...l,menuCode:menu.code,menuName:menu.name,mappingRevision:menu.revision,versionId:menu.versionId,outputPerSale:menu.outputPerSale,unitPrice:menu.sellingPrice};})};
}
