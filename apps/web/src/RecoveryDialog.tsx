'use client';
import {HelpButton} from './ClientGuide';
import {useEffect,useRef,useState} from 'react';
import {KeyboardForm,FormKeyboardHelp} from './FormControls';
import type {DemoProfile} from '@saas/contracts';
import {previewRecovery,restoreRecovery,type RecoveryPreview} from './offline';
export default function RecoveryDialog({scope,close,saved}:{scope:DemoProfile;close:()=>void;saved:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),fileInput=useRef<HTMLInputElement>(null);const [text,setText]=useState('');const [preview,setPreview]=useState<RecoveryPreview|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{dialog.current?.showModal();fileInput.current?.focus();},[]);
 useEffect(()=>{if(error&&!busy)fileInput.current?.focus();},[error,busy]);
 async function select(file?:File){setError('');setPreview(null);setText('');if(!file)return;setBusy(true);try{if(file.size>10*1024*1024)throw new Error('الحد الأقصى للملف ١٠ ميجابايت.');const content=await file.text();const result=await previewRecovery(content,scope);setText(content);setPreview(result);}catch(e){setError(e instanceof Error?e.message:'تعذر قراءة الملف');}finally{setBusy(false);}}
 async function restore(){setBusy(true);setError('');try{await restoreRecovery(text,scope);saved();}catch(e){setError(e instanceof Error?e.message:'تعذر الاسترداد');}finally{setBusy(false);}}
 return <dialog ref={dialog} className="modal" aria-labelledby="recovery-title" aria-describedby="recovery-description" aria-busy={busy} onCancel={e=>{e.preventDefault();if(!busy)close();}}>
  <div className="modal-header"><div><h2 id="recovery-title">استعادة العمليات</h2><p id="recovery-description">اختر الملف وراجع ملخصه قبل تأكيد الاستعادة.</p></div><HelpButton topic="offline"/><button className="icon-button" type="button" aria-label="إغلاق الاسترداد" disabled={busy} onClick={close}>×</button></div>
  <KeyboardForm busy={busy} className="modal-form" onSubmit={e=>{e.preventDefault();if(preview&&!busy)void restore();}}><div className="modal-body recovery-body"><FormKeyboardHelp/><label><span>ملف الاسترداد <span className="field-required" aria-hidden="true">*</span></span><input ref={fileInput} aria-label="ملف الاسترداد" aria-describedby={error?'recovery-file-hint recovery-file-error':'recovery-file-hint'} aria-invalid={!!error} type="file" accept=".json,application/json" disabled={busy} onChange={e=>void select(e.target.files?.[0])}/></label><small className="field-hint" id="recovery-file-hint">ملف JSON مصدّر من FooDo، حتى ١٠ ميجابايت.</small>
   {preview&&<div className="recovery-preview"><p>عمليات جديدة: <strong>{preview.newCount}</strong></p><p>موجودة على هذا الجهاز: <strong>{preview.duplicateCount}</strong></p><p>مقبولة سابقاً على الخادم: <strong>{preview.acceptedCount}</strong></p>{preview.legacyCount>0&&<p>بعض السجلات من نسخة قديمة بدون هوية جهاز المصدر.</p>}<p>لن تتكرر العمليات الموجودة. تُراجع العمليات المستوردة عند المزامنة قبل تغيير الرصيد المؤكد.</p></div>}
   {error&&<p role="alert" id="recovery-file-error" className="field-error form-error-summary">{error}</p>}
  </div>
  <div className="modal-footer"><div className="modal-actions"><button className="primary" type="submit" disabled={!preview||busy}>{busy?'جارٍ المعالجة…':'تأكيد الاسترداد'}</button><button className="secondary" type="button" disabled={busy} onClick={close}>إلغاء</button></div></div>
 </KeyboardForm></dialog>;
}
