'use client';
import type {ReactNode} from 'react';
import type {ReportResponse,Snapshot} from '@saas/contracts';
import PrintPreview,{PrintHeader,PrintTable} from './PrintPreview';
import type {PrintPaper} from './printing';
import {RankChart,TrendChart} from './ReportCharts';
import {KitchenSupplyTrend} from './KitchenSupplyCharts';

const n=(v:string|number|null|undefined,digits=4)=>v==null?'—':new Intl.NumberFormat('ar-EG',{maximumFractionDigits:digits}).format(Number(v));
const money=(v:string|null|undefined)=>v==null?'غير مكتمل':n(v,2)+' ج.م';
const movement:Record<string,string>={'receipt.post':'استلام','purchase.receive':'استلام شراء','purchase.reverse':'عكس استلام','purchase.return':'مرتجع مورد','waste.post':'هالك','kitchen.issue':'استهلاك مطبخ سابق','kitchen.transfer.in':'توريد مخزون للمطبخ','kitchen.transfer.out':'تحويل إلى مطبخ','sales.issue':'خصم مبيعات','count.adjust':'تسوية جرد','production.input':'مدخل إنتاج','production.output':'ناتج إنتاج','transfer.dispatch':'إرسال تحويل','transfer.receive':'استلام تحويل',opening:'رصيد افتتاحي','opening.post':'رصيد افتتاحي','sales.correct':'مرتجع / إلغاء بيع','expense.post':'مصروف تشغيل','expense.reverse':'عكس مصروف',balance:'رصيد حالي',sale:'بيع',production:'دفعة تحضير'};

