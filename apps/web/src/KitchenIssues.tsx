'use client';
import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {kitchenIssueSchema,quantitySchema,type KitchenIssueDocument,type Snapshot,type Command,type OpeningDocument,type PostedKitchenIssue} from '@saas/contracts';
import {decimal,projectedQuantity} from '@saas/domain';
import {normalizeNumber} from '../../../packages/domain/opening-import';
import {FormInput,FormSelect,SearchableSelect,WorkflowForm,focusControl} from './FormControls';
import Collection,{amountSorts,syncStatusOptions} from './Collection';
import {OperationStatus,DocumentLink,reviewFirst} from './OperationStatus';
import {saveKitchenIssue,resolveKitchenIssue,type LocalKitchenIssue,type LocalSetup} from './offline';
import KitchenDirectory from './KitchenDirectory';

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const number=(n:string|number)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:6}).format(Number(n));
const documentNumber=(id:string)=>'KI-'+id.toUpperCase();
type Line={lineId:string;itemId:string;quantity:string};
const fresh=():Line=>({lineId:crypto.randomUUID(),itemId:'',quantity:''});
type IssueRow=LocalKitchenIssue&{posted?:PostedKitchenIssue};
function estimate(s:Snapshot,lines:Line[],location:string){let total=decimal('0');for(const l of lines){const b=s.balances.find(b=>b.locationId===location&&b.itemId===l.itemId);if(!b||!decimal(b.quantity).gt(0)||!quantitySchema.safeParse(normalizeNumber(l.quantity)).success)return null;total=total.add(decimal(b.value).div(b.quantity).mul(normalizeNumber(l.quantity)));}return lines.length?total.toString():null;}

