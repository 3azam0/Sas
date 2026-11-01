import {z} from 'zod';
import {quantitySchema} from './index';
import {productionSchemas} from './production';

export const nonnegative=z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/);
const base={operationId:z.uuid(),organizationId:z.enum(['grills','bistro']),businessDate:z.iso.date(),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1),reason:z.string().trim().max(200).default('')};
export const meatKind=z.enum(['beef_input','sheep_live','beef_product','lamb_product']);
export type MeatKind=z.infer<typeof meatKind>;
export const workshopCommandSchema=z.discriminatedUnion('type',[
 ...productionSchemas,
 z.object({...base,type:z.literal('product.create'),itemId:z.uuid(),name:z.string().trim().min(2).max(100),meatKind}),
 z.object({...base,type:z.literal('butchery.process'),reason:z.string().trim().min(2).max(200),mode:z.enum(['beef','lamb']),itemId:z.string().min(1),quantity:quantitySchema,headCount:z.number().int().min(1).max(100000).optional(),carcassWeight:quantitySchema.optional(),slaughterLoss:nonnegative,cuttingLoss:nonnegative,processingCost:nonnegative,outputs:z.array(z.object({itemId:z.string().min(1),quantity:quantitySchema,costShare:nonnegative})).min(1).max(50)}),
 z.object({...base,type:z.literal('transfer.dispatch'),sourceId:z.string().min(1),destinationId:z.string().min(1),itemId:z.string().min(1),quantity:quantitySchema}),
 z.object({...base,type:z.literal('transfer.receive'),transferId:z.uuid(),quantity:quantitySchema})
]);
export type WorkshopCommand=z.infer<typeof workshopCommandSchema>;
export type WorkshopDocument={id:string;reference?:string;command:WorkshopCommand;amount:string;postedAt:string;details:Record<string,unknown>};
export type Transfer={id:string;reference?:string;sourceId:string;destinationId:string;itemId:string;quantity:string;remaining:string;remainingValue:string;amount:string;businessDate:string};