export default function ReportPrint({snapshot,data,title,cached,close}:{snapshot:Snapshot;data:ReportResponse;title:string;cached:boolean;close:()=>void}){
 return <PrintPreview title={'طباعة '+title} orientation="landscape" close={close}>{paper=><ReportPrintSheet snapshot={snapshot} data={data} title={title} paper={paper} cached={cached}/>}</PrintPreview>;
}
export function ReportPrintSheet({snapshot,data,title,paper,cached=false}:{snapshot:Snapshot;data:ReportResponse;title:string;paper:PrintPaper;cached?:boolean}){
 const q=data.query,c=data.current,kind=q.kind,recon=data.reconciliation;
 const metrics:[string,string][]=[];
 const add=(label:string,value:string|null|undefined)=>metrics.push([label,money(value)]);
 if(kind==='inventory'){add('قيمة المخزون الحالية',data.stock.value);metrics.push(['مواد المخزون',n(data.stock.items)],['أرصدة تحت الحد الأدنى',n(data.stock.low)]);}
 else if(kind==='reconciliation'&&recon){metrics.push(['مطابقات مكتملة',n(recon.complete)],['مطابقات غير مكتملة',n(recon.incomplete)]);add('فرق الاستهلاك المقيّم',recon.priced||!data.total?recon.varianceCost:null);add('الاستهلاك الفعلي المقيّم',recon.priced||!data.total?recon.actualCost:null);}
 else if(kind==='kitchenSupply'){add('قيمة المخزون المحوّل للمطابخ',c.kitchenTransferOut??'0');add('استهلاك سابق من مستندات الصرف',c.kitchenLegacyIssue??'0');metrics.push(['مستندات الصرف',n(c.kitchenSupplyDocuments??0)],['المواد المصروفة',n(c.kitchenSupplyItems??0)]);}
 else if(kind==='kitchens'){add('استهلاك المطابخ',c.kitchen);add('المخزون المورّد للمطابخ',c.kitchenTransferIn??'0');add('المخزون المحوّل من الموقع',c.kitchenTransferOut??'0');}
 else if(kind==='purchasing'){add('قيمة الاستلام',c.received);add('مرتجعات الموردين',c.returned);add('عكس الاستلام',c.reversed);add('صافي قيمة التوريد',c.netReceived);}
 else if(kind==='waste'){add('تكلفة الهالك',c.waste);add('نقص تسويات الجرد',c.countDecrease);add('زيادة تسويات الجرد',c.countIncrease);}
 else if(kind==='production'){add('تكلفة مدخلات التحضير',c.productionInput);add('هالك التحضير',c.productionWaste);}
 else if(kind==='sales'||kind==='finance'){add('صافي المبيعات',c.sales);add('تكلفة الوصفات التقديرية',c.estimatedSalesCost);if(kind==='finance'){add('مرتجعات وإلغاءات المبيعات',c.salesCorrections??'0');add('صافي مصروفات التشغيل',c.netExpenses??'0');add('النتيجة التقديرية بعد المصروفات',c.estimatedOperatingResult);}else{add('الهامش التقديري',c.estimatedMargin);metrics.push(['نسبة تكلفة الغذاء التقديرية',c.foodCostPercent===null?(c.estimatedSalesCost===null?'غير مكتمل':'—'):n(c.foodCostPercent,2)+'٪']);add('خصم المكونات المحددة فعلياً',c.salesDeduction);}}
 else{add('قيمة المخزون الحالية',data.stock.value);add('استهلاك المطابخ',c.kitchen);add('تكلفة الهالك',c.waste);add('صافي المبيعات',c.sales);}
 const filters=[q.category&&'الفئة: '+q.category,q.itemId&&'الصنف: '+(snapshot.items.find(i=>i.id===q.itemId)?.name??snapshot.menuItems?.find(i=>i.id===q.itemId)?.name??q.itemId),q.supplierId&&'المورد: '+(q.supplierId==='__none__'?'بدون مورد محدد':snapshot.suppliers?.find(s=>s.id===q.supplierId)?.name??q.supplierId),q.kitchenId&&'المطبخ: '+(snapshot.kitchens?.find(k=>k.id===q.kitchenId)?.name??q.kitchenId),q.posId&&'نقطة البيع: '+(snapshot.pointsOfSale?.find(p=>p.id===q.posId)?.name??q.posId),q.search&&'بحث: '+q.search].filter(Boolean);
 const rank=kind==='reconciliation'?recon?.ranks:kind==='finance'?data.charts.expenses:kind==='inventory'?data.charts.inventory:kind==='kitchens'?data.charts.kitchens:kind==='kitchenSupply'?data.charts.kitchenSupply:kind==='purchasing'?data.charts.suppliers:kind==='waste'?data.charts.waste:kind==='sales'?data.charts.sales:data.charts.production;
 let columns:string[],rows:{id:string;cells:ReactNode[]}[];
 if(kind==='reconciliation'){
  columns=['المادة / الموقع','الجرد الافتتاحي ← الختامي','النظري / الخصم المسجل','الفعلي من الجرد','فرق الاستهلاك','قيمة الفرق ج.م','حالة المطابقة'];
  rows=data.rows.map(r=>{const v=r.comparison;return {id:r.id,cells:[<><strong>{r.name}</strong><small>{r.locationName} · {r.unit} · {r.category}</small><small><bdi>{r.sku}</bdi></small></>,v?<>{n(v.opening)} ← {n(v.closing)}<small>تحويلات: {n(v.netSupply)} · هالك: {n(v.waste)} · تحضير: {n(v.productionInput)} · فرق جرد: {n(v.countDifference)}</small></>:'—',v?<>{n(v.theoretical)} / {n(v.recorded)}<small>مطلوب محدد: {n(v.selectedRequired)} · نقص: {n(v.shortage)}</small></>:'—',n(v?.actual),<>{n(v?.variance)}<small>{n(v?.variancePercent)}٪</small></>,<>{n(v?.varianceCost)}<small>تكلفة الوحدة: {n(r.unitCost)}</small></>,<>{v?.status==='complete'?'مطابقة مكتملة':'غير مكتمل'}{v?.issues.map(issue=><small key={issue}>{issue}</small>)}{r.unitCost===null&&<small>تكلفة المقارنة غير متاحة.</small>}</>]};});
 }else if(kind==='kitchenSupply'){
  columns=['المادة','التاريخ / الحركة','رقم المستند / المرجع','المخزن المصدر','المطبخ المستلم','الكمية','تكلفة الوحدة ج.م','القيمة ج.م'];
  rows=data.rows.map(r=>({id:r.id,cells:[<><strong>{r.name}</strong><small><bdi>{r.sku}</bdi> · {r.category}</small></>,<>{r.date}<small>{movement[r.type]??r.type}</small></>,<><bdi>{'KI-'+(r.documentId??r.id).toUpperCase()}</bdi><small>{r.reference||'—'}</small></>,r.locationName,r.kitchenName||'—',n(r.quantity,6)+' '+r.unit,n(r.unitCost,6),n(r.amount,2)]}));
 }else{
  columns=['الصنف',kind==='inventory'?'الفئة':'التاريخ / الحركة','الموقع','الكمية',kind==='sales'?'صافي البيع ج.م':kind==='production'?'تكلفة المدخلات ج.م':'القيمة ج.م',kind==='sales'?'تكلفة وصفة تقديرية ج.م':kind==='inventory'?'تكلفة الوحدة الفعلية ج.م':'المرجع / الطرف'];
  rows=data.rows.map(r=>({id:r.id,cells:[<><strong>{r.name}</strong><small><bdi>{r.sku}</bdi></small></>,kind==='inventory'?r.category:<>{r.date}<small>{movement[r.type]??r.type}</small></>,r.locationName,<>{n(r.quantity,6)} {r.unit}{kind==='production'&&<small>تحقيق الناتج: {n(r.extra)}٪ · تكلفة وحدة الناتج: {n(r.unitCost)} ج.م / {r.unit}</small>}</>,n(r.amount,2),kind==='inventory'?<>{n(r.unitCost,6)} / {r.unit}</>:kind==='sales'?money(r.estimatedCost):<>{r.reference||'—'}<small>{kind==='kitchens'?r.kitchenName:kind==='purchasing'?r.supplierName:''}</small></>]}));
 }
 return <><PrintHeader snapshot={snapshot} title={title}/><div className="document-print-meta"><p>الفترة: <bdi>{q.from} — {q.to}</bdi></p><p>الموقع: {q.locationId?snapshot.locations.find(l=>l.id===q.locationId)?.name??q.locationId:'كل مواقع المؤسسة'}</p><p>تحديث البيانات: {new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Cairo'}).format(new Date(data.generatedAt))}</p><p>{cached?'نسخة تقرير محفوظة':'تقرير من السجلات المقبولة'}</p></div>{filters.length>0&&<p className="document-print-note">{filters.join(' · ')}</p>}
 <h2 className="document-print-subtitle">إجماليات كامل النطاق المصفّى</h2><div className="document-print-metrics">{metrics.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
 {kind==='inventory'&&<p className="document-print-note">أرصدة حالية عند تحديث التقرير؛ الفترة لا تحوّلها إلى رصيد تاريخي.</p>}
 {kind==='kitchenSupply'&&<p className="document-print-note">التحويل يزيد مخزون المطبخ؛ لا يمثل استهلاكاً. يحتسب المستند مرة واحدة من المصدر.</p>}
 {kind==='purchasing'&&<p className="document-print-note">مرجع المورد للمرتجعات: {money(c.returnReference)}. قد يختلف عن تقييم المخزون؛ التقرير لا يمثل مدفوعات أو مديونية المورد.</p>}
 {(kind==='finance'||kind==='sales')&&<p className="document-print-note">الأرقام قبل ضريبة المبيعات. تكلفة الوصفات بأسعار المخزون عند تحديث التقرير، والنتيجة تقديرية وليست صافي ربح. التصحيحات المالية لا تعكس استهلاك الوصفات ولا تُرجع مكونات للمخزون. المشتريات والتحويلات ومدخلات التحضير والهالك لا تُخصم مرة ثانية من النتيجة التقديرية.</p>}
 {kind==='reconciliation'&&<><p className="document-print-note">الفعلي من الجرد والحركات؛ الفرق = الفعلي − النظري. القيم على أساس تكلفة الجرد الختامي، للمطابقات المكتملة المقيّمة فقط ({n(recon?.priced??0)} من {n(data.total)}). الفرق الموجب ليس بالضرورة هالكاً.</p>{recon?.issues.map(issue=><p className="document-print-warning" key={issue}>{issue}</p>)}</>}
 {paper==='a4'&&<div className="document-print-charts" aria-label="رسوم التقرير">{kind==='overview'?<TrendChart rows={data.charts.daily} choose={()=>{}}/>:kind==='kitchenSupply'?<KitchenSupplyTrend rows={data.charts.daily} choose={()=>{}}/>:null}{rank&&<RankChart title={kind==='reconciliation'?'أكبر فروق الاستهلاك بالقيمة — أساس تكلفة موحد':'أعلى المجموعات بالقيمة — '+title} rows={rank} choose={()=>{}}/>}</div>}
 <h2 className="document-print-subtitle">تفاصيل الصفحة الحالية فقط</h2><p className="document-print-note">صفحة {n(data.page,0)} من {n(Math.max(1,Math.ceil(data.total/q.pageSize)),0)} · السجلات {data.rows.length?n((data.page-1)*q.pageSize+1,0)+'–'+n((data.page-1)*q.pageSize+data.rows.length,0):'٠'} من {n(data.total,0)}. الإجماليات أعلاه تشمل كل الصفحات؛ اطبع كل صفحة مطلوبة أو صدّر CSV للتفاصيل الكاملة.</p>
 {rows.length?<PrintTable columns={columns} rows={rows}/>:<p>لا توجد سجلات مطابقة.</p>}
 {kind==='sales'&&!!data.shortages?.length&&<><h2 className="document-print-subtitle">نقص مواد المبيعات — الموقع والفترة بالكامل</h2><p className="document-print-note">دون تخصيص لصنف بيع منفرد. الاستلام اللاحق لا يسدد هذا النقص تلقائياً.</p><PrintTable columns={['المادة','الوحدة','المطلوب','المخصوم فعلياً','النقص المسجل']} rows={data.shortages.map(s=>({id:s.itemId,cells:[s.name,s.unit,n(s.required,6),n(s.deducted,6),n(s.missing,6)]}))}/></>}
 <footer className="document-print-footer">FooDo · {title} · صفحة تفاصيل {n(data.page,0)} · للاستخدام الإداري</footer></>;
}
