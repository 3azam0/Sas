import { z } from 'zod';
export type CostingMethod='fifo'|'moving_average';
export const costingCommandSchema=z.object({operationId:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),generation:z.uuid(),expectedRevision:z.number().int().min(1),method:z.enum(['fifo','moving_average']),resetSamples:z.literal(true)});
export type CostingCommand=z.infer<typeof costingCommandSchema>;
export const quantitySchema = z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/, 'أدخل كمية موجبة حتى ٦ منازل عشرية').refine(v => Number(v) > 0, 'الكمية يجب أن تكون أكبر من صفر');
export const commandSchema = z.object({
  generation:z.uuid().optional(),operationId: z.uuid(), organizationId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/), locationId: z.string().min(1).max(80),
  type: z.enum(['receipt.post','waste.post']), itemId: z.string().min(1).max(80), quantity: quantitySchema,
  unitCost: z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/).optional(),
  reason: z.string().trim().min(2).max(200), businessDate: z.iso.date(), capturedAt: z.iso.datetime(), schemaVersion:z.literal(1),
  supplierId:z.string().min(1).max(80).optional(),purchaseUnitId:z.uuid().optional(),enteredQuantity:quantitySchema.optional()
}).superRefine((v,ctx)=>{
  if(v.type === 'receipt.post' && !v.unitCost) ctx.addIssue({code:'custom',message:'تكلفة الوحدة مطلوبة',path:['unitCost']});
  if(!!v.purchaseUnitId!==!!v.enteredQuantity || (v.type==='waste.post'&&(v.purchaseUnitId||v.supplierId)))ctx.addIssue({code:'custom',message:'بيانات وحدة الشراء أو المورد غير صالحة'});
});
export type Command = z.infer<typeof commandSchema>;
export type DemoProfile = string;
const profileText=z.string().trim().max(300);
const publicLink=z.url().refine(value=>value.startsWith('https://'),'Use an HTTPS link');
export const organizationProfileSchema=z.object({
 nameEn:profileText.optional(),businessType:profileText.optional(),city:profileText.optional(),country:profileText.optional(),address:profileText.optional(),
 phone:z.string().regex(/^[+0-9 ()-]{3,40}$/).optional(),additionalPhone:z.string().regex(/^[+0-9 ()-]{3,40}$/).optional(),
 whatsapp:z.string().regex(/^\+[1-9][0-9]{6,14}$/).optional(),email:z.email().optional(),mapUrl:publicLink.optional(),facebookUrl:publicLink.optional(),
 logoPath:z.string().regex(/^\/branding\/[a-z0-9-]+\.(webp|png)$/).optional()
});
export type OrganizationProfile=z.infer<typeof organizationProfileSchema>;
export const organizationIdSchema=z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
export type Access = { organizationId: DemoProfile; userId: string; deviceId: string; expiresAt: string };
export type PurchaseUnit={id:string;name:string;factor:string};
export type Unit={id:string;name:string;revision:number};
export type Kitchen={id:string;name:string;active:boolean;revision:number};
export type Supplier={id:string;name:string;phone:string;email:string;address:string;active:boolean;revision:number};
export type Item = { id: string; name: string; sku: string; category: string; unit: string; minimum: string;unitId?:string;purchaseUnits?:PurchaseUnit[];active?:boolean;revision?:number };
export type Location = {id:string;name:string;kind:string;active?:boolean;revision?:number};
export type Balance = {locationId:string;itemId:string;quantity:string;value:string;average:string|null};
export type Layer = {id:string;locationId:string;itemId:string;remaining:string;unitCost:string;remainingValue?:string;sequence:number};
export type Entry = {operationId:string;locationId:string;itemId:string;quantity:string;amount:string;type:string;reason:string;businessDate:string;postedAt:string;receiptDocumentId?:string|null;referenceAmount?:string|null;supplierId?:string|null;purchaseUnitId?:string|null;enteredQuantity?:string|null;purchaseReceiptId?:string|null;purchaseOrderLineId?:string|null;supplierReturnId?:string|null;transferId?:string|null;transferLineId?:string|null;productionId?:string|null;countId?:string|null;countLineId?:string|null;kitchenIssueId?:string|null};
export type Snapshot = {generation?:string;costing?:{method:CostingMethod;revision:number;hasStockHistory:boolean};organizationId:DemoProfile;organizationName:string;organizationProfile?:OrganizationProfile;access:Access;locations:Location[];items:Item[];balances:Balance[];layers:Layer[];entries:Entry[];acceptedOperationIds:string[];fetchedAt:string;currency:'EGP';units?:Unit[];kitchens?:Kitchen[];suppliers?:Supplier[];menuItems?:MenuItem[];salesImports?:ImportedSales[];productions?:PostedProduction[];recipes?:Recipe[];recipeVersions?:RecipeVersion[];receiptPrices?:ReceiptPrice[];receipts?:PostedReceiptDocument[];kitchenIssues?:PostedKitchenIssue[];openings?:PostedOpening[];stockCheckpoints?:{locationId:string;sequence:string}[];counts?:StockCount[];countRevisions?:{countId:string;revision:number;command:CountCommand;postedAt:string}[];reconciliation?:StockReconciliation[];transfers?:Transfer[];transferActions?:TransferAction[];supplierReturns?:PostedSupplierReturn[];returnSources?:ReturnSource[];purchaseOrders?:PurchaseOrder[];purchaseReceipts?:PurchaseReceipt[];purchaseRevisions?:{orderId:string;revision:number;record:{state:string;payload:PurchaseDefinition}}[]};
export type CommandResult = {operationId:string;outcome:'accepted'|'needs_review';code?:string;message?:string;amount?:string};
export class BusinessError extends Error { constructor(public code:string, message:string,public status=409){super(message);} }
export const messages: Record<string,string> = {INSUFFICIENT_STOCK:'الرصيد المتاح لا يكفي. راجع العملية قبل إعادة إرسالها.',FORBIDDEN:'ليس لديك صلاحية لهذه المؤسسة أو الموقع.',PAYLOAD_CONFLICT:'معرّف العملية مستخدم لبيانات مختلفة.',INVALID_COMMAND:'تحقق من بيانات العملية.',AUTH_REQUIRED:'انتهت الجلسة. اتصل بالإنترنت وسجل الدخول مرة أخرى.'};

