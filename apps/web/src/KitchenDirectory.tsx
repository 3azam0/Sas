'use client';
import CollapsibleSection from './CollapsibleSection';
import {useEffect,useRef,useState} from 'react';
import {type Kitchen,type Snapshot,setupCommandSchema} from '@saas/contracts';
import {saveSetup,resolveSetup,type LocalSetup} from './offline';
import Collection from './Collection';
import {FormInput,SearchableSelect,WorkflowForm} from './FormControls';

export default function KitchenDirectory({snapshot,rows,expired,synchronize,close}:{snapshot:Snapshot;rows:LocalSetup[];expired:boolean;synchronize:()=>Promise<void>;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement|null>(null),locked=useRef(false),opener=useRef<HTMLElement|null>(typeof document!=='undefined'&&document.activeElement instanceof HTMLElement?document.activeElement:null);
 const [editor,setEditor]=useState<{record?:Kitchen;remove?:boolean}|null>(null),[name,setName]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{dialog.current?.showModal();dialog.current?.querySelector<HTMLButtonElement>('[data-add-kitchen]')?.focus();return()=>{if(opener.current?.isConnected)opener.current.focus({preventScroll:true});};},[]);
 useEffect(()=>{if(editor)dialog.current?.querySelector<HTMLInputElement>('input[aria-label="اسم المطبخ"]')?.focus();else{const label=trigger.current?.getAttribute('aria-label'),target=trigger.current?.isConnected?trigger.current:label?Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button')??[]).find(button=>button.getAttribute('aria-label')===label):dialog.current?.querySelector<HTMLButtonElement>('[data-add-kitchen]');target?.focus({preventScroll:true});}},[editor]);
 const [parent,setParent]=useState('');
 const changes=rows.filter(r=>r.command.type==='kitchen.save'),kitchens=snapshot.kitchens??[];
 const blocked=(id:string)=>changes.some(r=>r.command.record.id===id&&['pending','acceptedAwaiting','needsReview'].includes(r.status));
 function open(button:HTMLButtonElement,record?:Kitchen,remove=false){trigger.current=button;setName(record?.name??'');setParent(record?.parentLocationId??snapshot.locations.find(l=>l.active!==false&&!l.kitchenId)?.id??'');setError('');setNotice('');setEditor({record,remove});}
 async function save(active=true){
  if(locked.current||expired)return;locked.current=true;setBusy(true);setError('');
  try{const record=editor?.record,id=record?.id??crypto.randomUUID();
   const command=setupCommandSchema.parse({generation:snapshot.generation,operationId:crypto.randomUUID(),organizationId:snapshot.organizationId,type:'kitchen.save',expectedRevision:record?.revision??0,capturedAt:new Date().toISOString(),schemaVersion:1,record:{id,name:name.trim(),active,locationId:record?.locationId??crypto.randomUUID(),parentLocationId:parent||undefined}});
   await saveSetup(command);setEditor(null);setNotice(active?'حُفظ المطبخ على الجهاز وستتم مزامنته.':'حُذف المطبخ من الاختيارات؛ مستنداته السابقة محفوظة.');void synchronize();
  }catch(e){setError(e instanceof Error&&e.name!=='ZodError'?e.message:'أدخل اسم مطبخ من حرفين إلى ١٠٠ حرف.');}finally{locked.current=false;setBusy(false);}
 }
 async function restore(record:Kitchen){trigger.current=null;setName(record.name);setParent(record.parentLocationId??snapshot.locations.find(l=>l.active!==false&&!l.kitchenId)?.id??'');setEditor({record});}
 async function resolve(id:string,action:'retry'|'cancel'){try{setError('');await resolveSetup(snapshot.organizationId,id,action);if(action==='retry')void synchronize();}catch(e){setError(e instanceof Error?e.message:'تعذرت معالجة التعديل.');}}
 return <dialog ref={dialog} className="modal kitchen-issue-modal kitchen-directory-modal" aria-labelledby="kitchen-directory-title" onCancel={e=>{e.preventDefault();if(busy)return;if(editor)setEditor(null);else close();}}>
  <div className="modal-header"><div><h2 id="kitchen-directory-title">إدارة المطابخ</h2><p>كل مطبخ له مخزون مستقل ونقاط بيع. انقل رصيده وعطّل نقاطه قبل حذفه.</p></div><button type="button" className="icon-button" aria-label="إغلاق إدارة المطابخ" disabled={busy} onClick={close}>×</button></div>
  <div className="kitchen-directory-body">
   {notice&&<p role="status" className="notice">{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}
   {editor?<WorkflowForm busy={busy} aria-label={editor.remove?'حذف المطبخ':editor.record?'تعديل المطبخ':'إضافة مطبخ'} documentCheck={()=>!editor.remove&&kitchens.some(k=>k.active&&k.id!==editor.record?.id&&k.name.trim().toLocaleLowerCase()===name.trim().toLocaleLowerCase())?{message:'اسم المطبخ مستخدم بالفعل. اختر اسمًا مختلفًا.',field:'اسم المطبخ'}:undefined} onSubmit={e=>{e.preventDefault();void save(!editor.remove);}}>
    <h3>{editor.remove?'حذف المطبخ':editor.record?'تعديل المطبخ':'إضافة مطبخ'}</h3>
    <label><span className="form-label">اسم المطبخ<span className="field-required" aria-hidden="true">*</span></span><FormInput aria-label="اسم المطبخ" required minLength={2} maxLength={100} value={name} readOnly={editor.remove} disabled={busy} onChange={e=>setName(e.target.value)} placeholder="مثال: مطبخ ١"/></label>
    {!editor.remove&&<label><span className="form-label">المخزن الرئيسي<span className="field-required" aria-hidden="true">*</span></span><SearchableSelect aria-label="المخزن الرئيسي للمطبخ" required value={parent} onChange={e=>setParent(e.target.value)}><option value="">اختر المخزن الرئيسي</option>{snapshot.locations.filter(l=>!l.kitchenId&&l.active!==false&&l.id!==editor.record?.locationId).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</SearchableSelect><small>يبدأ المطبخ برصيد صفر؛ انقل المواد إليه باستخدام صرف المخزون.</small></label>}
    {editor.remove&&<p>انقل رصيد المطبخ واستكمل التحويلات وعطّل نقاط البيع قبل الحذف. تظل مستنداته السابقة محفوظة، ويمكن استعادته لاحقاً.</p>}
    <div className="heading-actions"><button type="submit" className="primary" disabled={busy||expired}>{busy?'جارٍ الحفظ…':editor.remove?'حذف المطبخ':'حفظ المطبخ'}</button><button type="button" className="secondary" disabled={busy} onClick={()=>setEditor(null)}>إلغاء تعديل المطبخ</button></div>
   </WorkflowForm>:<><div className="heading-actions"><button type="button" data-add-kitchen className="primary" disabled={expired} onClick={e=>open(e.currentTarget)}>إضافة مطبخ</button></div>
    <CollapsibleSection className="directory-list-section" title="قائمة المطابخ"><Collection rows={kitchens} title="المطابخ" searchText={k=>k.name} sortText={k=>k.name} filters={[{key:'active',label:'الحالة',value:k=>k.active?'active':'deleted',options:[{value:'active',label:'نشط'},{value:'deleted',label:'محذوف'}]}]} emptyText="لا توجد مطابخ بعد. أضف أول مطبخ لبدء الصرف.">{page=><div className="table-scroll"><table><thead><tr><th>المطبخ</th><th>المخزن الرئيسي</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>{page.map(k=><tr key={k.id}><td>{k.name}</td><td>{snapshot.locations.find(l=>l.id===k.parentLocationId)?.name??'لم يحدد بعد'}</td><td>{blocked(k.id)?'تعديل ينتظر المزامنة':k.active?'نشط':'محذوف'}</td><td><div className="heading-actions">{k.active?<><button type="button" className="secondary" aria-label={'تعديل '+k.name} disabled={expired||blocked(k.id)} onClick={e=>open(e.currentTarget,k)}>تعديل</button><button type="button" className="text-button" aria-label={'حذف '+k.name} disabled={expired||blocked(k.id)} onClick={e=>open(e.currentTarget,k,true)}>حذف</button></>:<button type="button" className="secondary" aria-label={'استعادة '+k.name} disabled={expired||blocked(k.id)} onClick={()=>void restore(k)}>استعادة</button>}</div></td></tr>)}</tbody></table></div>}</Collection></CollapsibleSection>
   </>}
   {changes.filter(r=>r.status==='needsReview').map(r=><div className="notice" key={r.id}><strong>{r.command.record.name}</strong><p>{r.error}</p><div className="heading-actions"><button type="button" className="secondary" disabled={expired} onClick={()=>void resolve(r.id,'retry')}>إعادة محاولة تعديل المطبخ</button><button type="button" className="text-button" onClick={()=>void resolve(r.id,'cancel')}>إلغاء التعديل المرفوض</button></div></div>)}
  </div>
  <div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={close}>إغلاق إدارة المطابخ</button></div>
 </dialog>;
}
