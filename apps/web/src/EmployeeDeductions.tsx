'use client';

import {useState} from 'react';
import type {EmployeeDeduction} from '../../../packages/contracts/hr-profile';
import {decimal} from '@saas/domain';
import {egyptDate} from '../../../packages/domain/reporting';
import {formatMoney} from './money-format';

export default function EmployeeDeductions({entries,busy,add}:{entries:EmployeeDeduction[];busy:boolean;add:(trigger:HTMLButtonElement)=>void}){
 const [month,setMonth]=useState(()=>egyptDate().slice(0,7));
 const visible=entries.filter(entry=>!month||entry.deductedOn.startsWith(month+'-'));
 const total=visible.reduce((sum,entry)=>sum.add(entry.amount),decimal('0')).toFixed(2);
 return <section className="hr-editor hr-deductions" aria-label="خصومات الموظف">
  <div className="hr-section-heading"><div><h3>خصومات الموظف</h3><p>خصومات فردية مسجلة بتاريخ وسبب، منفصلة عن السلف والاستقطاعات الشهرية الثابتة.</p></div><button type="button" className="primary" disabled={busy} onClick={event=>add(event.currentTarget)}>خصم من الموظف</button></div>
  <div className="hr-deduction-filter">
   <label>شهر الخصم<input type="month" value={month} onChange={event=>setMonth(event.target.value)}/></label>
   {month&&<button type="button" onClick={()=>setMonth('')}>كل الشهور</button>}
   <div><span>إجمالي الخصومات{month?' في الشهر':''}</span><strong>{formatMoney(total)} ج.م</strong></div>
  </div>
  {visible.length?<div className="hr-table hr-deductions-table" tabIndex={0} role="region" aria-label="سجل خصومات الموظف"><table>
   <thead><tr><th>تاريخ الخصم</th><th>المبلغ</th><th>السبب</th></tr></thead>
   <tbody>{visible.map(entry=><tr key={entry.deductionId}><td data-label="تاريخ الخصم"><bdi>{entry.deductedOn}</bdi></td><td data-label="المبلغ"><strong>{formatMoney(entry.amount)} ج.م</strong></td><td data-label="السبب" className="hr-deduction-reason">{entry.reason}</td></tr>)}</tbody>
  </table></div>:<div className="hr-empty"><h4>{month?'لا توجد خصومات في الشهر المحدد':'لا توجد خصومات مسجلة'}</h4></div>}
 </section>;
}