const recordId=z.string().min(1).max(80);
const recordName=z.string().trim().min(2).max(100);
const nonNegative=z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/);
const purchaseUnitsSchema=z.array(z.object({id:z.uuid(),name:recordName,factor:quantitySchema})).max(20).refine(rows=>new Set(rows.map(r=>r.id)).size===rows.length&&new Set(rows.map(r=>r.name.toLocaleLowerCase())).size===rows.length,'وحدات الشراء يجب أن تكون مختلفة');
const setupEnvelope={generation:z.uuid().optional(),operationId:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),expectedRevision:z.number().int().min(0),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1)};
export const setupCommandSchema=z.discriminatedUnion('type',[
  z.object({...setupEnvelope,type:z.literal('unit.save'),record:z.object({id:recordId,name:recordName})}),
  z.object({...setupEnvelope,type:z.literal('kitchen.save'),record:z.object({id:recordId,name:recordName,active:z.boolean()})}),
  z.object({...setupEnvelope,type:z.literal('supplier.save'),record:z.object({id:recordId,name:recordName,phone:z.string().trim().max(40),email:z.union([z.literal(''),z.email()]),address:z.string().trim().max(300),active:z.boolean()})}),
  z.object({...setupEnvelope,type:z.literal('location.save'),record:z.object({id:recordId,name:recordName,kind:z.enum(['مطعم','مخزن','مطبخ تحضير','تخزين وتحضير']),active:z.boolean()})}),
  z.object({...setupEnvelope,type:z.literal('item.save'),record:z.object({id:recordId,name:recordName,sku:z.string().trim().min(1).max(60).transform(v=>v.toUpperCase()),category:recordName,unitId:recordId,minimum:nonNegative,purchaseUnits:purchaseUnitsSchema,active:z.boolean()})})
]);
export type SetupCommand=z.infer<typeof setupCommandSchema>;

