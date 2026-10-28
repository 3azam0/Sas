import {z} from 'zod';
export type PurchaseDraftSeed={reference:string;lines:{itemId:string;quantity:string;unitCost:string}[]};
export const stockLotSchema=z.object({code:z.string().trim().min(1).max(80),expiresOn:z.iso.date().optional(),manufacturedOn:z.iso.date().optional()}).superRefine((l,c)=>{if(l.expiresOn&&l.manufacturedOn&&l.expiresOn<l.manufacturedOn)c.addIssue({code:'custom',message:'الصلاحية تسبق تاريخ الإنتاج.'});});
export type StockLot=z.infer<typeof stockLotSchema>;
export type LotMetadata=StockLot&{originId:string};
export type InventoryRole='owner'|'manager'|'operator'|'viewer';
const controlBase={operationId:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),generation:z.uuid(),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1)};
export const inventoryControlSchema=z.discriminatedUnion('type',[
 z.object({...controlBase,type:z.literal('day.close'),locationId:z.string().min(1).max(80),through:z.iso.date(),expectedRevision:z.number().int().min(0),reason:z.string().trim().min(2).max(500),acknowledgeIncomplete:z.boolean()}),
 z.object({...controlBase,type:z.literal('day.reopen'),locationId:z.string().min(1).max(80),expectedRevision:z.number().int().min(1),reason:z.string().trim().min(2).max(500)}),
 z.object({...controlBase,type:z.literal('variance.explain'),locationId:z.string().min(1).max(80),itemId:z.string().min(1).max(80),from:z.iso.date(),to:z.iso.date(),checkpoint:z.string().regex(/^\d+:\d+$/),reason:z.string().trim().min(2).max(500),reviewed:z.boolean()}),
 z.object({...controlBase,type:z.literal('access.role'),userId:z.uuid(),role:z.enum(['owner','manager','operator','viewer']),displayName:z.string().trim().min(2).max(80),reason:z.string().trim().min(2).max(500)})
]);
export type InventoryControlCommand=z.infer<typeof inventoryControlSchema>;
export type DayClosure={locationId:string;through:string|null;revision:number;actor:string;reason:string;updatedAt:string};
export type VarianceExplanation={operationId:string;locationId:string;itemId:string;from:string;to:string;checkpoint:string;reason:string;reviewed:boolean;actor:string;createdAt:string};
export type InventoryOperationsSnapshot={closures:DayClosure[];explanations:VarianceExplanation[];members:{userId:string;role:InventoryRole;displayName:string;active:boolean}[]};
