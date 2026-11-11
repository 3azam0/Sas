import {z} from 'zod';
import {openingSchema,receiptDocumentSchema,kitchenIssueSchema,quantitySchema} from './index';
const base={operationId:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),generation:z.uuid(),sourceId:z.uuid(),reason:z.string().trim().min(2).max(500),businessDate:z.iso.date()};
export const documentReplacementSchema=z.discriminatedUnion('kind',[
 z.object({...base,kind:z.literal('opening'),replacement:openingSchema}).strict(),
 z.object({...base,kind:z.literal('receipt'),replacement:receiptDocumentSchema}).strict(),
 z.object({...base,kind:z.literal('kitchen'),replacement:kitchenIssueSchema}).strict()
]);
export const kitchenVoidSchema=z.object({...base,kind:z.literal('kitchen_void')}).strict();
const receiptBase={operationId:base.operationId,organizationId:base.organizationId,generation:base.generation,sourceId:base.sourceId,reason:base.reason,expectedRevision:z.number().int().min(0)};
export const receiptRevisionSchema=z.discriminatedUnion('kind',[
 z.object({...receiptBase,kind:z.literal('receipt_edit'),document:receiptDocumentSchema}).strict(),
 z.object({...receiptBase,kind:z.literal('receipt_void')}).strict()
]);
export const kitchenQuantityCorrectionSchema=z.object({
 operationId:base.operationId,organizationId:base.organizationId,generation:base.generation,
 sourceId:base.sourceId,lineId:z.uuid(),expectedRevision:z.number().int().min(0),
 quantity:quantitySchema,reason:base.reason,kind:z.literal('kitchen_quantity')
}).strict();
export const kitchenEditDocumentSchema=kitchenIssueSchema.safeExtend({
 lines:z.array(kitchenIssueSchema.shape.lines.element).max(200)
});
export const kitchenDocumentEditSchema=z.object({
 operationId:base.operationId,organizationId:base.organizationId,generation:base.generation,
 sourceId:base.sourceId,expectedRevision:z.number().int().min(0),reason:base.reason,
 kind:z.literal('kitchen_edit'),document:kitchenEditDocumentSchema
}).strict();
export const kitchenIssueRevisionSchema=z.discriminatedUnion('kind',[kitchenQuantityCorrectionSchema,kitchenDocumentEditSchema]);
export type KitchenIssueRevisionCommand=z.infer<typeof kitchenIssueRevisionSchema>;
type KitchenRevisionLine={quantity:string;unitPrice?:string};
export type KitchenDocumentChanges={
 fields:{field:'businessDate'|'kitchen'|'reference'|'notes';previous:string;current:string}[];
 lines:{itemId:string;lineId?:string;name:string;unit:string;previous?:KitchenRevisionLine;current?:KitchenRevisionLine}[];
};
export type KitchenDocumentRevision={
 revision:number;operationId:string;actor:string;reason:string;businessDate:string;postedAt:string;changes:KitchenDocumentChanges;
};
export type KitchenQuantityCorrection=z.infer<typeof kitchenQuantityCorrectionSchema>;
export type KitchenQuantityRevision={
 revision:number;lineId:string;operationId:string;previousQuantity:string;quantity:string;
 amount:string;actor:string;reason:string;businessDate:string;postedAt:string;
};
export type ReceiptRevisionCommand=z.infer<typeof receiptRevisionSchema>;
export const documentCorrectionSchema=z.union([documentReplacementSchema,kitchenVoidSchema]);
export type DocumentReplacementCommand=z.infer<typeof documentReplacementSchema>;
export type DocumentCorrectionCommand=z.infer<typeof documentCorrectionSchema>;
export type DocumentCorrection={operationId:string;kind:'opening'|'receipt'|'kitchen';sourceId:string;replacementId:string;reason:string;postedAt:string};
