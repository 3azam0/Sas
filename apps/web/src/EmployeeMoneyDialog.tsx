'use client';

import {useState} from 'react';
import type {Employee} from '../../../packages/contracts/hr';
import {advanceSchema,deductionSchema} from '../../../packages/contracts/hr-profile';
import {normalizeNumber} from '../../../packages/domain/opening-import';
import {egyptDate} from '../../../packages/domain/reporting';
import {DocumentEditor} from './DocumentForm';
import {FormInput,SearchableSelect,WorkflowForm} from './FormControls';

export type EmployeeMoneyAction='advance'|'deduction';
export type EmployeeMoneyCommand={type:'advance.issue';advance:ReturnType<typeof advanceSchema.parse>}|
 {type:'deduction.record';deduction:ReturnType<typeof deductionSchema.parse>};

export default function EmployeeMoneyDialog({kind,employees,fixedEmployeeId,save,close}:{
 kind:EmployeeMoneyAction;employees:Employee[];fixedEmployeeId?:string;
 save:(command:EmployeeMoneyCommand)=>Promise<void>;close:()=>void;
}){
 const [employeeId,setEmployeeId]=useState(fixedEmployeeId??'');
 const [amount,setAmount]=useState(''),[date,setDate]=useState(egyptDate),[reason,setReason]=useState('');
 const [entryId]=useState(()=>crypto.randomUUID());
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const deduction=kind==='deduction',employee=employees.find(e=>e.employeeId===employeeId);
 const amountLabel=deduction?'مبلغ الخصم':'مبلغ السلفة';
 const title=deduction?'خصم من الموظف':'تسجيل سلفة موظف';
 const options=[...employees].sort((a,b)=>Number(b.active)-Number(a.active)||a.badge.localeCompare(b.badge,'en',{numeric:true})||a.name.localeCompare(b.name,'ar'));
 async function submit(){
  const data={employeeId,amount};
  const record=deduction
   ?deductionSchema.safeParse({...data,deductionId:entryId,deductedOn:date,reason})
   :advanceSchema.safeParse({...data,advanceId:entryId,issuedOn:date,reference:'',notes:reason});
  if(!record.success||!employee||date>egyptDate()){setError('راجع الموظف والمبلغ والتاريخ قبل الحفظ.');return;}
  setBusy(true);setError('');
  try{
   const command:EmployeeMoneyCommand='deductionId' in record.data
    ?{type:'deduction.record',deduction:record.data}
    :{type:'advance.issue',advance:record.data};
   await save(command);
   close();
  }catch(error){setError(error instanceof Error?error.message:'تعذر حفظ العملية.');}
  finally{setBusy(false);}
 }
 return <DocumentEditor title={title} eyebrow="ملفات الموظفين" className="hr-money-dialog" busy={busy} close={close}>
  <WorkflowForm busy={busy} error={error} onEdit={()=>setError('')} documentCheck={()=>{
   if(!employee)return {message:'اختر الموظف من القائمة.',field:'الموظف'};
   if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(amount)||Number(amount)<=0)return {message:'أدخل مبلغًا موجبًا بخانتين عشريتين كحد أقصى.',field:amountLabel};
   if(deduction&&reason.trim().length<2)return {message:'اكتب سبب الخصم.',field:'سبب الخصم'};
  }} onSubmit={()=>void submit()}>
   <fieldset disabled={busy}>
    <div className="hr-fields">
     {fixedEmployeeId?<div className="hr-selected-employee hr-span-all"><span>الموظف</span><strong>{employee?.name}</strong><small>كود {employee?.badge}</small></div>
     :<label className="hr-span-all">الموظف<SearchableSelect aria-label="الموظف" autoFocus required value={employeeId} onChange={event=>setEmployeeId(event.target.value)}>
      <option value="">اختر موظفًا</option>
      {options.map(e=><option key={e.employeeId} value={e.employeeId}>{e.name} · {e.badge}{e.department?' · '+e.department:''}{e.active?'':' · غير نشط'}</option>)}
     </SearchableSelect></label>}
     <label>{amountLabel} (ج.م)<FormInput aria-label={amountLabel} autoFocus={!!fixedEmployeeId} inputMode="decimal" dir="ltr" required placeholder="0.00" value={amount} onChange={event=>setAmount(normalizeNumber(event.target.value))}/></label>
     <label>{deduction?'تاريخ الخصم':'تاريخ السلفة'}<FormInput type="date" required max={egyptDate()} value={date} onChange={event=>setDate(event.target.value)}/></label>
     <label className="hr-span-all">{deduction?'سبب الخصم':'ملاحظات (اختياري)'}<textarea required={deduction} minLength={deduction?2:undefined} maxLength={deduction?500:1000} value={reason} onChange={event=>setReason(event.target.value)}/></label>
    </div>
    <div className="modal-actions"><button className="primary" type="submit">{busy?'جارٍ الحفظ…':deduction?'حفظ الخصم':'تسجيل السلفة'}</button><button type="button" className="secondary" onClick={close}>رجوع</button></div>
   </fieldset>
  </WorkflowForm>
 </DocumentEditor>;
}
