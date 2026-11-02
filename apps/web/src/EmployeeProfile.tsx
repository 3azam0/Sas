'use client';
import {useRef,useState,type FormEvent} from 'react';
import type {Employee,HrData} from '../../../packages/contracts/hr';
import EmployeePay from './EmployeePay';

export default function EmployeeProfile({employee:e,data,busy,error,change,save,close,addJob,saveDetails}:{employee:Employee;data:HrData;busy:boolean;error:string;change:(e:Employee)=>void;save:(event:FormEvent)=>Promise<void>;close:()=>void;addJob:(jobId:string,name:string)=>Promise<boolean>;saveDetails:(body:Record<string,unknown>)=>Promise<boolean>}){
 const [section,setSection]=useState<'personal'|'salary'|'advances'>('personal');
 const [addingJob,setAddingJob]=useState(false),[newJob,setNewJob]=useState(''),jobId=useRef(crypto.randomUUID());
 const jobs=data.jobs,hasCurrent=jobs.some(j=>j.name===e.jobTitle);
 async function createJob(){const name=newJob.trim();if(!name)return;if(await addJob(jobId.current,name)){change({...e,jobTitle:name});setAddingJob(false);setNewJob('');jobId.current=crypto.randomUUID();}}
 return <section className="panel hr-workspace" aria-label="ملف الموظف"><div className="panel-heading"><div><h2>{e.revision?e.name:'إضافة موظف'}</h2><p>ملف الموظف · الكود {e.badge}</p></div><button disabled={busy} onClick={close}>العودة إلى ملفات الموظفين</button></div>
  {error&&<p role="alert" className="alert error">{error}</p>}
  <div className="hr-tabs" role="group" aria-label="أقسام ملف الموظف">{(['personal','salary','advances'] as const).map((key,i)=><button key={key} disabled={busy} aria-pressed={section===key} onClick={()=>setSection(key)}>{['البيانات الشخصية','الراتب','السلف'][i]}</button>)}</div>
  {section!=='personal'&&(e.revision?<EmployeePay key={e.employeeId+section} employeeId={e.employeeId} data={data} busy={busy} save={saveDetails} section={section}/>:<p>احفظ ملف الموظف أولاً لإضافة الراتب والسلف.</p>)}
  {section==='personal'&&<div className="hr-editor"><form onSubmit={save}><fieldset disabled={busy}><div className="hr-fields">
   <label>جهاز البصمة<select required disabled={e.revision>0} value={e.deviceId} onChange={v=>change({...e,deviceId:v.target.value})}>{data.devices.map(d=><option key={d.deviceId} value={d.deviceId}>{d.name}</option>)}</select></label>
   <label>كود الموظف<input required pattern="[A-Za-z0-9_-]{1,24}" maxLength={24} disabled={e.revision>0} value={e.badge} onChange={v=>change({...e,badge:v.target.value})}/></label>
   <label>الكود على جهاز البصمة<input readOnly value={e.badge} dir="ltr"/></label>
   {(['name','phone','department'] as const).map((key,i)=><label key={key}>{['الاسم الكامل','الهاتف','القسم'][i]}<input required={key==='name'} maxLength={key==='name'?160:key==='phone'?40:100} value={e[key]} onChange={v=>change({...e,[key]:v.target.value})}/></label>)}
   <label>المسمى الوظيفي<select aria-label="المسمى الوظيفي" value={addingJob?'__add_job__':e.jobTitle} onChange={v=>{if(v.target.value==='__add_job__')setAddingJob(true);else{setAddingJob(false);change({...e,jobTitle:v.target.value});}}}><option value="">دون مسمى وظيفي</option>{e.jobTitle&&!hasCurrent&&<option value={e.jobTitle}>{e.jobTitle}</option>}{jobs.map(j=><option key={j.jobId} value={j.name}>{j.name}</option>)}<option value="__add_job__">+ إضافة مسمى وظيفي</option></select></label>
   {addingJob&&<div className="hr-new-job"><label>المسمى الجديد<input maxLength={100} value={newJob} onChange={v=>setNewJob(v.target.value)} onKeyDown={v=>{if(v.key==='Enter'){v.preventDefault();void createJob();}}}/></label><button type="button" disabled={!newJob.trim()} onClick={()=>void createJob()}>إضافة المسمى</button><button type="button" onClick={()=>setAddingJob(false)}>إلغاء الإضافة</button></div>}
   <label>تاريخ التعيين<input type="date" value={e.hireDate??''} onChange={v=>change({...e,hireDate:v.target.value||null})}/></label><label>الحالة<select value={e.active?'active':'inactive'} onChange={v=>change({...e,active:v.target.value==='active'})}><option value="active">نشط</option><option value="inactive">غير نشط</option></select></label><label>ملاحظات<textarea maxLength={1000} value={e.notes} onChange={v=>change({...e,notes:v.target.value})}/></label>
  </div>{e.deviceName&&<p>الاسم على الجهاز: {e.deviceName}</p>}<p>كود الموظف هو نفسه الكود على جهاز البصمة. تعديل الملف لا يغير الجهاز الفعلي.</p><div className="hr-toolbar"><button className="primary" disabled={addingJob}>حفظ الملف</button><button type="button" onClick={close}>إلغاء</button></div></fieldset></form></div>}
 </section>;
}
