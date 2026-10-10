import { z } from 'zod';
export const quantitySchema = z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/, 'أدخل كمية موجبة حتى ٦ منازل عشرية').refine(v => Number(v) > 0, 'الكمية يجب أن تكون أكبر من صفر');
export const commandSchema = z.object({
  operationId: z.uuid(), organizationId: z.enum(['grills','bistro']), locationId: z.string().min(1).max(80),
  type: z.enum(['receipt.post','waste.post']), itemId: z.string().min(1).max(80), quantity: quantitySchema,
  unitCost: z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/).optional(),
  reason: z.string().trim().min(2).max(200), businessDate: z.iso.date(), capturedAt: z.iso.datetime(), schemaVersion:z.literal(1),
  supplierId:z.string().min(1).max(80).optional(),purchaseUnitId:z.uuid().optional(),enteredQuantity:quantitySchema.optional()
}).superRefine((v,ctx)=>{
  if(v.type === 'receipt.post' && !v.unitCost) ctx.addIssue({code:'custom',message:'تكلفة الوحدة مطلوبة',path:['unitCost']});
  if(!!v.purchaseUnitId!==!!v.enteredQuantity || (v.type==='waste.post'&&(v.purchaseUnitId||v.supplierId)))ctx.addIssue({code:'custom',message:'بيانات وحدة الشراء أو المورد غير صالحة'});
});
export type Command = z.infer<typeof commandSchema>;
export type DemoProfile = 'grills' | 'bistro';
export type Access = { organizationId: DemoProfile; userId: string; deviceId: string; expiresAt: string };
export type PurchaseUnit={id:string;name:string;factor:string};
export type Unit={id:string;name:string;revision:number};
export type Supplier={id:string;name:string;phone:string;email:string;address:string;active:boolean;revision:number};
export type Item = { id: string; name: string; sku: string; category: string; unit: string; minimum: string;unitId?:string;purchaseUnits?:PurchaseUnit[];active?:boolean;revision?:number };
export type Location = {id:string;name:string;kind:string;active?:boolean;revision?:number};
export type Balance = {locationId:string;itemId:string;quantity:string;value:string;average:string|null};
export type Layer = {id:string;locationId:string;itemId:string;remaining:string;unitCost:string;sequence:number};
export type Entry = {operationId:string;locationId:string;itemId:string;quantity:string;amount:string;type:string;reason:string;businessDate:string;postedAt:string;supplierId?:string|null;purchaseUnitId?:string|null;enteredQuantity?:string|null};
export type Snapshot = {organizationId:DemoProfile;organizationName:string;access:Access;locations:Location[];items:Item[];balances:Balance[];layers:Layer[];entries:Entry[];acceptedOperationIds:string[];fetchedAt:string;currency:'EGP';units?:Unit[];suppliers?:Supplier[];openings?:PostedOpening[]};
export type CommandResult = {operationId:string;outcome:'accepted'|'needs_review';code?:string;message?:string;amount?:string};
export class BusinessError extends Error { constructor(public code:string, message:string,public status=409){super(message);} }
export const messages: Record<string,string> = {INSUFFICIENT_STOCK:'الرصيد المتاح لا يكفي. راجع العملية قبل إعادة إرسالها.',FORBIDDEN:'ليس لديك صلاحية لهذه المؤسسة أو الموقع.',PAYLOAD_CONFLICT:'معرّف العملية مستخدم لبيانات مختلفة.',INVALID_COMMAND:'تحقق من بيانات العملية.',AUTH_REQUIRED:'انتهت الجلسة. اتصل بالإنترنت وسجل الدخول مرة أخرى.'};

const recordId=z.string().min(1).max(80);
const recordName=z.string().trim().min(2).max(100);
const nonNegative=z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/);
const purchaseUnitsSchema=z.array(z.object({id:z.uuid(),name:recordName,factor:quantitySchema})).max(20).refine(rows=>new Set(rows.map(r=>r.id)).size===rows.length&&new Set(rows.map(r=>r.name.toLocaleLowerCase())).size===rows.length,'وحدات الشراء يجب أن تكون مختلفة');
const setupEnvelope={operationId:z.uuid(),organizationId:z.enum(['grills','bistro']),expectedRevision:z.number().int().min(0),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1)};
export const setupCommandSchema=z.discriminatedUnion('type',[
  z.object({...setupEnvelope,type:z.literal('unit.save'),record:z.object({id:recordId,name:recordName})}),
  z.object({...setupEnvelope,type:z.literal('supplier.save'),record:z.object({id:recordId,name:recordName,phone:z.string().trim().max(40),email:z.union([z.literal(''),z.email()]),address:z.string().trim().max(300),active:z.boolean()})}),
  z.object({...setupEnvelope,type:z.literal('location.save'),record:z.object({id:recordId,name:recordName,kind:z.enum(['مطعم','مخزن','مطبخ تحضير','تخزين وتحضير']),active:z.boolean()})}),
  z.object({...setupEnvelope,type:z.literal('item.save'),record:z.object({id:recordId,name:recordName,sku:z.string().trim().min(1).max(60).transform(v=>v.toUpperCase()),category:recordName,unitId:recordId,minimum:nonNegative,purchaseUnits:purchaseUnitsSchema,active:z.boolean()})})
]);
export type SetupCommand=z.infer<typeof setupCommandSchema>;

export const openingSchema=z.object({
 operationId:z.uuid(),organizationId:z.enum(['grills','bistro']),locationId:recordId,type:z.literal('opening.post'),
 businessDate:z.iso.date(),reason:z.string().trim().min(2).max(200),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1),currency:z.literal('EGP'),
 lines:z.array(z.object({lineId:z.uuid(),itemId:recordId,unitId:recordId,quantity:quantitySchema,unitCost:nonNegative})).min(1).max(200),
 source:z.object({fileName:z.string().max(200),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).optional()
}).superRefine((doc,ctx)=>{
 if(new Set(doc.lines.map(l=>l.itemId)).size!==doc.lines.length||new Set([doc.operationId,...doc.lines.map(l=>l.lineId)]).size!==doc.lines.length+1)ctx.addIssue({code:'custom',message:'المادة ومعرّفات السطور يجب ألا تتكرر'});
});
export type OpeningDocument=z.infer<typeof openingSchema>;
export type PostedOpening={document:OpeningDocument;amount:string;postedAt:string};
