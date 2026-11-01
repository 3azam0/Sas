import {z} from 'zod';

const positive=z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/).refine(v=>Number(v)>0);
const nonNegative=z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/);
const envelope={operationId:z.uuid(),replacesOperationId:z.uuid().optional(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),generation:z.uuid().optional(),locationId:z.string().min(1).max(100),businessDate:z.iso.date(),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1),currency:z.literal('EGP'),reference:z.string().trim().min(2).max(200)};
export const financeCommandSchema=z.discriminatedUnion('type',[
 z.object({...envelope,type:z.literal('sales.correct'),saleLineId:z.uuid(),kind:z.enum(['refund','void']),quantity:positive,amount:nonNegative,stockDisposition:z.enum(['consumed','review_required']),reason:z.string().trim().min(2).max(300)}),
 z.object({...envelope,type:z.literal('expense.post'),category:z.string().trim().min(2).max(80),amount:positive,paymentMethod:z.enum(['cash','bank','card','other']),notes:z.string().trim().max(300)}),
 z.object({...envelope,type:z.literal('expense.reverse'),expenseId:z.uuid(),reason:z.string().trim().min(2).max(300)})
]);
export type FinanceCommand=z.infer<typeof financeCommandSchema>;
export type FinanceRecord={command:FinanceCommand;amount:string;actor:string;postedAt:string};
export type FinanceSnapshot={financeRecords?:FinanceRecord[]};
