import {z} from 'zod';
export const kitchenStateSchema=z.enum(['new','preparing','ready','collected']);
export type KitchenState=z.infer<typeof kitchenStateSchema>;
export const kitchenOrderCommandSchema=z.object({operationId:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),generation:z.uuid().optional(),type:z.literal('pos.kitchen'),saleId:z.uuid(),kitchenId:z.string().min(1).max(100),expectedRevision:z.number().int().min(0),state:z.enum(['preparing','ready','collected']),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1)});
export type KitchenOrderCommand=z.infer<typeof kitchenOrderCommandSchema>;
export type KitchenTicket={saleId:string;kitchenId:string;revision:number;state:KitchenState;updatedAt:string;actor:string};