export const openingSchema=z.object({
 generation:z.uuid().optional(),operationId:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),locationId:recordId,type:z.literal('opening.post'),
 businessDate:z.iso.date(),reason:z.string().trim().min(2).max(200),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1),currency:z.literal('EGP'),
 lines:z.array(z.object({lineId:z.uuid(),itemId:recordId,unitId:recordId,quantity:quantitySchema,unitCost:nonNegative})).min(1).max(200),
 source:z.object({fileName:z.string().max(200),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).optional()
}).superRefine((doc,ctx)=>{
 if(new Set(doc.lines.map(l=>l.itemId)).size!==doc.lines.length||new Set([doc.operationId,...doc.lines.map(l=>l.lineId)]).size!==doc.lines.length+1)ctx.addIssue({code:'custom',message:'المادة ومعرّفات السطور يجب ألا تتكرر'});
});
export type OpeningDocument=z.infer<typeof openingSchema>;
export type PostedOpening={document:OpeningDocument;amount:string;postedAt:string};

export const receiptDocumentSchema=z.object({
 generation:z.uuid().optional(),operationId:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),locationId:recordId,type:z.literal('receipt.document'),
 businessDate:z.iso.date(),reason:z.string().trim().max(200).refine(value=>!value||value.length>=2,'أدخل حرفين على الأقل أو اترك المرجع فارغاً').default(''),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1),currency:z.literal('EGP'),supplierId:recordId.optional(),
 lines:z.array(z.object({lineId:z.uuid(),itemId:recordId,unitId:recordId,quantity:quantitySchema,unitCost:nonNegative,purchaseUnitId:z.uuid().optional(),receivingUnit:z.object({unitId:recordId,name:recordName,baseName:recordName,factor:quantitySchema}).optional(),enteredQuantity:quantitySchema.optional()})).min(1).max(200)
}).superRefine((doc,ctx)=>{
 if(new Set(doc.lines.map(l=>l.itemId)).size!==doc.lines.length||new Set([doc.operationId,...doc.lines.map(l=>l.lineId)]).size!==doc.lines.length+1)ctx.addIssue({code:'custom',message:'المادة ومعرّفات السطور يجب ألا تتكرر'});
 if(doc.lines.some(l=>(!!l.purchaseUnitId||!!l.receivingUnit)!==!!l.enteredQuantity||!!l.purchaseUnitId&&!!l.receivingUnit))ctx.addIssue({code:'custom',message:'بيانات وحدة الاستلام غير مكتملة أو متعارضة'});
});
export type ReceiptDocument=z.infer<typeof receiptDocumentSchema>;
export type PostedReceiptDocument={document:ReceiptDocument;amount:string;postedAt:string};

export const kitchenIssueSchema=z.object({
 generation:z.uuid().optional(),operationId:z.uuid(),organizationId:organizationIdSchema,locationId:recordId,type:z.literal('kitchen.issue'),
 kitchenId:recordId.optional(),kitchen:recordName,businessDate:z.iso.date(),reference:z.string().trim().max(100).refine(value=>!value||value.length>=2,'أدخل حرفين على الأقل أو اترك المرجع فارغاً').default(''),notes:z.string().trim().max(300),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1),currency:z.literal('EGP'),
 lines:z.array(z.object({lineId:z.uuid(),itemId:recordId,unitId:recordId,quantity:quantitySchema})).min(1).max(200)
}).superRefine((d,ctx)=>{if(new Set(d.lines.map(l=>l.itemId)).size!==d.lines.length||new Set([d.operationId,...d.lines.map(l=>l.lineId)]).size!==d.lines.length+1)ctx.addIssue({code:'custom',message:'المواد ومعرّفات السطور لا تتكرر'});});
export type KitchenIssueDocument=z.infer<typeof kitchenIssueSchema>;
export type PostedKitchenIssue={document:KitchenIssueDocument;amount:string;method:CostingMethod;lines:{lineId:string;itemId:string;name:string;sku:string;unit:string;quantity:string;amount:string}[];actor:string;postedAt:string};

