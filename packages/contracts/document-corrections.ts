import {z} from 'zod';
import {openingSchema,receiptDocumentSchema,kitchenIssueSchema} from './index';
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
export type ReceiptRevisionCommand=z.infer<typeof receiptRevisionSchema>;
export const documentCorrectionSchema=z.union([documentReplacementSchema,kitchenVoidSchema]);
export type DocumentReplacementCommand=z.infer<typeof documentReplacementSchema>;
export type DocumentCorrectionCommand=z.infer<typeof documentCorrectionSchema>;
export type DocumentCorrection={operationId:string;kind:'opening'|'receipt'|'kitchen';sourceId:string;replacementId:string;reason:string;postedAt:string};
