'use client';
import CollapsibleSection,{CollapsibleChart} from './CollapsibleSection';
import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,Legend} from 'recharts';
import type {ReportDay,ReportRow} from '@saas/contracts';
import Collection from './Collection';
const n=(v:string|number)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:6}).format(Number(v));
export function KitchenSupplyTrend({rows,choose}:{rows:ReportDay[];choose:(date:string)=>void}){
 const plotted=rows.map(r=>({...r,supply:Number(r.kitchenSupply??'0'),legacy:Number(r.kitchenLegacyIssue??'0')}));
 return <CollapsibleSection className="panel bi-chart"><div className="panel-heading"><div><h2>قيمة صرف المطابخ يومياً</h2><p>ج.م · التحويلات والاستهلاك السابق يظهران منفصلين</p></div></div><CollapsibleChart className="bi-chart-canvas" dir="ltr" role="img" aria-label="قيمة تحويل المخزون للمطابخ والاستهلاك السابق يومياً">
 <ResponsiveContainer width="100%" height="100%" minWidth={0}><LineChart data={plotted} accessibilityLayer margin={{top:8,right:12,left:4,bottom:8}} onClick={state=>{if(state.activeLabel)choose(String(state.activeLabel));}}>
 <CartesianGrid stroke="#edf0f4" vertical={false}/><XAxis dataKey="date" minTickGap={25} tickFormatter={v=>String(v).slice(5)} fontSize={10}/><YAxis width={66} tickFormatter={v=>n(v)} fontSize={10}/><Tooltip formatter={(v,name)=>[n(Number(v))+' ج.م',name]} contentStyle={{direction:'rtl',borderRadius:12}}/><Legend wrapperStyle={{direction:'rtl',fontSize:11}}/>
 <Line name="تحويل مخزون للمطابخ" dataKey="supply" stroke="#df4b20" strokeWidth={2.5} dot={false} isAnimationActive={false}/><Line name="استهلاك سابق" dataKey="legacy" stroke="#173859" strokeWidth={2} dot={false} isAnimationActive={false}/>
 </LineChart></ResponsiveContainer></CollapsibleChart><details className="bi-daily"><summary>عرض أرقام الصرف اليومية</summary><Collection rows={rows} title="صرف المطابخ اليومي" pageSize={10} dateValue={r=>r.date}>{page=><div className="table-scroll"><table><thead><tr><th>اليوم</th><th>تحويل مخزون للمطابخ</th><th>استهلاك سابق</th></tr></thead><tbody>{page.map(r=><tr key={r.date}><td><button type="button" className="text-button" onClick={()=>choose(r.date)}>{r.date}</button></td><td>{n(r.kitchenSupply??'0')} ج.م</td><td>{n(r.kitchenLegacyIssue??'0')} ج.م</td></tr>)}</tbody></table></div>}</Collection></details></CollapsibleSection>;
}
export function KitchenSupplyTable({rows,chooseDate}:{rows:ReportRow[];chooseDate:(date:string)=>void}){
 return <table><thead><tr><th>المادة</th><th>التاريخ / الحركة</th><th>رقم المستند / المرجع</th><th>المخزن المصدر</th><th>المطبخ المستلم</th><th>الكمية</th><th>تكلفة الوحدة الفعلية</th><th>القيمة</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><strong>{r.name}</strong><small dir="ltr">{r.sku}</small><small>{r.category}</small></td><td><button type="button" className="text-button" onClick={()=>chooseDate(r.date)}>{r.date}</button><small>{r.type==='kitchen.transfer.out'?'تحويل مخزون':'استهلاك سابق'}</small></td><td><bdi className="kitchen-number">{'KI-'+(r.documentId??r.id).toUpperCase()}</bdi><small>{r.reference||'—'}</small></td><td>{r.locationName}</td><td>{r.kitchenName||'—'}</td><td dir="ltr">{n(r.quantity)} <small>{r.unit}</small></td><td>{r.unitCost===null?'—':n(r.unitCost)} <small>ج.م / {r.unit}</small></td><td>{n(r.amount)} ج.م</td></tr>)}</tbody></table>;
}