const purchaseEnvelope={generation:z.uuid().optional(),operationId:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),orderId:z.uuid(),expectedRevision:z.number().int().min(0),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1)};
export const purchaseLineSchema=z.object({lineId:z.uuid(),itemId:recordId,unitId:recordId,purchaseUnitId:z.uuid().optional(),unitName:recordName,factor:quantitySchema,enteredQuantity:quantitySchema,quantity:quantitySchema,unitCost:nonNegative});
export const purchaseCommandSchema=z.discriminatedUnion('type',[
 z.object({...purchaseEnvelope,type:z.literal('purchase.save'),locationId:recordId,supplierId:recordId,businessDate:z.iso.date(),reference:z.string().trim().min(2).max(200),currency:z.literal('EGP'),lines:z.array(purchaseLineSchema).min(1).max(200)}),
 z.object({...purchaseEnvelope,type:z.literal('purchase.submit')}),
 z.object({...purchaseEnvelope,type:z.literal('purchase.cancel'),reason:z.string().trim().min(2).max(200)}),
 z.object({...purchaseEnvelope,type:z.literal('purchase.receive'),replacesReceiptId:z.uuid().optional(),businessDate:z.iso.date(),reference:z.string().trim().min(2).max(200),lines:z.array(z.object({movementId:z.uuid(),orderLineId:z.uuid(),enteredQuantity:quantitySchema})).min(1).max(200)}),
 z.object({...purchaseEnvelope,type:z.literal('purchase.reverse'),receiptId:z.uuid(),businessDate:z.iso.date(),reason:z.string().trim().min(2).max(200)}),
 z.object({...purchaseEnvelope,type:z.literal('purchase.return'),receiptId:z.uuid(),supplierId:recordId,locationId:recordId,businessDate:z.iso.date(),reason:z.string().trim().min(2).max(200),creditNote:z.string().trim().max(200).optional(),lines:z.array(z.object({movementId:z.uuid(),sourceMovementId:z.uuid(),quantity:quantitySchema})).min(1).max(200)})
]).superRefine((c,ctx)=>{
 if('lines'in c){const ids=c.type==='purchase.save'?c.lines.map(l=>l.lineId):c.lines.map(l=>l.movementId);const refs=c.type==='purchase.save'?c.lines.map(l=>l.itemId):c.type==='purchase.return'?c.lines.map(l=>l.sourceMovementId):c.lines.map(l=>l.orderLineId);if(new Set(ids).size!==ids.length||new Set(refs).size!==refs.length||ids.includes(c.operationId)||ids.includes(c.orderId)||(c.type==='purchase.return'&&ids.some(id=>refs.includes(id)||id===c.receiptId)))ctx.addIssue({code:'custom',message:'معرّفات السطور والمواد يجب ألا تتكرر'});}
 if(c.operationId===c.orderId)ctx.addIssue({code:'custom',message:'معرّف الأمر مستقل عن العملية'});
});
export type PurchaseCommand=z.infer<typeof purchaseCommandSchema>;
export type PurchaseDefinition=Extract<PurchaseCommand,{type:'purchase.save'}>;
export type PurchaseOrder={orderId:string;revision:number;state:'draft'|'submitted'|'partiallyReceived'|'fullyReceived'|'cancelled';document:PurchaseDefinition;received:Record<string,string>};
export type PurchaseReceipt={document:Extract<PurchaseCommand,{type:'purchase.receive'}>;amount:string;postedAt:string;reversed:boolean};
export type SupplierReturn=Extract<PurchaseCommand,{type:'purchase.return'}>;
export type PostedSupplierReturn={document:SupplierReturn;amount:string;inventoryAmount?:string;valuationDifference?:string;postedAt:string};
export type ReturnSource={receiptId:string;orderId:string;supplierId:string;locationId:string;reference:string;lines:{sourceMovementId:string;itemId:string;unitId:string;unitName:string;quantity:string;available:string;returned:string;unitCost:string}[]};

