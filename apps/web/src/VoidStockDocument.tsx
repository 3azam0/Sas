'use client';
import {useState} from 'react';
import {DocumentEditor} from './DocumentForm';
import {FormInput,WorkflowForm} from './FormControls';

export default function VoidStockDocument({title,reference,close,confirm}:{title:string;reference:string;close:()=>void;confirm:(reason:string)=>Promise<void>}){
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(){
  setBusy(true);setError('');
  try{await confirm(reason.trim());}catch(e){setError(e instanceof Error&&e.name!=='ZodError'?e.message:'أدخل سبب الإلغاء وحاول مرة أخرى.');}finally{setBusy(false);}
 }
 return <DocumentEditor title={title} close={close} busy={busy} className="opening-editor">
  <WorkflowForm busy={busy} error={error} onSubmit={()=>void submit()} onEdit={()=>setError('')}>
   <p>{reference}</p>
   <p>سيُعكس أثر المستند على المخزون إذا كانت الحركات قابلة للعكس، ويبقى المستند في السجل بحالة ملغى.</p>
   <label><span className="form-label">سبب إلغاء المستند</span><FormInput autoFocus required minLength={2} maxLength={500} aria-label="سبب إلغاء المستند" value={reason} onChange={event=>setReason(event.target.value)}/></label>
   <div className="modal-actions"><button type="submit" className="primary" disabled={busy}>تأكيد إلغاء المستند</button><button type="button" className="secondary" disabled={busy} onClick={close}>رجوع</button></div>
  </WorkflowForm>
 </DocumentEditor>;
}