export default function KitchenIssues({snapshot,location,rows,setups,commands,openings,expired,synchronize}:{snapshot:Snapshot;location:string;rows:LocalKitchenIssue[];setups:LocalSetup[];commands:Command[];openings:OpeningDocument[];expired:boolean;synchronize:()=>Promise<void>}){
 const [editor,setEditor]=useState<{row?:LocalKitchenIssue;location:string;generation?:string}|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[printing,setPrinting]=useState<IssueRow|null>(null),[directory,setDirectory]=useState(false);
 const trigger=useRef<HTMLButtonElement|null>(null);
 const docs=new Map<string,IssueRow>(rows.map(r=>[r.id,r]));
 for(const p of snapshot.kitchenIssues??[])docs.set(p.document.operationId,{...docs.get(p.document.operationId),id:p.document.operationId,scope:snapshot.organizationId,document:p.document,status:'accepted',createdAt:p.postedAt,error:undefined,posted:p});
 const all=[...docs.values()],visible=reviewFirst(all.filter(r=>r.document.locationId===location)),kitchens=[...new Set(all.map(r=>r.document.kitchen))].sort((a,b)=>a.localeCompare(b,'ar'));
 const accepted=visible.filter(r=>r.status==='accepted'&&r.posted),amount=accepted.reduce((n,r)=>n.add(r.posted!.amount),decimal('0')).toString();
 const hasKitchen=snapshot.kitchens?.some(k=>k.active)??false;
 const active=snapshot.locations.find(l=>l.id===location)?.active!==false&&snapshot.locations.some(l=>l.id===location);
 async function resolve(r:LocalKitchenIssue,action:'retry'|'cancel'){try{setError('');await resolveKitchenIssue(r.scope,r.id,action);if(action==='retry')await synchronize();}catch(e){setError(e instanceof Error?e.message:'تعذرت معالجة الصرف');}}
 const cost=(r:IssueRow)=>r.posted?.amount??estimate(snapshot,r.document.lines,r.document.locationId);
 return <>
  <section className="panel kitchen-intro"><div><span className="eyebrow">استهلاك مباشر من المخزن</span><h2>صرف مواد للمطبخ</h2><p>كل مادة تُصرف تُحتسب استهلاكًا على المطبخ فور قبول المستند، دون إنشاء رصيد فيه.</p></div><div className="heading-actions"><button type="button" className="secondary" onClick={e=>{trigger.current=e.currentTarget;setDirectory(true);}}>إدارة المطابخ</button><button type="button" className="primary" disabled={expired||!active||!hasKitchen||!snapshot.items.some(i=>i.active!==false&&i.unitId)} onClick={e=>{trigger.current=e.currentTarget;setEditor({location,generation:snapshot.generation});}}>إنشاء مستند صرف</button></div></section>
  {!hasKitchen&&<p className="notice">أضف مطبخًا من «إدارة المطابخ» لبدء صرف المواد.</p>}
  {directory&&<KitchenDirectory snapshot={snapshot} rows={setups} expired={expired} synchronize={synchronize} close={()=>{setDirectory(false);requestAnimationFrame(()=>trigger.current?.focus());}}/>}
  {notice&&<p role="status" className="notice">{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}
  <div className="kitchen-metrics"><section className="panel"><small>المستندات المقبولة في البيانات الحالية</small><strong>{number(accepted.length)}</strong></section><section className="panel"><small>قيمة الاستهلاك المقبول</small><strong>{number(amount)} <small>ج.م</small></strong></section></div>
  <section className="panel"><div className="panel-heading"><div><h2>سجل صرف المطابخ</h2><p>ابحث باسم المطبخ أو المرجع أو المادة؛ المستند المقبول يحتفظ بتكلفته عند الصرف.</p></div></div>
   <Collection rows={visible} title="صرف المطابخ" resetKey={location} searchText={r=>[r.document.kitchen,r.document.reference,r.document.notes,r.id,r.document.lines.map(l=>snapshot.items.find(i=>i.id===l.itemId)?.name).join(' ')].join(' ')} sortText={r=>r.document.kitchen} dateValue={r=>r.document.businessDate} filters={[{key:'kitchen',label:'المطبخ',value:r=>r.document.kitchen,options:kitchens.map(name=>({value:name,label:name}))},{key:'status',label:'حالة المزامنة',value:r=>r.status,options:syncStatusOptions}]} sorts={amountSorts('cost','قيمة المستند',cost)} rowIds={r=>[r.id]} emptyText="لم تسجّل مستندات صرف مطابخ لهذا المخزن بعد.">
    {page=>page.map(r=><details className="opening-document" key={r.id} id={'operation-'+r.id} tabIndex={-1}><summary><strong>{r.document.kitchen} · {r.document.reference}</strong> · {r.document.businessDate} · {number(r.document.lines.length)} مادة <OperationStatus status={r.status}/></summary><div className="kitchen-document-meta"><span>رقم المستند: <bdi className="kitchen-number">{documentNumber(r.id)}</bdi></span><span>{r.posted?'قيمة الصرف الفعلية':'قيمة تقديرية'}: <strong>{cost(r)===null?'غير متاحة':number(cost(r)!)} ج.م</strong></span>{r.posted&&<span>طريقة التكلفة: {r.posted.method==='fifo'?'FIFO':'المتوسط المرجح المتحرك'}</span>}</div>
     {r.document.notes&&<p>{r.document.notes}</p>}
     <Collection rows={r.document.lines} title={'مواد الصرف — '+r.document.reference} searchText={l=>r.posted?.lines.find(x=>x.lineId===l.lineId)?.name??snapshot.items.find(i=>i.id===l.itemId)?.name??l.itemId}>{lines=><div className="table-scroll"><table><thead><tr><th>المادة</th><th>الكمية</th><th>الوحدة</th><th>القيمة الفعلية</th></tr></thead><tbody>{lines.map(l=>{const p=r.posted?.lines.find(x=>x.lineId===l.lineId),item=snapshot.items.find(i=>i.id===l.itemId);return <tr key={l.lineId}><td>{p?.name??item?.name??l.itemId}</td><td>{number(l.quantity)}</td><td>{p?.unit??item?.unit}</td><td>{p?number(p.amount)+' ج.م':'بعد القبول'}</td></tr>;})}</tbody></table></div>}</Collection>
     {r.error&&<p role="alert" className="error">{r.error}</p>}{r.replacesId&&<p>تصحيح للمستند: <DocumentLink id={r.replacesId} view="kitchenIssues" location={r.document.locationId}/></p>}{r.replacementId&&<p>المستند البديل: <DocumentLink id={r.replacementId} view="kitchenIssues" location={r.document.locationId}/></p>}
     <div className="heading-actions"><button type="button" className="secondary" onClick={()=>setPrinting(r)}>عرض وطباعة المستند</button>{r.status==='needsReview'&&<><button type="button" className="secondary" disabled={expired} onClick={()=>void resolve(r,'retry')}>إعادة المحاولة</button><button type="button" className="secondary" disabled={expired} onClick={e=>{trigger.current=e.currentTarget;setEditor({row:r,location:r.document.locationId,generation:snapshot.generation});}}>تصحيح الصرف</button><button type="button" className="text-button" onClick={()=>void resolve(r,'cancel')}>إلغاء الصرف المرفوض</button></>}</div>
    </details>)}
   </Collection>
  </section>
  {editor&&<KitchenIssueEditor key={editor.row?.id??'new'} snapshot={snapshot} location={editor.location} generation={editor.generation} initial={editor.row} commands={commands.filter(c=>!editor.row?.document.lines.some(l=>l.lineId===c.operationId))} openings={openings} close={()=>{setEditor(null);requestAnimationFrame(()=>trigger.current?.focus());}} saved={()=>{setEditor(null);setNotice('حُفظ مستند صرف المطبخ على الجهاز. يتغير الرصيد المؤكد بعد قبول المزامنة.');requestAnimationFrame(()=>trigger.current?.focus());void synchronize();}}/>}
  {printing&&<KitchenIssuePrint snapshot={snapshot} row={printing} close={()=>setPrinting(null)}/>}
 </>;
}

export function KitchenIssueEditor({snapshot,location,generation,initial,commands,openings,close,saved}:{snapshot:Snapshot;location:string;generation?:string;initial?:LocalKitchenIssue;commands:Command[];openings:OpeningDocument[];close:()=>void;saved:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),locked=useRef(false),operationId=useRef(crypto.randomUUID());
 const [kitchenId,setKitchenId]=useState(initial?.document.kitchenId??snapshot.kitchens?.find(k=>k.active&&k.name===initial?.document.kitchen)?.id??''),[businessDate,setDate]=useState(initial?.document.businessDate??today()),[reference,setReference]=useState(initial?.document.reference??''),[notes,setNotes]=useState(initial?.document.notes??''),[lines,setLines]=useState<Line[]>(initial?.document.lines.map(l=>({...l,lineId:crypto.randomUUID()}))??[fresh()]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const modal=dialog.current;modal?.showModal();modal?.querySelector<HTMLSelectElement>('select[aria-label="المطبخ المستلم"]')?.focus({preventScroll:true});},[]);
 const items=snapshot.items.filter(i=>i.active!==false&&i.unitId),entered=lines.filter(l=>l.itemId||l.quantity),total=estimate(snapshot,entered,location);
 const available=(id:string)=>projectedQuantity(snapshot,commands,location,id,openings);
 function update(id:string,key:'itemId'|'quantity',value:string){setError('');setLines(old=>old.map(l=>l.lineId===id?{...l,[key]:value}:l));}
 function focus(form:HTMLFormElement,id:string,kind:'item'|'quantity'|'search'){const row=form.querySelector<HTMLElement>(`[data-collection-row="${id}"]`);const target=row?.querySelector<HTMLInputElement|HTMLSelectElement>(kind==='quantity'?'input[inputmode=decimal]':kind==='search'?'input[type=search]':'select');focusControl(target,form);}
 function add(form:HTMLFormElement){if(lines.length>=200){setError('الحد الأقصى ٢٠٠ مادة في المستند.');return;}const row=fresh();setLines(old=>[...old,row]);requestAnimationFrame(()=>focus(form,row.lineId,'search'));}
 function keyboard(e:KeyboardEvent<HTMLFormElement>){
  if(e.key!=='Enter'||e.nativeEvent.isComposing||busy)return;
  const form=e.currentTarget,target=e.target as HTMLElement;
  if(e.ctrlKey||e.metaKey)return; // Shared shortcut preserves submit-button guards.
  if(e.repeat){e.preventDefault();return;}
  if(target instanceof HTMLTextAreaElement||target instanceof HTMLButtonElement||target instanceof HTMLInputElement&&target.type==='search')return;
  if(e.shiftKey)return;
  e.preventDefault();const row=target.closest<HTMLElement>('[data-collection-row]'),id=row?.dataset.collectionRow;
  if(id&&target instanceof HTMLSelectElement){focus(form,id,'quantity');return;}
  if(id&&target instanceof HTMLInputElement&&target.inputMode==='decimal'){
   const l=lines.find(l=>l.lineId===id)!;if(!l.itemId||!quantitySchema.safeParse(normalizeNumber(l.quantity)).success){setError('اختر المادة وأدخل كمية موجبة قبل الانتقال للسطر التالي.');focus(form,id,!l.itemId?'search':'quantity');return;}
   const next=lines[lines.findIndex(l=>l.lineId===id)+1];if(next)focus(form,next.lineId,'search');else add(form);return;
  }
  const fields=Array.from(form.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input:not(:disabled),select:not(:disabled)')).filter(n=>!n.closest('[hidden]')&&!n.closest('.collection-top'));
  const next=fields[fields.indexOf(target as HTMLInputElement)+1];focusControl(next,form);
 }
 function check(){
  if(snapshot.generation!==generation)return {message:'تغيّرت نسخة البيانات. أغلق المستند وافتحه مجدداً.'};
  if(!snapshot.kitchens?.some(k=>k.id===kitchenId&&k.active))return {message:'اختر مطبخًا نشطًا.',field:'المطبخ المستلم'};
  if(!entered.length)return {message:'أضف مادة واحدة على الأقل.'};
  const seen=new Set<string>();for(const l of entered){const index=lines.indexOf(l)+1,item=snapshot.items.find(i=>i.id===l.itemId),field='كمية الصرف '+index;
   if(!item||item.active===false||!item.unitId)return {message:'اختر مادة نشطة.',field:'مادة الصرف '+index};
   if(seen.has(l.itemId))return {message:'المادة مكررة؛ اجمع كميتها في سطر واحد.',field:'مادة الصرف '+index};seen.add(l.itemId);
   if(!quantitySchema.safeParse(normalizeNumber(l.quantity)).success)return {message:'أدخل كمية موجبة.',field};
   if(decimal(normalizeNumber(l.quantity)).gt(available(l.itemId)))return {message:'الكمية أكبر من الرصيد المتوقع المتاح؛ خفّضها أو سجّل الاستلام أولاً.',field};
  }return undefined;
 }
 async function submit(){if(locked.current)return;locked.current=true;setBusy(true);setError('');try{
  const doc=kitchenIssueSchema.parse({generation,operationId:operationId.current,organizationId:snapshot.organizationId,locationId:location,type:'kitchen.issue',kitchenId,kitchen:snapshot.kitchens!.find(k=>k.id===kitchenId)!.name,businessDate,reference,notes,capturedAt:new Date().toISOString(),schemaVersion:1,currency:'EGP',lines:entered.map(l=>({...l,quantity:normalizeNumber(l.quantity),unitId:snapshot.items.find(i=>i.id===l.itemId)!.unitId}))});
  await saveKitchenIssue(doc,initial?.id);saved();
 }catch(e){setError(e instanceof Error&&e.name!=='ZodError'?e.message:'راجع بيانات المستند والكميات.');locked.current=false;}finally{setBusy(false);}}
 return <dialog ref={dialog} className="modal kitchen-issue-modal" aria-labelledby="kitchen-issue-title" onCancel={e=>{e.preventDefault();if(!busy)close();}}>
  <div className="modal-header"><div><span className="eyebrow">{snapshot.locations.find(l=>l.id===location)?.name}</span><h2 id="kitchen-issue-title">{initial?'تصحيح صرف مطبخ':'صرف مواد للمطبخ'}</h2><p>الصرف استهلاك مباشر. تكلفة المستند تُثبت عند قبول المزامنة.</p></div><button type="button" className="icon-button" disabled={busy} aria-label="إغلاق صرف المطبخ" onClick={close}>×</button></div>
  <WorkflowForm busy={busy} error={error} onEdit={()=>setError('')} documentCheck={check} onKeyDown={keyboard} onSubmit={()=>void submit()}>
   <div className="keyboard-help"><kbd>Tab</kbd> التالي · <kbd>Shift + Tab</kbd> السابق · <kbd>Enter</kbd> التالي / إضافة سطر بعد الكمية · <kbd>Ctrl + Enter</kbd> حفظ</div>
   <div className="form-row"><label>المطبخ المستلم<FormSelect aria-label="المطبخ المستلم" required value={kitchenId} onChange={e=>setKitchenId(e.target.value)}><option value="">اختر المطبخ</option>{(snapshot.kitchens??[]).filter(k=>k.active||k.id===kitchenId).map(k=><option key={k.id} value={k.id} disabled={!k.active}>{k.name}{!k.active?" (محذوف)":""}</option>)}</FormSelect></label><label>تاريخ الصرف<FormInput aria-label="تاريخ الصرف" type="date" required max={today()} value={businessDate} onChange={e=>setDate(e.target.value)}/></label></div>
   <label>مرجع الصرف<FormInput aria-label="مرجع الصرف" required minLength={2} maxLength={100} placeholder="مثال: تجهيز وردية الغداء" value={reference} onChange={e=>setReference(e.target.value)}/></label>
   <section className="form-section"><div className="form-section-heading"><h3>مواد الصرف</h3><small>الوحدات الأساسية للمخزون · {number(entered.length)} مادة</small></div><p className="field-hint">اكتب الاسم أو الكود لعرض النتائج. اختر بالأسهم ثم Enter للانتقال إلى الكمية.</p>
    <Collection rows={lines} title="مواد مستند الصرف" keepMounted rowIds={l=>[l.lineId]}>{(page,isShown)=><div className="kitchen-lines">{page.map((l,index)=>{const item=items.find(i=>i.id===l.itemId),q=available(l.itemId);return <fieldset key={l.lineId} className="kitchen-line" data-collection-row={l.lineId} hidden={!isShown(l)}><legend>المادة {index+1}</legend><label>المادة<SearchableSelect aria-label={'مادة الصرف '+(index+1)} value={l.itemId} required={!!l.quantity} onChange={e=>update(l.lineId,'itemId',e.target.value)} onSearchEnter={value=>{const form=dialog.current?.querySelector('form');if(!form)return;if(value){update(l.lineId,'itemId',value);requestAnimationFrame(()=>focus(form,l.lineId,'quantity'));}else focus(form,l.lineId,'item');}}><option value="">اختر المادة</option>{items.map(i=><option value={i.id} key={i.id} disabled={lines.some(x=>x.lineId!==l.lineId&&x.itemId===i.id)}>{i.name} · {i.sku} · {i.unit}</option>)}</SearchableSelect></label><label>كمية الصرف<FormInput aria-label={'كمية الصرف '+(index+1)} inputMode="decimal" validateAs="positive" required={!!l.itemId} value={l.quantity} onChange={e=>update(l.lineId,'quantity',e.target.value)} hint={item?`الوحدة: ${item.unit} · المتاح المتوقع: ${number(q)}`:'اختر المادة لعرض الوحدة والرصيد'}/></label><button type="button" className="text-button" aria-label={'حذف سطر الصرف '+(index+1)} onClick={e=>{const form=e.currentTarget.closest('form');const next=lines[index+1]??lines[index-1];setLines(old=>old.length===1?[fresh()]:old.filter(x=>x.lineId!==l.lineId));if(form)requestAnimationFrame(()=>{if(next)focus(form,next.lineId,'search');else form.querySelector<HTMLInputElement>('input[type=search]')?.focus();});}}>حذف</button></fieldset>;})}</div>}</Collection>
    <button data-keyboard-add type="button" className="secondary" disabled={lines.length>=200} onClick={e=>{const form=e.currentTarget.closest('form');if(form)add(form);}}>إضافة مادة</button>
   </section>
   <label>ملاحظات <small>اختياري</small><FormInput aria-label="ملاحظات صرف المطبخ" maxLength={300} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
   <div className="kitchen-estimate"><span>قيمة تقديرية بمتوسط المخزون الحالي</span><strong>{total===null?'بعد تحديد المواد والكميات':number(total)+' ج.م'}</strong><small>القيمة المقبولة تتبع طريقة تكلفة المؤسسة. تأكد أن المواد المصروفة لا تُخصم مرة أخرى من المخزن نفسه عند البيع.</small></div>
   <div className="workflow-actions"><button type="submit" className="primary">{busy?'جارٍ الحفظ…':'حفظ صرف المطبخ'}</button><button type="button" className="secondary" onClick={close}>إلغاء</button></div>
  </WorkflowForm>
 </dialog>;
}

function KitchenIssuePrint({snapshot,row,close}:{snapshot:Snapshot;row:IssueRow;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);useEffect(()=>{dialog.current?.showModal();},[]);
 const d=row.document,p=row.posted;
 return <dialog ref={dialog} className="modal kitchen-print-modal" aria-labelledby="kitchen-print-title" onCancel={e=>{e.preventDefault();close();}}><div className="modal-header kitchen-no-print"><h2 id="kitchen-print-title">طباعة مستند صرف</h2><button type="button" className="icon-button" aria-label="إغلاق طباعة الصرف" onClick={close}>×</button></div><article className="kitchen-print-sheet" dir="rtl"><header>{snapshot.organizationProfile?.logoPath&&<img src={snapshot.organizationProfile.logoPath} alt=""/>}<div><h2>{snapshot.organizationName}</h2><h1>مستند صرف مواد للمطبخ</h1></div></header><p><bdi className="kitchen-number">{documentNumber(row.id)}</bdi></p><div className="kitchen-print-info"><p>المطبخ: <strong>{d.kitchen}</strong></p><p>التاريخ: {d.businessDate}</p><p>المخزن: {snapshot.locations.find(l=>l.id===d.locationId)?.name}</p><p>المرجع: {d.reference}</p></div>{!p&&<p className="kitchen-print-pending">غير مقبول بعد — حالة المزامنة: <OperationStatus status={row.status}/> · الكميات والتكلفة غير نهائية.</p>}<table><thead><tr><th>المادة</th><th>الكمية</th><th>الوحدة</th><th>تكلفة الوحدة</th><th>القيمة</th></tr></thead><tbody>{d.lines.map(l=>{const v=p?.lines.find(x=>x.lineId===l.lineId),item=snapshot.items.find(i=>i.id===l.itemId);return <tr key={l.lineId}><td>{v?.name??item?.name??l.itemId}</td><td>{number(l.quantity)}</td><td>{v?.unit??item?.unit}</td><td>{v?number(decimal(v.amount).div(l.quantity).toString()):'—'}</td><td>{v?number(v.amount):'—'}</td></tr>;})}</tbody></table><p className="kitchen-print-total">قيمة الاستهلاك: <strong>{p?number(p.amount)+' ج.م':'تُثبت بعد قبول المزامنة'}</strong></p>{d.notes&&<p>ملاحظات: {d.notes}</p>}<p>المواد المصروفة تُحتسب استهلاكًا مباشرًا للمطبخ.</p><div className="kitchen-signatures"><p>توقيع مسؤول المخزن: __________________</p><p>توقيع المستلم: __________________</p></div><footer>FooDo · مستند داخلي لصرف المواد</footer></article><div className="modal-actions kitchen-no-print"><button type="button" className="primary" onClick={()=>window.print()}>طباعة / حفظ PDF</button><button type="button" className="secondary" onClick={close}>إغلاق</button></div></dialog>;
}
