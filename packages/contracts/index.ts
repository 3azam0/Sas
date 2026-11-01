import { z } from 'zod';
export const quantitySchema = z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/, 'أدخل كمية موجبة حتى ٦ منازل عشرية').refine(v => Number(v) > 0, 'الكمية يجب أن تكون أكبر من صفر');
export const commandSchema = z.object({
  operationId: z.uuid(), organizationId: z.enum(['grills','bistro']), locationId: z.string().min(1).max(80),
  type: z.enum(['receipt.post','waste.post']), itemId: z.string().min(1).max(80), quantity: quantitySchema,
  unitCost: z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/).optional(),
  reason: z.string().trim().max(200).default(''), businessDate: z.iso.date(), capturedAt: z.iso.datetime(), schemaVersion:z.literal(1)
}).superRefine((v,ctx)=>{if(v.type==='waste.post'&&v.reason.length<2)ctx.addIssue({code:'custom',message:'سبب الهالك مطلوب',path:['reason']});if(v.type === 'receipt.post' && !v.unitCost) ctx.addIssue({code:'custom',message:'تكلفة الوحدة مطلوبة',path:['unitCost']});});
export type Command = z.infer<typeof commandSchema>;
export type DemoProfile = 'grills' | 'bistro';
export type Access = { organizationId: DemoProfile; userId: string; deviceId: string; expiresAt: string };
export type Item = { id: string; name: string; sku: string; category: string; unit: string; minimum: string; role?:string; meatKind?:import('./butchery').MeatKind|null };
export type Location = {id:string;name:string;kind:string};
export type Balance = {revision?:string;locationId:string;itemId:string;quantity:string;value:string;average:string|null};
export type Layer = {id:string;locationId:string;itemId:string;remaining:string;unitCost:string;sequence:number;remainingValue?:string};
export type Entry = {operationId:string;reference?:string;locationId:string;itemId:string;quantity:string;amount:string;type:string;reason:string;businessDate:string;postedAt:string};
export type Snapshot = {organizationId:DemoProfile;organizationName:string;access:Access;locations:Location[];items:Item[];balances:Balance[];layers:Layer[];entries:Entry[];acceptedOperationIds:string[];fetchedAt:string;currency:'EGP';productionBatches?:import('./production').ProductionBatch[];costAdjustments?:{operationId:string;kind:string;owner:string;amount:string}[];costingMethod?:'weighted_average';workshopDocuments?:import('./butchery').WorkshopDocument[];transfers?:import('./butchery').Transfer[]};
export type CommandResult = {operationId:string;outcome:'accepted'|'needs_review';reference?:string;code?:string;message?:string;amount?:string};
export class BusinessError extends Error { constructor(public code:string, message:string,public status=409){super(message);} }
export const messages: Record<string,string> = {INSUFFICIENT_STOCK:'الرصيد المتاح لا يكفي. راجع العملية قبل إعادة إرسالها.',FORBIDDEN:'ليس لديك صلاحية لهذه المؤسسة أو الموقع.',PAYLOAD_CONFLICT:'معرّف العملية مستخدم لبيانات مختلفة.',INVALID_COMMAND:'تحقق من بيانات العملية.',AUTH_REQUIRED:'انتهت الجلسة. اتصل بالإنترنت وسجل الدخول مرة أخرى.'};
