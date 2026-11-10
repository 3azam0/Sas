'use client';

import {useEffect,useState} from 'react';
import type {DailyAttendanceData,DailyAttendanceRow,Employee,HrData} from '../../../packages/contracts/hr';
import {cairoWall,DAILY_CHECKOUT_END} from '../../../packages/domain/attendance';
import {salaryAdjustments,salaryAmounts,salaryPeriods} from '../../../packages/domain/hr-salary';
import {formatMoney} from './money-format';

export default function EmployeeSalaryPreview({employee,data,request}:{
 employee:Employee;
 data:HrData;
 request:(body:Record<string,unknown>)=>Promise<unknown>;
}){
 const now=cairoWall(new Date()),today=now.slice(0,10),currentMonth=today.slice(0,7);
 const [month,setMonth]=useState(currentMonth),[refresh,setRefresh]=useState(0);
 const [result,setResult]=useState<{key:string;days:DailyAttendanceRow[];error?:string}|null>(null);
 const valid=/^\d{4}-(0[1-9]|1[0-2])$/.test(month)&&month>='1900-01'&&month<=currentMonth;
 const periods=salaryPeriods(valid?month:currentMonth),monthEnd=periods[2].to;
 const from=periods[0].from,to=today<monthEnd?today:monthEnd;
 const {employeeId,deviceId,badge,hireDate}=employee;
 const key=JSON.stringify([employeeId,deviceId,badge,from,to,refresh]);
 useEffect(()=>{
  if(!valid)return;
  let ignore=false;
  void request({type:'attendance.daily',policy:'daytime-12h-v1',from,to,page:0,deviceId,badge}).then(response=>{
   const {days}=response as DailyAttendanceData;
   if(!ignore)setResult({key,days:days.filter(row=>row.employeeId===employeeId)});
  }).catch(error=>{
   if(!ignore)setResult({key,days:[],error:error instanceof Error?error.message:'تعذر تحميل الحضور.'});
  });
  return ()=>{ignore=true;};
 },[request,valid,key,from,to,deviceId,badge,employeeId]);
 const loaded=valid&&result?.key===key?result:null;
 const days=loaded?.days.filter(row=>!hireDate||row.date>=hireDate)??[];
 const worked=days.filter(day=>day.first&&day.last);
 const review=days.filter(day=>!day.first||!day.last);
 const counts=periods.map(period=>worked.filter(day=>day.date>=period.from&&day.date<=period.to).length) as [number,number,number];
 const salary=data.salaries.find(item=>item.employeeId===employeeId);
 const hasSalaryForPeriod=salary&&salary.effectiveFrom<=to&&worked.every(day=>day.date>=salary.effectiveFrom);
 const adjustments=salaryAdjustments(data,employeeId,month,today);
 const amounts=loaded&&!loaded.error&&hasSalaryForPeriod?salaryAmounts(salary.basePay,counts,adjustments):null;
 const closed=periods.map((period,index)=>now>(index===2?period.payOn.slice(0,7)+'-01':period.payOn)+'T'+DAILY_CHECKOUT_END);
 const money=(value:string)=><bdi>{formatMoney(value)}</bdi>;

 return <section className="hr-editor hr-salary-preview" aria-label="معاينة دفعات الراتب">
  <div className="hr-section-heading">
   <div><h3>معاينة دفعات الراتب</h3><p>يوم ١٥ ويوم ٢٥ يُحسب ٨٠٪ من أجر الأيام الجديدة. يُصرف رصيد الإقفال يوم ٥ من الشهر التالي.</p></div>
   <button type="button" disabled={!valid||!loaded} onClick={()=>setRefresh(refresh+1)}>تحديث الحضور</button>
  </div>
  <div className="hr-fields"><label>شهر الاستحقاق<input type="month" min="1900-01" max={currentMonth} value={month} onChange={event=>setMonth(event.target.value)}/></label></div>
  <p className="hr-preview-date">أجر اليوم = الراتب الأساسي ÷ ٣٠. تُحسب أيام الدخول والخروج المكتملة حتى يوم ٣٠ أو نهاية الشهر الأقصر.</p>
  {!valid&&<p role="status">اختر شهر استحقاق صالحًا حتى الشهر الحالي.</p>}
  {valid&&!loaded&&<p role="status">جارٍ تحميل حضور الموظف…</p>}
  {loaded?.error&&<p className="alert error" role="alert">{loaded.error}</p>}
  {loaded&&!loaded.error&&<>
   {!salary&&<p role="status">احفظ الراتب الأساسي لعرض مبالغ الدفعات.</p>}
   {salary&&!hasSalaryForPeriod&&<p role="status">تاريخ سريان الراتب المحفوظ لا يغطي أيام العمل في هذه الفترة. راجع بيانات الراتب.</p>}
   {amounts&&<p className="hr-preview-date">أجر اليوم {money(amounts.daily)} ج.م · إجمالي أجر الأيام حتى الآن {money(amounts.gross)} ج.م</p>}
   <div className="hr-table hr-payroll-table" tabIndex={0} role="region" aria-label="جدول دفعات الراتب">
    <table><thead><tr><th>الدفعة</th><th>فترة الأيام الجديدة</th><th>أيام مكتملة</th><th>موعد الصرف</th><th>المبلغ (ج.م)</th></tr></thead>
    <tbody>{periods.map((period,index)=><tr key={period.payOn}>
     <td>{['دفعة ٨٠٪','دفعة ٨٠٪','إقفال الشهر'][index]}{!closed[index]&&<small className="setup-subline">حتى الآن</small>}</td>
     <td><bdi>{period.from}</bdi> – <bdi>{period.to}</bdi></td>
     <td>{counts[index]}</td><td><bdi>{period.payOn}</bdi></td>
     <td><strong>{amounts?money(amounts.payments[index]):'—'}</strong></td>
    </tr>)}</tbody></table>
   </div>
   {review.length>0&&<details className="hr-payroll-review"><summary>{review.length} يوم ببصمات تحتاج مراجعة</summary><ul>{review.map(day=><li key={day.date}><bdi>{day.date}</bdi> · {day.first?'خروج غير مكتمل':'دخول غير مكتمل'}</li>)}</ul></details>}
   {amounts&&<div className="hr-payroll-closing">
    <strong>تفاصيل إقفال الشهر</strong>
    <p>المتبقي بعد الدفعتين {money(amounts.closing)} ج.م · خصومات الشهر {money(adjustments.deductions)} ج.م · رصيد السلف {money(adjustments.advances)} ج.م</p>
    {Number(amounts.outstanding)>0&&<p>فرق يتبقى للتسوية {money(amounts.outstanding)} ج.م</p>}
   </div>}
  </>}
  <p>هذه معاينة للحساب على أساس الدفعتين المحسوبتين. تسجيل الصرف وسداد السلف يتم حسب التنفيذ الفعلي.</p>
 </section>;
}
