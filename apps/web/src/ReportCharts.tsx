'use client';
import CollapsibleSection,{CollapsibleChart} from './CollapsibleSection';
import {ResponsiveContainer,BarChart,Bar,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,Legend} from 'recharts';
import type {ReportRank,ReportDay} from '@saas/contracts';
const n=(v:number|string,digits=2)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:digits}).format(Number(v));
export function RankChart({title,rows,color='#df4b20',unit='ج.م',choose}:{title:string;rows:ReportRank[];color?:string;unit?:string;choose:(row:ReportRank)=>void}){
 const plotted=rows.map(r=>({...r,amount:Number(r.value)}));
 return <CollapsibleSection className="panel bi-chart"><div className="panel-heading"><div><h2>{title}</h2><p>{unit} · اختر من الرسم أو القائمة لعرض التفاصيل</p></div></div>
 {rows.length?<><CollapsibleChart className="bi-chart-canvas" dir="ltr" role="img" aria-label={title+' · '+unit}>
 <ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={plotted} layout="vertical" margin={{top:8,right:24,left:8,bottom:8}} accessibilityLayer>
 <CartesianGrid stroke="#edf0f4" horizontal={false}/><XAxis type="number" tickFormatter={v=>n(v,unit==='ج.م'?2:6)} fontSize={10}/><YAxis dataKey="label" type="category" width={116} tickFormatter={v=>String(v).length>18?String(v).slice(0,17)+'…':v} fontSize={11} tickLine={false} axisLine={false}/>
 <Tooltip formatter={v=>[n(Number(v),unit==='ج.م'?2:6)+' '+unit,unit==='ج.م'?'القيمة':'الكمية']} contentStyle={{direction:'rtl',borderRadius:12,borderColor:'#e5e9ef'}}/>
 <Bar dataKey="amount" fill={color} radius={[0,5,5,0]} maxBarSize={25} isAnimationActive={false} onClick={(_,index)=>choose(rows[index])}/>
 </BarChart></ResponsiveContainer></CollapsibleChart>
 <div className="bi-chart-choices">{rows.map(r=><button type="button" key={r.key} onClick={()=>choose(r)}><span>{r.label}</span><strong>{n(r.value,unit==='ج.م'?2:6)} <small>{unit}</small></strong></button>)}</div></>:<div className="bi-empty">لا توجد قيم لعرضها مع الفلاتر الحالية.</div>}
 </CollapsibleSection>;
}
export function TrendChart({rows,choose}:{rows:ReportDay[];choose:(date:string)=>void}){
 const plotted=rows.map(r=>({...r,received:Number(r.received),kitchen:Number(r.kitchen),waste:Number(r.waste),sales:Number(r.sales)}));
 return <CollapsibleSection className="panel bi-chart bi-trend"><div className="panel-heading"><div><h2>اتجاه النشاط اليومي</h2><p>ج.م · قيم منفصلة لكل نشاط خلال الفترة</p></div></div><CollapsibleChart className="bi-chart-canvas" dir="ltr" role="img" aria-label="المبيعات وصافي الاستلام وصرف المطابخ والهالك يومياً بالجنيه المصري">
 <ResponsiveContainer width="100%" height="100%" minWidth={0}><LineChart data={plotted} margin={{top:8,right:12,left:4,bottom:8}} accessibilityLayer onClick={state=>{if(state.activeLabel)choose(String(state.activeLabel));}}>
 <CartesianGrid stroke="#edf0f4" vertical={false}/><XAxis dataKey="date" minTickGap={25} fontSize={10} tickFormatter={v=>String(v).slice(5)} tickLine={false}/><YAxis fontSize={10} tickFormatter={v=>n(v)} width={66} tickLine={false}/>
 <Tooltip labelFormatter={v=>String(v)} formatter={(v,name)=>[n(Number(v))+' ج.م',name]} contentStyle={{direction:'rtl',borderRadius:12,borderColor:'#e5e9ef'}}/><Legend wrapperStyle={{direction:'rtl',fontSize:11}}/>
 <Line name="المبيعات" type="monotone" dataKey="sales" stroke="#e24c24" strokeWidth={2.5} dot={false} isAnimationActive={false}/><Line name="صافي الاستلام" dataKey="received" stroke="#15846e" strokeWidth={2} dot={false} isAnimationActive={false}/><Line name="صرف المطابخ" dataKey="kitchen" stroke="#173859" strokeWidth={2} dot={false} isAnimationActive={false}/><Line name="الهالك" dataKey="waste" stroke="#b34b70" strokeWidth={2} dot={false} isAnimationActive={false}/>
 </LineChart></ResponsiveContainer></CollapsibleChart><p className="bi-chart-hint">الاستلام يزيد المخزون؛ صرف المطابخ والهالك يمثلان حركات منفصلة. اختر يومًا من التفاصيل لتصفية التقرير.</p></CollapsibleSection>;
}
