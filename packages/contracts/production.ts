import {z} from 'zod';
const positive=z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/).refine(v=>Number(v)>0);
const nonnegative=z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/);
const base={operationId:z.uuid(),organizationId:z.enum(['grills','bistro']),businessDate:z.iso.date(),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1),reason:z.string().trim().max(200).default('')};
const batch={...base,batchId:z.uuid()};
export const productionSchemas=[
 z.object({...base,type:z.literal('inventory.count'),reason:z.string().trim().min(2).max(200),locationId:z.string().min(1),itemId:z.string().min(1),quantity:nonnegative,expectedQuantity:nonnegative,expectedValue:z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/),expectedRevision:z.string().regex(/^\d+$/),unitCost:nonnegative}),
 z.object({...base,type:z.literal('catalog.create'),itemId:z.uuid(),name:z.string().trim().min(2).max(100),unit:z.enum(['كجم','جم','لتر','مل','قطعة']),role:z.enum(['raw','intermediate','finished'])}),
 z.object({...batch,type:z.literal('production.create'),name:z.string().trim().max(100).default('').refine(v=>v.length===0||v.length>=2),operationType:z.enum(['butchery','preparation','manufacturing']),recipient:z.string().trim().min(2).max(100),balanceMode:z.enum(['mass','documented']),outputs:z.array(z.object({itemId:z.string().min(1),quantity:positive,costShare:nonnegative})).min(1).max(50)}),
 z.object({...batch,type:z.literal('production.issue'),recipient:z.string().trim().min(2).max(100),lines:z.array(z.object({itemId:z.string().min(1),quantity:positive,unit:z.enum(['كجم','جم','لتر','مل','قطعة'])})).min(1).max(50)}),
 z.object({...batch,type:z.literal('production.return'),issueId:z.uuid(),quantity:positive}),
 z.object({...batch,type:z.literal('production.loss'),reason:z.string().trim().min(2).max(200),issueId:z.uuid(),quantity:positive}),
 z.object({...batch,type:z.literal('production.receive'),itemId:z.string().min(1),quantity:positive,provisionalValue:nonnegative}),
 z.object({...batch,type:z.literal('production.cost'),amount:positive}),
 z.object({...batch,type:z.literal('production.close'),reconciliationNote:z.string().trim().max(500),butchery:z.object({mode:z.enum(['beef','lamb']),headCount:z.number().int().positive().optional(),carcassWeight:positive.optional(),slaughterLoss:nonnegative,cuttingLoss:nonnegative}).optional(),usages:z.array(z.object({issueId:z.uuid(),consumed:nonnegative,loss:nonnegative,lossReason:z.string().trim().max(200)})).min(1).max(500)}),
 z.object({...batch,type:z.literal('production.cancel'),reason:z.string().trim().min(2).max(200)}),
 z.object({...batch,type:z.literal('production.reverse'),reason:z.string().trim().min(2).max(200),targetOperationId:z.uuid()}),
] as const;
export const productionCommandSchema=z.discriminatedUnion('type',productionSchemas);
export type ProductionCommand=z.infer<typeof productionCommandSchema>;
export type ProductionIssue={id:string;operationId:string;itemId:string;quantity:string;amount:string;returned:string;node:string;recipient:string;operator:string};
export type ProductionReceipt={id:string;operationId:string;itemId:string;quantity:string;amount:string;node:string;reversed?:boolean;finalValue?:string};
export type ProductionReturn={operationId:string;issueId:string;quantity:string;amount:string;reversed?:boolean};
export type ProductionBatch={id:string;reference?:string;name:string;operationType:'butchery'|'preparation'|'manufacturing';status:'draft'|'in_progress'|'partially_received'|'closed'|'cancelled';warehouseId:string;businessDate:string;operator:string;recipient:string;notes:string;balanceMode:'mass'|'documented';outputs:{itemId:string;quantity:string;costShare:string}[];issues:ProductionIssue[];receipts:ProductionReceipt[];returns:ProductionReturn[];losses?:{operationId:string;issueId:string;quantity:string;reason:string}[];processingCost:string;costOperations:{operationId:string;amount:string;reversed?:boolean}[];usages?:{issueId:string;consumed:string;loss:string;lossReason:string}[];reconciliationNote?:string;wipValue?:string;finalCost?:string;closedAt?:string};