const transferEnvelope={generation:z.uuid().optional(),operationId:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),transferId:z.uuid(),expectedRevision:z.number().int().min(0),businessDate:z.iso.date(),reason:z.string().trim().min(2).max(200),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1)};
const transferActionLines=z.array(z.object({movementId:z.uuid(),dispatchLineId:z.uuid(),quantity:quantitySchema})).min(1).max(200);
export const transferCommandSchema=z.discriminatedUnion('type',[
 z.object({...transferEnvelope,type:z.literal('transfer.dispatch'),sourceId:recordId,destinationId:recordId,lines:z.array(z.object({movementId:z.uuid(),itemId:recordId,unitId:recordId,quantity:quantitySchema})).min(1).max(200)}),
 z.object({...transferEnvelope,type:z.literal('transfer.receive'),lines:transferActionLines}),
 z.object({...transferEnvelope,type:z.literal('transfer.loss'),lines:transferActionLines})
]).superRefine((c,ctx)=>{
 const ids=c.lines.map(l=>l.movementId),refs=c.type==='transfer.dispatch'?c.lines.map(l=>l.itemId):c.lines.map(l=>l.dispatchLineId);
 if(c.operationId===c.transferId||new Set(ids).size!==ids.length||new Set(refs).size!==refs.length||ids.some(id=>id===c.operationId||id===c.transferId||refs.includes(id)))ctx.addIssue({code:'custom',message:'معرّفات التحويل والسطور يجب ألا تتكرر'});
 if(c.type==='transfer.dispatch'&&(c.sourceId===c.destinationId||c.expectedRevision!==0))ctx.addIssue({code:'custom',message:'اختر موقعين مختلفين لتحويل جديد'});
});
export type TransferCommand=z.infer<typeof transferCommandSchema>;
export type TransferDispatch=Extract<TransferCommand,{type:'transfer.dispatch'}>;
export type Transfer={transferId:string;revision:number;document:TransferDispatch;postedAt:string;amount:string;state:'inTransit'|'partial'|'completed'|'resolvedWithLoss';lines:{dispatchLineId:string;itemId:string;unitId:string;quantity:string;received:string;lost:string;remaining:string;amount:string;remainingValue:string}[]};
export type TransferAction={document:TransferCommand;amount:string;postedAt:string};

const countEnvelope={generation:z.uuid().optional(),operationId:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),countId:z.uuid(),expectedRevision:z.number().int().min(0),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1)};
export const countCommandSchema=z.discriminatedUnion('type',[
 z.object({...countEnvelope,type:z.literal('count.save'),entryMode:z.literal('balance_edit').optional(),locationId:recordId,businessDate:z.iso.date(),reason:z.string().trim().min(2).max(200),cutoffAt:z.iso.datetime(),stockSequence:z.string().regex(/^(?:0|[1-9]\d{0,18})$/),currency:z.literal('EGP'),lines:z.array(z.object({lineId:z.uuid(),itemId:recordId,unitId:recordId,expectedQuantity:nonNegative,countedQuantity:nonNegative,surplusUnitCost:nonNegative.optional()})).min(1).max(200)}),
 z.object({...countEnvelope,type:z.literal('count.finalize'),costPolicy:z.literal('explicit'),lines:z.array(z.object({lineId:z.uuid(),movementId:z.uuid()})).min(1).max(200)}),
 z.object({...countEnvelope,type:z.literal('count.cancel'),reason:z.string().trim().min(2).max(200)})
]).superRefine((c,ctx)=>{
 if(c.operationId===c.countId)ctx.addIssue({code:'custom',message:'معرّف الجرد مستقل عن العملية'});
 if(c.type==='count.save'&&c.entryMode==='balance_edit'&&(c.lines.length!==1||c.lines[0].expectedQuantity===c.lines[0].countedQuantity))ctx.addIssue({code:'custom',message:'تعديل الرصيد لمادة واحدة وبكمية جديدة مختلفة'});
 if('lines'in c){const refs=c.lines.map(l=>l.lineId),ids=c.type==='count.save'?c.lines.map(l=>l.itemId):c.lines.map(l=>l.movementId);if(new Set(refs).size!==refs.length||new Set(ids).size!==ids.length||refs.some(id=>id===c.operationId||id===c.countId)||(c.type==='count.finalize'&&ids.some(id=>id===c.operationId||id===c.countId||refs.includes(id))))ctx.addIssue({code:'custom',message:'المواد ومعرّفات سطور الجرد يجب ألا تتكرر'});}
});
export type CountCommand=z.infer<typeof countCommandSchema>;
export type CountDefinition=Extract<CountCommand,{type:'count.save'}>;
export type CountChange={lineId:string;movementId:string;itemId:string;expected:string;counted:string;variance:string;amount:string;surplusUnitCost?:string};
export type FinalizedCount={document:Extract<CountCommand,{type:'count.finalize'}>;changes:CountChange[];amount:string;postedAt:string};
export type StockCount={countId:string;revision:number;state:'draft'|'finalized'|'cancelled';document:CountDefinition;postedAt:string;finalization?:FinalizedCount};
export type StockReconciliation={locationId:string;itemId:string;balanceQuantity:string;balanceValue:string;ledgerQuantity:string;ledgerValue:string;layerQuantity:string;layerValue:string;matches:boolean};

