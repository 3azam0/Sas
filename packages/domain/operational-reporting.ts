import type {ReportRow,StockCardSummary,ButcheryModeSummary} from '@saas/contracts';
export const stockCardNote='أرصدة كميات من الحركات المقبولة حسب التاريخ التجاري، مستقلة لكل مادة وموقع. البحث يصفّي السطور فقط ولا يغيّر الأرصدة. لا يعيد التقرير ترتيب FIFO أو تقييم المخزون تاريخياً؛ التحويلات قيد الطريق خارج أرصدة المواقع.';
export const butcheryReportNote='الفلاتر تخص المادة الخام؛ البحث في منتج ناتج يعرض الدفعة كاملة. مردود البقري = الناتج ÷ اللحم المستخدم. مردود الضأن = الناتج ÷ الوزن الحي، مع نسبة الذبيحة والتقطيع منفصلتين. النسب الإجمالية موزونة بالأوزان، والتكاليف هي القيم المقبولة وقت الترحيل وليست أسعار اليوم.';
export const butcheryModeLabel=(mode:'beef'|'lamb')=>mode==='beef'?'تقطيع بقري':'ذبح وتقطيع ضأن';
export function stockCardCsv(summary:StockCardSummary|undefined,rows:ReportRow[],typeLabel:(type:string)=>string){
 const result:unknown[][]=[[stockCardNote],['المادة',summary?.name??'','الكود',summary?.sku??''],['الموقع','الوحدة','رصيد افتتاح الفترة','وارد الفترة','صادر الفترة','رصيد إقفال الفترة']];
 for(const b of summary?.balances??[])result.push([b.locationName,b.unit,b.opening,b.incoming,b.outgoing,b.closing]);
 result.push([],['التاريخ','تسلسل الحركة','الموقع','المادة','الكود','الوحدة','الرصيد قبل الحركة','الوارد','الصادر','الرصيد بعد الحركة','القيمة المرحّلة ج.م','تكلفة الوحدة الفعلية ج.م','الحركة','رقم الحركة','المرجع']);
 for(const r of rows)result.push([r.date,r.stockCard?.sequence,r.locationName,r.name,r.sku,r.unit,r.stockCard?.before,r.stockCard?.incoming,r.stockCard?.outgoing,r.stockCard?.running,r.amount,r.unitCost,typeLabel(r.type),r.id,r.reference]);
 return result;
}
export function butcherySummaryCsv(rows:ButcheryModeSummary[]){
 return [['المسار','الدفعات','عدد الرؤوس','وزن المدخل كجم','وزن الذبيحة كجم','فاقد الذبح كجم','فاقد التقطيع كجم','الناتج كجم','تكلفة المدخل ج.م','تكلفة التجهيز ج.م','التكلفة الكلية ج.م','الناتج إلى المدخل ٪','الذبيحة إلى الحي ٪','مردود التقطيع ٪','متوسط تكلفة الناتج ج.م/كجم'],...rows.map(r=>[butcheryModeLabel(r.mode),r.batches,r.mode==='lamb'?r.headCount:'',r.inputWeight,r.mode==='lamb'?r.carcassWeight:'',r.slaughterLoss,r.cuttingLoss,r.outputWeight,r.inputCost,r.processingCost,r.totalCost,r.yieldPercent,r.carcassYieldPercent,r.cuttingYieldPercent,r.unitCost])];
}
export function butcheryCsv(summary:ButcheryModeSummary[],rows:ReportRow[]){
 const result:unknown[][]=[[butcheryReportNote],...butcherySummaryCsv(summary),[],['التاريخ','رقم الدفعة','المسار','الموقع','المادة الخام','الكود','المدخل كجم','الرؤوس','الذبيحة كجم','فاقد الذبح كجم','فاقد التقطيع كجم','الناتج كجم','المردود ٪','تكلفة المدخل ج.م','التجهيز ج.م','التكلفة الكلية ج.م','متوسط تكلفة الناتج ج.م/كجم','المرجع']];
 for(const r of rows){const b=r.butchery;if(b)result.push([r.date,r.id,butcheryModeLabel(b.mode),r.locationName,r.name,r.sku,b.inputWeight,b.headCount,b.carcassWeight,b.slaughterLoss,b.cuttingLoss,b.outputWeight,b.yieldPercent,b.inputCost,b.processingCost,r.amount,r.unitCost,r.reference]);}
 result.push([],['تفاصيل المنتجات — قيم موزعة على المنتجات وليست تكلفة إضافية'],['رقم الدفعة','المنتج','كود المنتج','الكمية كجم','نسبة التكلفة ٪','التكلفة المخصصة ج.م','تكلفة الوحدة ج.م/كجم']);
 for(const r of rows)for(const o of r.butchery?.outputs??[]){if(result.length>=10000)throw new Error('تفاصيل المنتجات تتجاوز ١٠٬٠٠٠ سطر. ضيّق الفترة أو الفلاتر.');result.push([r.id,o.name,o.sku,o.quantity,o.costShare,o.amount,o.unitCost]);}
 return result;
}
