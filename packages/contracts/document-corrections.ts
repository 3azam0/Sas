import {z} from 'zod';
import {openingSchema,receiptDocumentSchema,kitchenIssueSchema} from './index';
const base={operationId:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),generation:z.uuid(),sourceId:z.uuid(),reason:z.string().trim().min(2).max(500),businessDate:z.iso.date()};
export const documentCorrectionSchema=z.discriminatedUnion('kind',[
 z.object({...base,kind:z.literal('opening'),replacement:openingSchema}).strict(),
 z.object({...base,kind:z.literal('receipt'),replacement:receiptDocumentSchema}).strict(),
 z.object({...base,kind:z.literal('kitchen'),replacement:kitchenIssueSchema}).strict()
]);
export type DocumentCorrectionCommand=z.infer<typeof documentCorrectionSchema>;
export type DocumentCorrection={operationId:string;kind:'opening'|'receipt'|'kitchen';sourceId:string;replacementId:string;reason:string;postedAt:string};
