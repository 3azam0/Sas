import {z} from 'zod';
import {posCartLineSchema as sharedLineSchema,cashAmountSchema as sharedCashSchema} from './index';
// Delay resolving shared contracts until index.ts has finished initializing.
const posCartLineSchema=z.lazy(()=>sharedLineSchema),cashAmountSchema=z.lazy(()=>sharedCashSchema);
const deliveryFeeSchema=z.preprocess(value=>value===''||value===undefined?'0':value,cashAmountSchema);
export const orderServiceSchema=z.enum(['table','delivery','takeaway','counter']);
export const paymentMethodSchema=z.enum(['cash','instapay','visa']);
export const orderPaymentSchema=z.object({method:paymentMethodSchema,amount:cashAmountSchema});
export type OrderPayment=z.infer<typeof orderPaymentSchema>;
export const orderDraftSchema=z.object({id:z.uuid(),posId:z.string().min(1).max(80),service:orderServiceSchema,tableId:z.uuid().optional(),customer:z.object({name:z.string().trim().max(100),phone:z.string().trim().max(40),address:z.string().trim().max(400)}),deliveryFee:deliveryFeeSchema,note:z.string().trim().max(200),lines:z.array(posCartLineSchema).max(200)}).superRefine((d,c)=>{if(new Set(d.lines.map(l=>l.lineId)).size!==d.lines.length||new Set(d.lines.map(l=>l.menuItemId)).size!==d.lines.length)c.addIssue({code:'custom',message:'اجمع كميات الصنف في سطر واحد'});if(d.service==='table'&&!d.tableId)c.addIssue({code:'custom',message:'اختر الطاولة'});if(d.service!=='table'&&d.tableId)c.addIssue({code:'custom',message:'الطاولة للطلبات الداخلية فقط'});if(d.service!=='delivery'&&Number(d.deliveryFee)!==0)c.addIssue({code:'custom',message:'رسوم التوصيل للدليفري فقط'});if(d.service==='delivery'&&(!d.customer.name||!d.customer.phone||!d.customer.address))c.addIssue({code:'custom',message:'اسم العميل والهاتف والعنوان مطلوبة للدليفري'});});
export type OrderDraft=z.infer<typeof orderDraftSchema>;
const envelope={operationId:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),generation:z.uuid(),expectedRevision:z.number().int().min(0)};
export const posOrderCommandSchema=z.discriminatedUnion('type',[
 z.object({...envelope,type:z.literal('table.save'),record:z.object({id:z.uuid(),posId:z.string().min(1).max(80),name:z.string().trim().min(1).max(60),seats:z.number().int().min(1).max(100),active:z.boolean()})}),
 z.object({...envelope,type:z.literal('order.save'),draft:orderDraftSchema}),
 z.object({...envelope,type:z.literal('order.pay'),draft:orderDraftSchema,payments:z.array(orderPaymentSchema).max(3),cashReceived:cashAmountSchema}),
 z.object({...envelope,type:z.literal('order.amend'),draft:orderDraftSchema,reason:z.string().trim().min(3).max(300),payments:z.array(orderPaymentSchema).max(3),cashReceived:cashAmountSchema,refunds:z.array(orderPaymentSchema).max(3)}),
 z.object({...envelope,type:z.literal('shift.open'),posId:z.string().min(1).max(80),openingCash:cashAmountSchema}),
 z.object({...envelope,type:z.literal('shift.close'),shiftId:z.uuid(),countedCash:cashAmountSchema,note:z.string().trim().max(300)})
]);
export type POSOrderCommand=z.infer<typeof posOrderCommandSchema>;
export type DiningTable={id:string;posId:string;name:string;seats:number;active:boolean;revision:number};
export type OrderStock={itemId:string;required:string;deducted:string;amount:string};
export type POSOrder={draft:OrderDraft;revision:number;reference:string;state:'open'|'paid';locationId:string;kitchenId:string;businessDate:string;cashier:string;createdAt:string;updatedAt:string;paidAt?:string;total:string;stock:OrderStock[]};
export type OrderChange={operationId:string;orderId:string;revision:number;actor:string;at:string;reason:string;before:POSOrder|null;after:POSOrder};
export type CollectionEntry={operationId:string;orderId:string;shiftId:string;posId:string;actor:string;at:string;businessDate:string;method:OrderPayment['method'];amount:string;kind:'collection'|'refund';service:OrderDraft['service'];tableId?:string;cashReceived:string;cashChange:string};
export type POSShift={id:string;posId:string;cashier:string;openedAt:string;openingCash:string;closedAt?:string;countedCash?:string;expectedCash?:string;difference?:string;note?:string};
export type POSOrdersSnapshot={tables:DiningTable[];orders:POSOrder[];changes:OrderChange[];collections:CollectionEntry[];shifts:POSShift[]};
