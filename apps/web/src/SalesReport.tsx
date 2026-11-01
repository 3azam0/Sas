import CollapsibleSection from './CollapsibleSection';
import {useState} from 'react';
import Collection,{amountSorts,syncStatusOptions} from './Collection';
import type {Snapshot} from '@saas/contracts';
import {salesReport} from '../../../packages/domain/sales-report';
import {FormInput,FormSelect} from './FormControls';
const num=(v:string,d=2)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:d}).format(Number(v));
export default function SalesReport({snapshot,location}:{snapshot:Snapshot;location:string}){
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[basis,setBasis]=useState<'stock_average'|'latest_receipt'>('stock_average');
 const r=salesReport(snapshot,location,from,to,basis),invalid=!!from&&!!to&&from>to;
 return <CollapsibleSection className="panel sales-report">
  <div className="panel-heading"><div><h2>الاستهلاك النظري وتكلفة المبيعات</h2><p>تقدير لجميع المكونات حسب المبيعات المقبولة وإصدار الوصفة المثبت لكل سطر.</p></div><span className="pill neutral">تقرير تقديري</span></div>
  <div className="report-controls"><label>من تاريخ<FormInput aria-label="من تاريخ" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>إلى تاريخ<FormInput aria-label="إلى تاريخ" type="date" min={from||undefined} value={to} onChange={e=>setTo(e.target.value)}/></label><label>أساس تقدير التكلفة<FormSelect aria-label="أساس تقدير التكلفة" value={basis} onChange={e=>setBasis(e.target.value as typeof basis)}><option value="stock_average">متوسط المخزون الحالي</option><option value="latest_receipt">آخر سعر استلام</option></FormSelect></label>{(from||to)&&<button type="button" className="text-button" onClick={()=>{setFrom('');setTo('');}}>كل الفترات</button>}</div>
  <p className="recipe-explanation">أسعار آخر مزامنة؛ يشمل التقرير جميع مكونات الوصفة، بما فيها المواد غير المحددة للخصم. التصحيحات المالية تخفض الإيراد بتاريخها دون تغيير كمية التحضير الأصلية. راجع الخصم الفعلي والنقص في سجل المبيعات.</p>
  {invalid?<p role="alert" className="error report-message">تاريخ البداية يجب ألا يأتي بعد النهاية.</p>:!r.count&&Number(r.netAmount)===0?<p className="empty">لا توجد مبيعات مقبولة لهذا الموقع والفترة.</p>:<>
   <div className="report-metrics recipe-metrics"><div><span>صافي المبيعات المقبولة</span><strong>{num(r.netAmount)} ج.م</strong><small>{num(String(r.count),0)} تفاصيل بيع</small></div><div><span>التكلفة التقديرية</span><strong>{r.estimatedCost===null?'غير مكتملة':num(r.estimatedCost)+' ج.م'}</strong><small>بأسعار {basis==='stock_average'?'المخزون الحالي':'آخر استلام'}</small></div><div><span>نسبة تكلفة الغذاء</span><strong>{r.foodCostPercent===null?'—':num(r.foodCostPercent)+'٪'}</strong><small>قبل مصروفات التشغيل</small></div></div>
   {!r.complete&&<p className="form-warning report-message">التكلفة غير مكتملة. إجمالي الأجزاء المسعّرة {num(r.knownSubtotal)} ج.م؛ أضف أسعار المواد الناقصة.</p>}
   {r.issues.map((s,i)=><p className="error report-message" key={i}>{s}</p>)}
   <Collection rows={(r.lines)??[]} title="مكونات الاستهلاك النظري" sorts={[...amountSorts<(typeof r.lines)[number]>("quantity","الكمية النظرية",l=>l.quantity),...amountSorts<(typeof r.lines)[number]>("amount","القيمة التقديرية",l=>l.amount),...amountSorts<(typeof r.lines)[number]>("cost","تكلفة الوحدة",l=>l.unitCost)]} resetKey={location} pageResetKey={from+to+basis} searchText={l=>l.name} filters={[{key:"price",label:"حالة السعر",value:l=>l.unitCost===null?"missing":"priced",options:[{value:"missing",label:"سعر غير متاح"},{value:"priced",label:"مسعر"}]}]}>{pageRows=>(<div className="table-scroll"><table><caption className="table-caption">المكونات النظرية · {num(String(r.lines.length),0)} مواد</caption><thead><tr><th>المادة</th><th>الكمية النظرية</th><th>تكلفة الوحدة (ج.م)</th><th>تاريخ أساس السعر</th><th>القيمة التقديرية (ج.م)</th></tr></thead><tbody>{pageRows.map(l=><tr key={l.itemId}><td><strong>{l.name}</strong></td><td>{num(l.quantity,6)} {l.unit}</td><td>{l.unitCost===null?<span className="pill warning">سعر غير متاح</span>:num(l.unitCost,6)}</td><td dir="ltr">{l.priceDate??'—'}</td><td>{l.amount===null?'—':num(l.amount)}</td></tr>)}</tbody></table></div>)}</Collection>
   <p className="recipe-version-note">هذا التقرير لا ينشئ حركة مخزون، ولا يمثل تكلفة تاريخية مرحّلة. العمليات المعلقة على الجهاز لا تدخل في الحساب.</p>
  </>}
 </CollapsibleSection>;
}
