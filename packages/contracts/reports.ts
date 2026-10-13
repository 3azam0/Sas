import {z} from 'zod';

export const reportKinds=['overview','inventory','kitchens','kitchenSupply','purchasing','waste','sales','production'] as const;
export type ReportKind=typeof reportKinds[number];
const filter=z.string().trim().max(100).default('');
export const reportQuerySchema=z.object({
 organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),generation:z.uuid().optional(),
 kind:z.enum(reportKinds),from:z.iso.date(),to:z.iso.date(),locationId:filter,category:filter,itemId:filter,supplierId:filter,kitchenId:filter,posId:filter,search:z.string().trim().max(100).default(''),
 sort:z.enum(['date_desc','date_asc','amount_desc','amount_asc','name_asc','name_desc','quantity_desc','quantity_asc']).default('date_desc'),page:z.number().int().min(1).max(100000).default(1),pageSize:z.number().int().min(10).max(100).default(25)
}).superRefine((q,ctx)=>{
 const days=(Date.parse(q.to)-Date.parse(q.from))/86400000;
 if(days<0||days>365)ctx.addIssue({code:'custom',path:['to'],message:'اختر فترة صحيحة لا تتجاوز ٣٦٦ يوماً.'});
 if(q.supplierId&&q.kind!=='purchasing')ctx.addIssue({code:'custom',path:['supplierId'],message:'تصفية المورد تخص المشتريات.'});
 if(q.kitchenId&&!['kitchens','kitchenSupply'].includes(q.kind))ctx.addIssue({code:'custom',path:['kitchenId'],message:'تصفية المطبخ تخص صرف المطابخ.'});
 if(q.posId&&q.kind!=='sales')ctx.addIssue({code:'custom',path:['posId'],message:'تصفية نقطة البيع تخص المبيعات.'});
 if(q.kind==='sales'&&q.category)ctx.addIssue({code:'custom',message:'صنف البيع يختلف عن مادة المخزون.'});
});
export type ReportQuery=Omit<z.infer<typeof reportQuerySchema>,'posId'>&{posId?:string};
export type ReportFilters=Omit<ReportQuery,'organizationId'|'generation'>;
export type PeriodMetrics={received:string;reversed:string;returned:string;returnReference:string;netReceived:string;kitchen:string;kitchenSupplyDocuments?:number;kitchenSupplyItems?:number;kitchenLegacyIssue?:string;kitchenTransferIn?:string;kitchenTransferOut?:string;waste:string;countIncrease:string;countDecrease:string;sales:string;salesDeduction:string;productionInput:string;productionWaste:string;estimatedSalesCost:string|null;estimatedMargin:string|null;foodCostPercent:string|null};
export type ReportRank={key:string;label:string;value:string};
export type ReportDay={date:string;received:string;kitchen:string;kitchenSupply?:string;kitchenLegacyIssue?:string;waste:string;sales:string};
export type ReportRow={id:string;documentId?:string;date:string;locationId:string;locationName:string;itemId:string;name:string;sku:string;category:string;unit:string;quantity:string;amount:string;unitCost:string|null;type:string;reference:string;supplierId:string;supplierName:string;kitchenId:string;kitchenName:string;posId?:string;posName?:string;estimatedCost?:string|null;extra?:string};
export type ReportResponse={schemaVersion:1;organizationId:string;generation:string;generatedAt:string;checkpoint:string;query:ReportQuery;previousRange:{from:string;to:string};current:PeriodMetrics;previous:PeriodMetrics;stock:{value:string;items:number;low:number};charts:{daily:ReportDay[];inventory:ReportRank[];kitchens:ReportRank[];kitchenSupply?:ReportRank[];suppliers:ReportRank[];waste:ReportRank[];sales:ReportRank[];production:ReportRank[]};shortages?:{itemId:string;name:string;unit:string;required:string;deducted:string;missing:string}[];rows:ReportRow[];total:number;page:number};
