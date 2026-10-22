import {BusinessError,menuItemSchema,salesLineSchema,type MenuItem,type SalesLine,type SalesImportDocument,type Snapshot} from '@saas/contracts';
import {decimal} from './index';
import {normalizeNumber,parseOpeningCSV} from './opening-import';
import {salesStockOptions} from './recipes';
export const salesCSV=parseOpeningCSV;
export type SalesCSVMapping={transactionId:number;lineKey:number;code:number;businessDate:number;quantity:number;netAmount:number;status:number};
export const salesSourceKey=(source:string,posId?:string,channel?:'foodo')=>channel==='foodo'?JSON.stringify(['foodo',posId,source]):posId?JSON.stringify(['pos',posId,source]):source;
export const saleKey=(source:string,locationId:string,l:Pick<SalesLine,'businessDate'|'transactionId'|'lineKey'>,posId?:string,channel?:'foodo')=>JSON.stringify([salesSourceKey(source,posId,channel),posId?'':locationId,l.businessDate,l.transactionId,l.lineKey]);
export const salePayload=(l:SalesLine)=>JSON.stringify([l.menuItemId,l.mappingRevision,l.versionId,decimal(l.outputPerSale).toFixed(6),decimal(l.quantity).toFixed(6),decimal(l.netAmount).toFixed(6)]);
function acceptedSales(snapshot:Pick<Snapshot,'salesImports'>){const known=new Map<string,SalesLine>();for(const p of snapshot.salesImports??[])for(const l of p.document.lines)if(p.acceptedLineIds.includes(l.lineId))known.set(saleKey(p.document.source,p.document.locationId,l,p.document.posId,p.document.checkout?.channel),l);return known;}
export function validateMenu(snapshot:Pick<Snapshot,'recipeVersions'|'kitchens'>,item:MenuItem|ReturnType<typeof menuItemSchema.parse>){if(!snapshot.recipeVersions?.some(v=>v.versionId===item.versionId))throw new BusinessError('INVALID_RECIPE','اختر إصدار وصفة منشوراً لهذه المؤسسة.');if(item.active&&item.kitchenIds&&item.kitchenIds.length===0)throw new BusinessError('KITCHEN_REQUIRED','حدد مطبخاً واحداً على الأقل للصنف النشط.');if(item.kitchenIds?.some(id=>!snapshot.kitchens?.some(k=>k.id===id&&k.locationId)))throw new BusinessError('INVALID_KITCHEN','اختر مطابخ مخزون لهذه المؤسسة.');}
export function validateSale(snapshot:Pick<Snapshot,'recipeVersions'|'menuItems'>,source:string,line:SalesLine,active=true,kitchenId?:string){
 const menu=snapshot.menuItems?.find(m=>m.id===line.menuItemId&&m.source===source);if(!menu||active&&!menu.active)throw new BusinessError('INVALID_MENU','صنف البيع غير متاح أو غير نشط لهذا المصدر.');
 if(active&&(menu.revision!==line.mappingRevision||menu.versionId!==line.versionId||menu.code!==line.menuCode||menu.name!==line.menuName||!decimal(menu.outputPerSale).eq(line.outputPerSale)))throw new BusinessError('REVISION_CONFLICT','تغير ربط صنف البيع؛ افتح معاينة جديدة أو صحّح الاستيراد.');
 if(active&&kitchenId&&!menu.kitchenIds?.includes(kitchenId))throw new BusinessError('MENU_NOT_AVAILABLE','صنف البيع غير متاح في مطبخ نقطة البيع. راجع المطابخ المسموح بها للصنف.');
 const version=snapshot.recipeVersions?.find(v=>v.versionId===line.versionId);if(!version||version.definition.effectiveDate>line.businessDate)throw new BusinessError('INVALID_EFFECTIVE_DATE','إصدار الوصفة غير متاح أو لا يسري في تاريخ البيع.');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(line.businessDate>today)throw new BusinessError('FUTURE_DATE','تاريخ البيع لا يمكن أن يكون في المستقبل.');
}
export function mapSalesCSV(rows:string[][],mapping:SalesCSVMapping,snapshot:Snapshot,source:string,locationId='',posId?:string,kitchenId?:string){
 const fields=['transactionId','lineKey','code','businessDate','quantity','netAmount'] as const,cols=fields.map(k=>mapping[k]);
 if(cols.some(c=>!Number.isInteger(c)||c<0||c>=rows[0].length)||new Set(cols).size!==cols.length||!Number.isInteger(mapping.status)||mapping.status< -1||mapping.status>=rows[0].length||cols.includes(mapping.status))throw new Error('اختر عموداً مختلفاً لكل حقل.');
 const lines:SalesLine[]=[],errors:string[]=[],keys=new Set<string>(),known=acceptedSales(snapshot);
 for(const [i,row] of rows.slice(1).entries())try{
  if(row.length!==rows[0].length)throw new Error('عدد الأعمدة غير مطابق.');
  if(mapping.status>=0&&!['sale','completed','مكتمل'].includes(row[mapping.status].toLowerCase()))throw new Error('هذا الإصدار يقبل المبيعات المكتملة فقط؛ المرتجعات والإلغاءات غير مدعومة بعد.');
  const code=row[mapping.code].toUpperCase(),identity={transactionId:row[mapping.transactionId],lineKey:row[mapping.lineKey],businessDate:row[mapping.businessDate]},old=known.get(saleKey(source,locationId,identity,posId)),menu=snapshot.menuItems?.find(m=>m.source===source&&m.code===code&&m.active);
  if(old&&old.menuCode!==code)throw new Error('تفصيل بيع مقبول بكود مختلف؛ راجع الملف.');if(!old&&!menu)throw new Error('كود البيع غير مربوط أو غير نشط؛ أضفه في أصناف البيع.');
  const binding=old??{menuItemId:menu!.id,menuCode:menu!.code,menuName:menu!.name,mappingRevision:menu!.revision,versionId:menu!.versionId,outputPerSale:menu!.outputPerSale};
  const parsed=salesLineSchema.safeParse({...binding,...identity,lineId:crypto.randomUUID(),quantity:normalizeNumber(row[mapping.quantity]),netAmount:normalizeNumber(row[mapping.netAmount])});
  if(!parsed.success)throw new Error('راجع معرّفات البيع وتاريخ YYYY-MM-DD والكمية الموجبة والمبلغ غير السالب (حتى ٦ منازل).');validateSale(snapshot,source,parsed.data,!old,kitchenId);
  const key=saleKey(source,'',parsed.data);if(keys.has(key))throw new Error('تفصيل البيع مكرر داخل الملف.');keys.add(key);lines.push(parsed.data);
 }catch(e){errors.push(`السطر ${i+2}: ${e instanceof Error?e.message:'بيانات غير صالحة'}`);}
 return {lines,errors};
}
export function previewSales(snapshot:Pick<Snapshot,'salesImports'>,doc:SalesImportDocument){
 const known=acceptedSales(snapshot);
 const lines=doc.lines.map(l=>{const old=known.get(saleKey(doc.source,doc.locationId,l,doc.posId,doc.checkout?.channel));return {line:l,state:old?salePayload(old)===salePayload(l)?'duplicate' as const:'conflict' as const:'new' as const};});
 return {lines,newCount:lines.filter(l=>l.state==='new').length,duplicateCount:lines.filter(l=>l.state==='duplicate').length,conflictCount:lines.filter(l=>l.state==='conflict').length,netAmount:lines.filter(l=>l.state==='new').reduce((sum,l)=>sum.add(l.line.netAmount),decimal('0')).toFixed(6)};
}

