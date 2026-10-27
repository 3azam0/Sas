import {z} from 'zod';
import {quantitySchema,organizationIdSchema} from './index';
import type {CostingMethod} from './index';

const nonnegative=z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/);
const recordId=z.string().min(1).max(80);
const base={generation:z.uuid().optional(),operationId:z.uuid(),organizationId:organizationIdSchema,businessDate:z.iso.date(),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1),reason:z.string().trim().min(2).max(200)};
export const meatKind=z.enum(['beef_input','sheep_live','beef_product','lamb_product']);
export type MeatKind=z.infer<typeof meatKind>;
export const butcheryCommandSchema=z.discriminatedUnion('type',[
 z.object({...base,type:z.literal('product.create'),itemId:z.uuid(),name:z.string().trim().min(2).max(100),unitId:recordId,meatKind}),
 z.object({...base,type:z.literal('product.classify'),itemId:recordId,meatKind}),
 z.object({...base,type:z.literal('butchery.process'),locationId:recordId,mode:z.enum(['beef','lamb']),itemId:recordId,quantity:quantitySchema,headCount:z.number().int().min(1).max(100000).optional(),carcassWeight:quantitySchema.optional(),slaughterLoss:nonnegative,cuttingLoss:nonnegative,processingCost:nonnegative,outputs:z.array(z.object({itemId:recordId,quantity:quantitySchema,costShare:nonnegative})).min(1).max(50)})
]);
export type ButcheryCommand=z.infer<typeof butcheryCommandSchema>;
export type ButcheryCatalog={itemId:string;meatKind:MeatKind;unitId:string};
export type ButcheryOutput={itemId:string;quantity:string;costShare:string;amount:string;unitCost:string};
export type PostedButchery={document:ButcheryCommand;inputAmount:string;amount:string;method:CostingMethod;outputs?:ButcheryOutput[];postedAt:string};
export function isKilogramUnit(name:string){return ['كجم','كغ','كيلوجرام','كيلوغرام','كيلو','kg','kilogram','kilograms','k.g.'].includes(name.trim().toLocaleLowerCase());}
