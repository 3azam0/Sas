import type {ReportResponse} from '@saas/contracts';
/** The same accepted full-range metrics as the screen, keeping unknown estimates null. */
export function reportExportSummary(data:ReportResponse):unknown[][]{const c=data.current,kind=data.query.kind;let values:unknown[][]=[];
 if(kind==='inventory')values=[...(data.stock.asOf?[['الأرصدة حتى',data.stock.asOf]]:[]),[data.stock.asOf?'قيمة المخزون حتى تاريخ التقرير ج.م':'قيمة المخزون الحالية ج.م',data.stock.value],['عدد مواد المخزون',data.stock.items],['أرصدة تحت الحد الأدنى',data.stock.low]];
 else if(kind==='purchasing')values=[['قيمة الاستلام ج.م',c.received],['مرتجعات الموردين ج.م',c.returned],['عكس الاستلام ج.م',c.reversed],['صافي التوريد ج.م',c.netReceived]];
 else if(kind==='kitchenSupply')values=[['قيمة المستندات المسعرة فقط ج.م',c.kitchenDocumentAmount??null],['سطور غير مسعرة',c.kitchenDocumentUnpriced??null],['قيمة المخزون المحول ج.م',c.kitchenTransferOut??'0'],['عدد المستندات',c.kitchenSupplyDocuments??0]];
 else if(kind==='kitchens')values=[['قيمة الاستهلاك ج.م',c.kitchen],['المخزون المورد ج.م',c.kitchenTransferIn??'0'],['المخزون المحول ج.م',c.kitchenTransferOut??'0']];
 else if(kind==='waste')values=[['تكلفة الهالك ج.م',c.waste],['نقص الجرد ج.م',c.countDecrease],['زيادة الجرد ج.م',c.countIncrease]];
 else if(kind==='production')values=[['تكلفة المدخلات ج.م',c.productionInput],['تكلفة الهالك ج.م',c.productionWaste]];
 else if(kind==='sales'||kind==='finance')values=[['صافي المبيعات ج.م',c.sales],['تكلفة الوصفات التقديرية ج.م',c.estimatedSalesCost],['الهامش التقديري ج.م',c.estimatedMargin],['نسبة تكلفة الغذاء ٪',c.foodCostPercent],...(kind==='finance'?[['التصحيحات المالية ج.م',c.salesCorrections??'0'],['صافي المصروفات ج.م',c.netExpenses??'0'],['النتيجة التقديرية ج.م',c.estimatedOperatingResult??null]]:[])];
 else if(kind==='reconciliation'&&data.reconciliation){const r=data.reconciliation;values=[['مطابقات مكتملة',r.complete],['مطابقات غير مكتملة',r.incomplete],['مطابقات مقيمة',r.priced],['قيمة فرق الاستهلاك ج.م',r.priced||!data.total?r.varianceCost:null],['قيمة الاستهلاك الفعلي ج.م',r.priced||!data.total?r.actualCost:null]];}
 else if(kind==='overview')values=[['قيمة المخزون الحالية ج.م',data.stock.value],['قيمة الاستهلاك ج.م',c.kitchen],['تكلفة الهالك ج.م',c.waste],['صافي المبيعات ج.م',c.sales]];
 return values.length?[['إجماليات كامل النطاق المصفّى'],...values,['دلالة الفراغ','القيمة غير معلومة أو غير مكتملة؛ الصفر المعروف يبقى صفراً.']]:[];
}