export function salesStockRequirements(snapshot:Pick<Snapshot,'recipeVersions'>,lines:SalesLine[]){
 const totals=new Map<string,{itemId:string;businessDate:string;quantity:string}>();
 for(const sale of lines){
  const version=snapshot.recipeVersions?.find(v=>v.versionId===sale.versionId);if(!version)throw new BusinessError('INVALID_RECIPE','إصدار وصفة البيع غير متاح.');
  const d=version.definition,selected=new Set(d.salesStockItemIds??[]);if(!selected.size)continue;const options=salesStockOptions(version.recipeId,d,snapshot.recipeVersions??[]);
  if([...selected].some(id=>!options.some(r=>r.itemId===id)))throw new BusinessError('INVALID_SALES_STOCK','مواد خصم الإصدار لا تطابق مكوناته.');
  for(const r of options.filter(r=>selected.has(r.itemId))){
   const key=JSON.stringify([sale.businessDate,r.itemId]),old=totals.get(key),q=decimal(r.quantity).mul(sale.quantity).mul(sale.outputPerSale).div(d.outputQuantity);
   totals.set(key,{itemId:r.itemId,businessDate:sale.businessDate,quantity:decimal(old?.quantity??'0').add(q).toString()});
  }
 }
 // Aggregate first, then round once per material/day to the inventory's six places.
 return [...totals.values()].sort((a,b)=>a.businessDate.localeCompare(b.businessDate)||a.itemId.localeCompare(b.itemId)).map(r=>{
  const q=decimal(r.quantity).toDecimalPlaces(6);if(q.gt('999999999.999999'))throw new BusinessError('QUANTITY_TOO_LARGE','قسّم ملف البيع؛ كمية خصم المادة تتجاوز الحد.');
  return {...r,quantity:q.toFixed(6)};
 }).filter(r=>decimal(r.quantity).gt(0));
}


export function resolveSalesRouting(snapshot:Pick<Snapshot,'kitchens'|'pointsOfSale'|'locations'>,doc:Pick<SalesImportDocument,'posId'|'posRevision'|'kitchenId'|'source'|'locationId'>,active=true){
 if(!doc.posId){if(active&&(snapshot.pointsOfSale?.length||snapshot.kitchens?.some(k=>k.locationId)))throw new BusinessError('POS_REQUIRED','اختر نقطة البيع لتحديد مخزون المطبخ.');if(doc.posRevision||doc.kitchenId)throw new BusinessError('INVALID_POS','بيانات توجيه البيع غير مكتملة.');return undefined;}
 const pos=snapshot.pointsOfSale?.find(p=>p.id===doc.posId),kitchen=snapshot.kitchens?.find(k=>k.id===pos?.kitchenId);
 if(!pos||!kitchen?.locationId||pos.source!==doc.source||kitchen.id!==doc.kitchenId||kitchen.locationId!==doc.locationId)throw new BusinessError('INVALID_POS','نقطة البيع أو مخزون المطبخ لا يطابق بيانات الملف.');
 if(active&&(pos.revision!==doc.posRevision||!pos.active||!kitchen.active||!snapshot.locations.some(l=>l.id===kitchen.locationId&&l.active!==false)))throw new BusinessError('POS_CHANGED','تغيرت نقطة البيع أو المطبخ. افتح معاينة جديدة.');
 return {posId:pos.id,posName:pos.name,posRevision:pos.revision,kitchenId:kitchen.id,kitchenName:kitchen.name,locationId:kitchen.locationId};
}
