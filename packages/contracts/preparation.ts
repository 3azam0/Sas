import {z} from 'zod';
const quantity=z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/);
const positive=quantity.refine(v=>Number(v)>0,'أدخل كمية موجبة.');
export const preparationPlanSchema=z.object({
 schemaVersion:z.literal(1),id:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),generation:z.uuid(),revision:z.number().int().min(0),
 name:z.string().trim().min(2).max(80),businessDate:z.iso.date(),kitchenId:z.string().min(1).max(80),sourceLocationId:z.string().min(1).max(80),
 state:z.enum(['draft','closed']),updatedAt:z.iso.datetime(),
 lines:z.array(z.object({id:z.uuid(),versionId:z.uuid(),quantity:positive,completed:quantity.default('0'),discarded:quantity.default('0'),note:z.string().trim().max(200).default('')})).max(100),
 links:z.array(z.object({operationId:z.uuid(),lineId:z.uuid().optional(),kind:z.enum(['production','supply'])})).max(1000)
}).superRefine((p,ctx)=>{
 if(new Set(p.lines.map(l=>l.id)).size!==p.lines.length||new Set(p.lines.map(l=>l.versionId)).size!==p.lines.length)ctx.addIssue({code:'custom',message:'إصدارات الخطة ومعرّفات السطور لا تتكرر.'});
 if(new Set(p.links.map(l=>l.operationId)).size!==p.links.length||p.links.some(l=>l.kind==='production'&&(!l.lineId||!p.lines.some(r=>r.id===l.lineId))))ctx.addIssue({code:'custom',message:'روابط التنفيذ لا تطابق الخطة.'});
});
export type PreparationPlan=z.infer<typeof preparationPlanSchema>;
export type PreparationSupplySeed={operationId:string;kitchenId:string;businessDate:string;reference:string;notes:string;lines:{lineId:string;itemId:string;unitId:string;quantity:string}[]};
export type PreparationProductionSeed={operationId:string;versionId:string;plannedOutput:string;inputLocationId:string;outputLocationId:string;businessDate:string;reference:string};