export const recipeInputUnitSchema=z.enum(['base','g','kg','ml','l']);
const recipeComponentFields={lineId:z.uuid(),unitId:recordId,inputUnit:recipeInputUnitSchema,enteredQuantity:quantitySchema,quantity:quantitySchema};
export const recipeDefinitionSchema=z.object({
 code:z.string().trim().min(1).max(60).transform(v=>v.toUpperCase()),name:recordName,
 outputMode:z.enum(['stocked','non_stocked']),outputItemId:recordId.optional(),outputUnitId:recordId,outputQuantity:quantitySchema,effectiveDate:z.iso.date(),salePrice:nonNegative.optional(),salesStockItemIds:z.array(recordId).max(200).optional(),
 lines:z.array(z.discriminatedUnion('kind',[
  z.object({...recipeComponentFields,kind:z.literal('material'),itemId:recordId}),
  z.object({...recipeComponentFields,kind:z.literal('recipe'),versionId:z.uuid()})
 ])).min(1).max(200)
}).superRefine((d,ctx)=>{
 if((d.outputMode==='stocked')!==!!d.outputItemId)ctx.addIssue({code:'custom',message:'الناتج المخزني يحتاج مادة مخزون؛ الناتج غير المخزني لا يرتبط بمادة'});
 if(new Set(d.salesStockItemIds??[]).size!==(d.salesStockItemIds??[]).length)ctx.addIssue({code:'custom',message:'مواد الخصم عند البيع لا تتكرر'});
 if(new Set(d.lines.map(l=>l.lineId)).size!==d.lines.length||new Set(d.lines.map(l=>l.kind==='material'?`item:${l.itemId}`:`version:${l.versionId}`)).size!==d.lines.length)ctx.addIssue({code:'custom',message:'مكونات الوصفة ومعرّفات السطور لا تتكرر'});
});
const recipeEnvelope={generation:z.uuid().optional(),operationId:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),recipeId:z.uuid(),expectedRevision:z.number().int().min(0),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1)};
export const recipeCommandSchema=z.discriminatedUnion('type',[
 z.object({...recipeEnvelope,type:z.literal('recipe.save'),definition:recipeDefinitionSchema}),
 z.object({...recipeEnvelope,type:z.literal('recipe.publish'),versionId:z.uuid()})
]).superRefine((c,ctx)=>{if(c.operationId===c.recipeId||(c.type==='recipe.publish'&&(c.versionId===c.operationId||c.versionId===c.recipeId)))ctx.addIssue({code:'custom',message:'معرّفات الوصفة والعملية والإصدار مستقلة'});});
export type RecipeDefinition=z.infer<typeof recipeDefinitionSchema>;
export type RecipeCommand=z.infer<typeof recipeCommandSchema>;
export type Recipe={recipeId:string;revision:number;state:'draft'|'published';definition:RecipeDefinition;publishedVersionId?:string|null};
export type RecipeVersion={recipeId:string;versionId:string;versionNumber:number;definition:RecipeDefinition;publishedAt:string};
export type ReceiptPrice={locationId:string;itemId:string;unitCost:string;businessDate:string;postedAt:string;sourceOperationId:string};

