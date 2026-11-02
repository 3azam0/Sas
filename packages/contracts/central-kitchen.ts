import {z} from 'zod';
import type {CostingMethod} from './index';
import type {LotMetadata} from './inventory-operations';
const id=z.string().min(1).max(80);
const amount=z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/);
const quantity=amount.refine(v=>Number(v)>0,'أدخل كمية أكبر من صفر.');
const base={operationId:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),generation:z.uuid(),batchId:z.uuid(),expectedRevision:z.number().int().min(0),businessDate:z.iso.date(),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1),notes:z.string().trim().max(1000).default('')};
const material={lineId:z.uuid(),itemId:id,unitId:id,quantity};
const settlement={lineId:z.uuid(),issueLineId:z.uuid(),quantity};
export const centralCommandSchema=z.discriminatedUnion('type',[
 z.object({...base,type:z.literal('central.amend'),name:z.string().trim().min(2).max(120),operationType:z.enum(['butchery','preparation','manufacturing']),recipeVersionId:z.uuid().optional(),plannedOutput:quantity.optional(),reason:z.string().trim().min(2).max(500)}),
 z.object({...base,type:z.literal('central.create'),locationId:id,name:z.string().trim().min(2).max(120),operationType:z.enum(['butchery','preparation','manufacturing']),recipeVersionId:z.uuid().optional(),plannedOutput:quantity.optional(),butcheryMode:z.enum(['beef','sheep']).optional()}),
 z.object({...base,type:z.literal('central.issue'),lines:z.array(z.object(material)).min(1).max(200)}),
 z.object({...base,type:z.literal('central.return'),recipient:z.string().trim().min(2).max(120),lines:z.array(z.object({...settlement,sourceId:z.uuid().optional()})).min(1).max(200)}),
 z.object({...base,type:z.literal('central.receive'),recipient:z.string().trim().min(2).max(120),lines:z.array(z.object({...material,weightKg:quantity.optional(),lot:z.object({code:z.string().trim().min(1).max(80),expiresOn:z.iso.date().optional(),manufacturedOn:z.iso.date().optional()}).optional()})).min(1).max(200)}),
 z.object({...base,type:z.literal('central.loss'),lines:z.array(z.object({...settlement,sourceId:z.uuid().optional(),reason:z.string().trim().min(2).max(500),kind:z.enum(['normal','abnormal']).default('normal')})).min(1).max(200)}),
 z.object({...base,type:z.literal('central.cost'),amount:quantity,reason:z.string().trim().min(2).max(500)}),
 z.object({...base,type:z.literal('central.close'),consumption:z.array(z.object({issueLineId:z.uuid(),quantity:amount})).max(5000),allocations:z.array(z.object({itemId:id,share:quantity.refine(v=>Number(v)<=100)})).max(200).default([]),balanceReason:z.string().trim().max(500).default('')}),
 z.object({...base,type:z.literal('central.reverse'),targetOperationId:z.uuid(),reason:z.string().trim().min(2).max(500)})
]).superRefine((c,ctx)=>{
 const ids=[c.operationId,...('lines'in c?c.lines.map(l=>l.lineId):[])];
 if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'معرّفات المستند والسطور يجب ألا تتكرر.'});
 if(c.type==='central.issue'||c.type==='central.receive'){if(new Set(c.lines.map(l=>l.itemId)).size!==c.lines.length)ctx.addIssue({code:'custom',message:'اجمع الصنف في سطر واحد في المستند.'});}
 if(c.type==='central.close'&&(new Set(c.consumption.map(l=>l.issueLineId)).size!==c.consumption.length||new Set(c.allocations.map(l=>l.itemId)).size!==c.allocations.length))ctx.addIssue({code:'custom',message:'سطور التسوية أو توزيع التكلفة مكررة.'});
});
export type CentralCommand=z.infer<typeof centralCommandSchema>;
export type CentralSource={sourceId:string;quantity:string;amount:string;returned:string;returnedAmount:string;lost?:string;lostAmount?:string;lot?:LotMetadata|null};
export type CentralIssue={lineId:string;operationId:string;itemId:string;unitId:string;quantity:string;amount:string;returned:string;returnedAmount:string;lost:string;abnormalAmount:string;sources:CentralSource[]};
export type CentralReceipt={lineId:string;operationId:string;itemId:string;unitId:string;quantity:string;weightKg?:string;recipient:string;businessDate:string;lot?:{code:string;expiresOn?:string;manufacturedOn?:string};finalAmount?:string};
export type CentralCostReferenceLine={itemId:string;expectedQuantity:string;unitCost:string|null;amount:string|null};
export type CentralCostReference={capturedAt:string;recipeVersionId:string;plannedOutput:string;recipeOutputQuantity:string;complete:boolean;knownAmount:string;batchCost:string|null;unitCost:string|null;lines:CentralCostReferenceLine[]};
export type CentralBatch={batchId:string;reference:string;name:string;locationId:string;operationType:'butchery'|'preparation'|'manufacturing';butcheryMode?:'beef'|'sheep';recipeVersionId?:string;plannedOutput?:string;costReference?:CentralCostReference;revision:number;status:'draft'|'in_progress'|'partially_received'|'closed';businessDate:string;operator:string;notes:string;method:CostingMethod;issues:CentralIssue[];receipts:CentralReceipt[];losses:{lineId:string;issueLineId:string;quantity:string;amount:string;kind:'normal'|'abnormal';reason:string}[];processingCosts:{operationId:string;amount:string;reason:string}[];issuedAmount:string;returnedAmount:string;processingAmount:string;abnormalAmount:string;wipAmount:string;outputAmount:string;expenseAmount:string;createdAt:string;closedAt?:string;balanceReason?:string;consumption?:{issueLineId:string;quantity:string}[];allocations?:{itemId:string;share:string}[]};
export type CentralEffect={operationId:string;itemId:string;quantity:string;amount:string;lot?:LotMetadata|null};
export type CentralAction={operationId:string;batchId:string;command:CentralCommand;actor:string;postedAt:string;amount:string;effects:CentralEffect[];reversedBy?:string|null};
