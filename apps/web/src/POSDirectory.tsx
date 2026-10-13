'use client';
import CollapsibleSection from './CollapsibleSection';
import {useEffect,useRef,useState} from 'react';
import {setupCommandSchema,type PointOfSale,type Snapshot} from '@saas/contracts';
import {saveSetup,resolveSetup,type LocalSetup} from './offline';
import {FormInput,SearchableSelect,WorkflowForm} from './FormControls';
import Collection from './Collection';
import {DocumentFields} from './DocumentForm';

export default function POSDirectory({snapshot,rows,expired,synchronize,close}:{snapshot:Snapshot;rows:LocalSetup[];expired:boolean;synchronize:()=>Promise<void>;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLElement|null>(typeof document!=='undefined'&&document.activeElement instanceof HTMLElement?document.activeElement:null);
 const [editing,setEditing]=useState<PointOfSale|{id:string;name:string;source:string;kitchenId:string;active:boolean;revision:0}>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const kitchens=(snapshot.kitchens??[]).filter(k=>k.locationId),changes=rows.filter(r=>r.command.type==='pos.save');
 const blocked=(id:string)=>changes.some(r=>r.command.record.id===id&&['pending','acceptedAwaiting','needsReview'].includes(r.status));
 useEffect(()=>{dialog.current?.showModal();return()=>{if(opener.current?.isConnected)opener.current.focus({preventScroll:true});};},[]);
 async function save(){if(!editing||busy||expired)return;setBusy(true);setError('');try{await saveSetup(setupCommandSchema.parse({generation:snapshot.generation,operationId:crypto.randomUUID(),organizationId:snapshot.organizationId,type:'pos.save',expectedRevision:editing.revision,capturedAt:new Date().toISOString(),schemaVersion:1,record:editing}));setEditing(undefined);setNotice('حُفظت نقطة البيع على الجهاز؛ يتم اعتمادها بعد المزامنة.');void synchronize();}catch(e){setError(e instanceof Error&&e.name!=='ZodError'?e.message:'راجع الاسم والمصدر والمطبخ.');}finally{setBusy(false);}}
 async function resolve(id:string,action:'retry'|'cancel'){try{await resolveSetup(snapshot.organizationId,id,action);if(action==='retry')void synchronize();}catch(e){setError(e instanceof Error?e.message:'تعذرت معالجة التعديل.');}}
 return <dialog ref={dialog} className="modal kitchen-issue-modal kitchen-directory-modal" aria-labelledby="pos-directory-title" onCancel={e=>{e.preventDefault();if(!busy){if(editing)setEditing(undefined);else close();}}}>
  <div className="modal-header"><div><h2 id="pos-directory-title">نقاط البيع</h2><p>كل نقطة بيع تخص مطبخاً واحداً؛ البيع يخصم من مخزونه فقط.</p></div><button type="button" className="icon-button" aria-label="إغلاق نقاط البيع" disabled={busy} onClick={close}>×</button></div>
  <div className="kitchen-directory-body">{notice&&<p className="notice" role="status">{notice}</p>}{error&&<p className="error" role="alert">{error}</p>}
   {editing?<WorkflowForm busy={busy} error={error} onEdit={()=>setError('')} documentCheck={()=>editing.active&&!kitchens.some(k=>k.id===editing.kitchenId&&k.active)?{message:'اختر مطبخ مخزون نشطاً.',field:'مطبخ نقطة البيع'}:undefined} onSubmit={()=>void save()}>
    <h3>{editing.revision?'تعديل نقطة البيع':'إضافة نقطة بيع'}</h3><DocumentFields columns={2} title="بيانات نقطة البيع">
     <label>اسم نقطة البيع<FormInput autoFocus aria-label="اسم نقطة البيع" required minLength={2} maxLength={100} placeholder="مثال: نقطة بيع مطبخ ١" value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/></label>
     <label>مصدر نظام البيع<FormInput aria-label="مصدر نقطة البيع" required maxLength={60} pattern="[A-Za-z0-9_.-]+" disabled={editing.revision>0} value={editing.source} onChange={e=>setEditing({...editing,source:e.target.value.toUpperCase()})}/><small>نفس المصدر المستخدم في أكواد أصناف البيع، مثل POS.</small></label>
     <label>المطبخ المسؤول<SearchableSelect aria-label="مطبخ نقطة البيع" required value={editing.kitchenId} onChange={e=>setEditing({...editing,kitchenId:e.target.value})}><option value="">اختر المطبخ</option>{kitchens.filter(k=>k.active||k.id===editing.kitchenId).map(k=><option key={k.id} value={k.id}>{k.name}{!k.active?' · غير نشط':''}</option>)}</SearchableSelect></label>
     <label className="count-confirm"><FormInput type="checkbox" aria-label="نقطة بيع نشطة" checked={editing.active} onChange={e=>setEditing({...editing,active:e.target.checked})}/>نشطة</label>
    </DocumentFields><div className="heading-actions"><button className="primary" type="submit" disabled={busy||expired}>حفظ نقطة البيع</button><button type="button" className="secondary" disabled={busy} onClick={()=>setEditing(undefined)}>إلغاء تعديل نقطة البيع</button></div>
   </WorkflowForm>:<><button type="button" className="primary" disabled={expired||!kitchens.some(k=>k.active)} onClick={()=>{setError('');setEditing({id:crypto.randomUUID(),name:'',source:'POS',kitchenId:kitchens.find(k=>k.active)?.id??'',active:true,revision:0});}}>إضافة نقطة بيع</button>{!kitchens.some(k=>k.active)&&<p className="disabled-reason">أضف مطبخ مخزون أولاً من إدارة المطابخ.</p>}
    <CollapsibleSection className="directory-list-section" title="قائمة نقاط البيع"><Collection rows={snapshot.pointsOfSale??[]} title="نقاط البيع" searchText={p=>p.name+' '+p.source+' '+(kitchens.find(k=>k.id===p.kitchenId)?.name??'')} sortText={p=>p.name} filters={[{key:'active',label:'الحالة',value:p=>p.active?'active':'inactive',options:[{value:'active',label:'نشطة'},{value:'inactive',label:'غير نشطة'}]}]} emptyText="لا توجد نقاط بيع بعد.">{page=><div className="table-scroll"><table><thead><tr><th>نقطة البيع</th><th>المطبخ</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>{page.map(p=><tr key={p.id}><td>{p.name}<small className="setup-subline">{p.source}</small></td><td>{kitchens.find(k=>k.id===p.kitchenId)?.name??p.kitchenId}</td><td>{blocked(p.id)?'تعديل ينتظر المزامنة':p.active?'نشطة':'غير نشطة'}</td><td><button type="button" className="secondary" aria-label={'تعديل نقطة البيع '+p.name} disabled={expired||blocked(p.id)} onClick={()=>{setError('');setEditing(p);}}>تعديل / تعطيل</button></td></tr>)}</tbody></table></div>}</Collection></CollapsibleSection>
   </>}
   {changes.filter(r=>r.status==='needsReview').map(r=><div key={r.id} className="notice"><strong>{r.command.record.name}</strong><p>{r.error}</p><button type="button" className="secondary" disabled={expired} onClick={()=>void resolve(r.id,'retry')}>إعادة محاولة نقطة البيع</button><button type="button" className="text-button" onClick={()=>void resolve(r.id,'cancel')}>إلغاء التعديل المرفوض</button></div>)}
  </div><div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={close}>إغلاق نقاط البيع</button></div>
 </dialog>;
}