export const productionSchema=z.object({
 generation:z.uuid().optional(),operationId:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),type:z.literal('production.post'),
 versionId:z.uuid(),inputLocationId:recordId,outputLocationId:recordId,outputMovementId:z.uuid(),
 plannedOutput:quantitySchema,actualOutput:nonNegative,businessDate:z.iso.date(),reference:recordName,
 wasteReason:z.string().trim().max(200).optional(),failureReason:z.string().trim().max(200).optional(),
 capturedAt:z.iso.datetime(),schemaVersion:z.literal(1),
 lines:z.array(z.object({movementId:z.uuid(),itemId:recordId,unitId:recordId,quantity:nonNegative,abnormalWaste:nonNegative})).min(1).max(200)
}).superRefine((d,ctx)=>{
 const ids=[d.operationId,d.outputMovementId,...d.lines.map(l=>l.movementId)];
 if(new Set(ids).size!==ids.length||ids.includes(d.versionId)||new Set(d.lines.map(l=>l.itemId)).size!==d.lines.length)ctx.addIssue({code:'custom',message:'معرّفات الإنتاج والمواد لا تتكرر'});
 if(!d.lines.some(l=>Number(l.quantity)>0)||d.lines.some(l=>Number(l.abnormalWaste)>Number(l.quantity)))ctx.addIssue({code:'custom',message:'الهالك جزء من الكمية المستخدمة؛ يلزم مكون مستخدم واحد على الأقل'});
 if(d.lines.some(l=>Number(l.abnormalWaste)>0)&&(!d.wasteReason||d.wasteReason.length<2))ctx.addIssue({code:'custom',message:'سبب الهالك غير الطبيعي مطلوب'});
 if(Number(d.actualOutput)===0&&(!d.failureReason||d.failureReason.length<2))ctx.addIssue({code:'custom',message:'الناتج صفر يحتاج سبب فشل الدفعة'});
});
export type ProductionDocument=z.infer<typeof productionSchema>;
export type ProductionLineCost={itemId:string;movementId:string;expected:string;quantity:string;variance:string;inputAmount:string;wasteAmount:string};
export type PostedProduction={document:ProductionDocument;recipeName:string;outputItemId:string;outputUnitId:string;method:CostingMethod;inputAmount:string;wasteAmount:string;outputAmount:string;unitCost:string|null;attainment:string;state:'completed'|'failed';lines:ProductionLineCost[];postedAt:string};

const posCode=z.string().trim().min(1).max(60).transform(v=>v.toUpperCase());
export const menuItemSchema=z.object({id:z.uuid(),source:posCode,code:posCode,name:recordName,versionId:z.uuid(),outputPerSale:quantitySchema,active:z.boolean()});
export const menuCommandSchema=z.object({...setupEnvelope,type:z.literal('menu.save'),record:menuItemSchema});
export type MenuCommand=z.infer<typeof menuCommandSchema>;
export type MenuItem=z.infer<typeof menuItemSchema>&{revision:number};
export const salesLineSchema=z.object({lineId:z.uuid(),transactionId:z.string().trim().min(1).max(80),lineKey:z.string().trim().min(1).max(80),businessDate:z.iso.date(),menuItemId:z.uuid(),menuCode:posCode,menuName:recordName,mappingRevision:z.number().int().min(1),versionId:z.uuid(),outputPerSale:quantitySchema,quantity:quantitySchema,netAmount:nonNegative});
export const salesImportSchema=z.object({generation:z.uuid().optional(),operationId:z.uuid(),organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),type:z.literal('sales.import'),source:posCode,locationId:recordId,currency:z.literal('EGP'),reference:recordName,completedSalesOnly:z.literal(true),capturedAt:z.iso.datetime(),schemaVersion:z.literal(1),file:z.object({name:z.string().trim().min(1).max(200),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).optional(),lines:z.array(salesLineSchema).min(1).max(200)}).superRefine((d,ctx)=>{
 if(new Set([d.operationId,...d.lines.map(l=>l.lineId)]).size!==d.lines.length+1||new Set(d.lines.map(l=>JSON.stringify([l.businessDate,l.transactionId,l.lineKey]))).size!==d.lines.length)ctx.addIssue({code:'custom',message:'معرّفات الاستيراد وتفاصيل المبيعات لا تتكرر'});
});
export type SalesLine=z.infer<typeof salesLineSchema>;
export type SalesImportDocument=z.infer<typeof salesImportSchema>;
export type SalesStockDeduction={movementId:string;itemId:string;businessDate:string;quantity:string;amount:string};
export type SalesStockShortage={itemId:string;businessDate:string;requiredQuantity:string;deductedQuantity:string;shortageQuantity:string};
export type ImportedSales={document:SalesImportDocument;acceptedLineIds:string[];duplicateLineIds:string[];netAmount:string;postedAt:string;stockDeductions?:SalesStockDeduction[];stockDeductionAmount?:string;stockShortages?:SalesStockShortage[]};
