'use client';
import {HelpButton} from './ClientGuide';
import CollapsibleSection from './CollapsibleSection';
import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {kitchenIssueSchema,quantitySchema,type KitchenIssueDocument,type Snapshot,type Command,type OpeningDocument,type PostedKitchenIssue} from '@saas/contracts';
import {decimal,projectedQuantity} from '@saas/domain';
import {normalizeNumber} from '../../../packages/domain/opening-import';
import {FormInput,SearchableSelect,WorkflowForm,FormKeyboardHelp,focusControl} from './FormControls';
import Collection,{amountSorts,syncStatusOptions} from './Collection';
import {OperationStatus,DocumentLink,reviewFirst} from './OperationStatus';
import {saveKitchenIssue,resolveKitchenIssue,type LocalKitchenIssue,type LocalSetup} from './offline';
import KitchenDirectory from './KitchenDirectory';
import POSDirectory from './POSDirectory';
import KitchenStock from './KitchenStock';
import {useUI} from './store';
import {issueStockPreview} from './kitchen-issue-preview';
import {commitIssueEntry,type IssueEntry,type IssueLine} from './kitchen-issue-entry';

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const number=(n:string|number)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:6}).format(Number(n));
const documentNumber=(id:string)=>'KI-'+id.toUpperCase();
type Line=IssueLine;
type IssueRow=LocalKitchenIssue&{posted?:PostedKitchenIssue};
function estimate(s:Snapshot,lines:Line[],location:string){let total=decimal('0');for(const l of lines){const b=s.balances.find(b=>b.locationId===location&&b.itemId===l.itemId);if(!b||!decimal(b.quantity).gt(0)||!quantitySchema.safeParse(normalizeNumber(l.quantity)).success)return null;total=total.add(decimal(b.value).div(b.quantity).mul(normalizeNumber(l.quantity)));}return lines.length?total.toString():null;}

export default function KitchenIssues({snapshot,location,rows,setups,commands,openings,expired,synchronize,onSaved}:{snapshot:Snapshot;location:string;rows:LocalKitchenIssue[];setups:LocalSetup[];commands:Command[];openings:OpeningDocument[];expired:boolean;synchronize:()=>Promise<void>;onSaved?:(id:string)=>void}){
 const openSupplyReport=()=>{const ui=useUI.getState();ui.ensureReportScope(snapshot.organizationId+':'+snapshot.generation);ui.setReportFilters({...useUI.getState().reportFilters,kind:'kitchenSupply',category:'',itemId:'',supplierId:'',kitchenId:'',posId:'',search:'',sort:'date_desc',page:1});ui.setView('reports');};
 const [editor,setEditor]=useState<{row?:LocalKitchenIssue;location:string;generation?:string}|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[printing,setPrinting]=useState<IssueRow|null>(null),[directory,setDirectory]=useState(false),[posDirectory,setPOSDirectory]=useState(false);
 const trigger=useRef<HTMLButtonElement|null>(null);
 const docs=new Map<string,IssueRow>(rows.map(r=>[r.id,r]));
 for(const p of snapshot.kitchenIssues??[])docs.set(p.document.operationId,{...docs.get(p.document.operationId),id:p.document.operationId,scope:snapshot.organizationId,document:p.document,status:'accepted',createdAt:p.postedAt,error:undefined,posted:p});
 const all=[...docs.values()],visible=reviewFirst(all.filter(r=>r.document.locationId===location||r.document.destinationLocationId===location)),kitchens=[...new Set(all.map(r=>r.document.kitchen))].sort((a,b)=>a.localeCompare(b,'ar'));
 const accepted=visible.filter(r=>r.status==='accepted'&&r.posted),amount=accepted.reduce((n,r)=>n.add(r.posted!.amount),decimal('0')).toString();
 const hasKitchen=snapshot.kitchens?.some(k=>k.active&&k.locationId!==location)??false;
 const active=snapshot.locations.find(l=>l.id===location)?.active!==false&&snapshot.locations.some(l=>l.id===location);
 async function resolve(r:LocalKitchenIssue,action:'retry'|'cancel'){try{setError('');await resolveKitchenIssue(r.scope,r.id,action);if(action==='retry')await synchronize();}catch(e){setError(e instanceof Error?e.message:'تعذرت معالجة الصرف');}}
 const cost=(r:IssueRow)=>r.posted?.amount??estimate(snapshot,r.document.lines,r.document.locationId);
 return <>
  <section className="panel kitchen-intro"><div><span className="eyebrow">المطابخ والمخزون الفرعي</span><h2>صرف مواد للمطبخ</h2><p>صرف المواد إلى المطبخ ينقلها إلى مخزونه. تُستهلك المواد المحددة عند بيع الوجبة من نقطة بيعه.</p></div><div className="heading-actions"><button type="button" className="secondary" onClick={()=>setPOSDirectory(true)}>إدارة نقاط البيع</button><button type="button" className="secondary" onClick={e=>{trigger.current=e.currentTarget;setDirectory(true);}}>إدارة المطابخ</button><button type="button" className="primary" disabled={expired||!active||!hasKitchen||!snapshot.items.some(i=>i.active!==false&&i.unitId)} onClick={e=>{trigger.current=e.currentTarget;setEditor({location,generation:snapshot.generation});}}>إنشاء مستند صرف</button></div></section>
  {!hasKitchen&&<p className="notice">يوجد مطبخ في الموقع الحالي؟ اختر المخزن الرئيسي مصدراً للصرف، أو أضف مطبخاً آخر من «إدارة المطابخ».</p>}
  {directory&&<KitchenDirectory snapshot={snapshot} rows={setups} expired={expired} synchronize={synchronize} close={()=>{setDirectory(false);requestAnimationFrame(()=>trigger.current?.focus());}}/>}
  {notice&&<p role="status" className="notice">{notice}</p>}{posDirectory&&<POSDirectory snapshot={snapshot} rows={setups} expired={expired} synchronize={synchronize} close={()=>setPOSDirectory(false)}/>}
  {error&&<p role="alert" className="error">{error}</p>}
  <KitchenStock snapshot={snapshot} commands={commands} openings={openings}/>
  <div className="kitchen-metrics"><section className="panel"><small>المستندات المقبولة في البيانات الحالية</small><strong>{number(accepted.length)}</strong></section><section className="panel"><small>قيمة مستندات الصرف والتحويل المقبولة</small><strong>{number(amount)} <small>ج.م</small></strong></section></div>
  <CollapsibleSection className="panel"><div className="panel-heading"><div><h2>سجل صرف المطابخ</h2><p>ابحث باسم المطبخ أو المرجع أو المادة؛ المستند المقبول يحتفظ بتكلفته عند الصرف.</p></div><button type="button" className="secondary" onClick={openSupplyReport}>تقرير صرف المطابخ والرسوم ←</button></div>
   <Collection rows={visible} title="صرف المطابخ" resetKey={location} searchText={r=>[r.document.kitchen,r.document.reference,r.document.notes,r.id,r.document.lines.map(l=>snapshot.items.find(i=>i.id===l.itemId)?.name).join(' ')].join(' ')} sortText={r=>r.document.kitchen} dateValue={r=>r.document.businessDate} filters={[{key:'kitchen',label:'المطبخ',value:r=>r.document.kitchen,options:kitchens.map(name=>({value:name,label:name}))},{key:'status',label:'حالة المزامنة',value:r=>r.status,options:syncStatusOptions}]} sorts={amountSorts('cost','قيمة المستند',cost)} rowIds={r=>[r.id]} emptyText="لم تسجّل مستندات صرف مطابخ لهذا المخزن بعد.">
    {page=>page.map(r=><details className="opening-document" key={r.id} id={'operation-'+r.id} tabIndex={-1}><summary><strong>{r.document.type==='kitchen.transfer'?'تحويل إلى ':'استهلاك سابق — '}{r.document.kitchen}{r.document.reference&&' · '+r.document.reference}</strong> · {r.document.businessDate} · {number(r.document.lines.length)} مادة <OperationStatus status={r.status}/></summary><div className="kitchen-document-meta"><span>رقم المستند: <bdi className="kitchen-number">{documentNumber(r.id)}</bdi></span><span>{r.posted?'قيمة المستند الفعلية':'قيمة تقديرية'}: <strong>{cost(r)===null?'غير متاحة':number(cost(r)!)} ج.م</strong></span>{r.posted&&<span>طريقة التكلفة: {r.posted.method==='fifo'?'FIFO':'المتوسط المرجح المتحرك'}</span>}</div>
     {r.document.notes&&<p>{r.document.notes}</p>}
     <Collection rows={r.document.lines} title={'مواد الصرف — '+(r.document.reference||documentNumber(r.id))} searchText={l=>r.posted?.lines.find(x=>x.lineId===l.lineId)?.name??snapshot.items.find(i=>i.id===l.itemId)?.name??l.itemId}>{lines=><div className="table-scroll"><table><thead><tr><th>المادة</th><th>الكمية</th><th>الوحدة</th><th>القيمة الفعلية</th></tr></thead><tbody>{lines.map(l=>{const p=r.posted?.lines.find(x=>x.lineId===l.lineId),item=snapshot.items.find(i=>i.id===l.itemId);return <tr key={l.lineId}><td>{p?.name??item?.name??l.itemId}</td><td>{number(l.quantity)}</td><td>{p?.unit??item?.unit}</td><td>{p?number(p.amount)+' ج.م':'بعد القبول'}</td></tr>;})}</tbody></table></div>}</Collection>
     {r.error&&<p role="alert" className="error">{r.error}</p>}{r.replacesId&&<p>تصحيح للمستند: <DocumentLink id={r.replacesId} view="kitchenIssues" location={r.document.locationId}/></p>}{r.replacementId&&<p>المستند البديل: <DocumentLink id={r.replacementId} view="kitchenIssues" location={r.document.locationId}/></p>}
     <div className="heading-actions"><button type="button" className="secondary" onClick={()=>setPrinting(r)}>عرض وطباعة المستند</button>{r.status==='needsReview'&&<><button type="button" className="secondary" disabled={expired} onClick={()=>void resolve(r,'retry')}>إعادة المحاولة</button><button type="button" className="secondary" disabled={expired} onClick={e=>{trigger.current=e.currentTarget;setEditor({row:r,location:r.document.locationId,generation:snapshot.generation});}}>تصحيح الصرف</button><button type="button" className="text-button" onClick={()=>void resolve(r,'cancel')}>إلغاء الصرف المرفوض</button></>}</div>
    </details>)}
   </Collection>
  </CollapsibleSection>
  {editor&&<KitchenIssueEditor key={editor.row?.id??'new'} snapshot={snapshot} location={editor.location} generation={editor.generation} initial={editor.row} commands={commands.filter(c=>!editor.row?.document.lines.some(l=>l.lineId===c.operationId))} openings={openings} close={()=>{setEditor(null);requestAnimationFrame(()=>trigger.current?.focus());}} saved={id=>{setEditor(null);if(onSaved)onSaved(id);else setNotice('محفوظ على الجهاز — بانتظار المزامنة.');requestAnimationFrame(()=>trigger.current?.focus());void synchronize();}}/>}
  {printing&&<KitchenIssuePrint snapshot={snapshot} row={printing} close={()=>setPrinting(null)}/>}
 </>;
}

export function KitchenIssueEditor({snapshot,location,generation,initial,commands,openings,close,saved}:{snapshot:Snapshot;location:string;generation?:string;initial?:LocalKitchenIssue;commands:Command[];openings:OpeningDocument[];close:()=>void;saved:(id:string)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),locked=useRef(false),operationId=useRef(crypto.randomUUID());
 const [kitchenId,setKitchenId]=useState(initial?.document.kitchenId??snapshot.kitchens?.find(k=>k.active&&k.name===initial?.document.kitchen)?.id??''),[businessDate,setDate]=useState(initial?.document.businessDate??today()),[reference,setReference]=useState(initial?.document.reference??''),[notes,setNotes]=useState(initial?.document.notes??''),[lines,setLines]=useState<Line[]>(initial?.document.lines.map(l=>({...l,lineId:crypto.randomUUID()}))??[]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [entry,setEntry]=useState<IssueEntry>({itemId:'',quantity:''}),[editingId,setEditingId]=useState<string|null>(null),[entryError,setEntryError]=useState<{message:string;field:'item'|'quantity'}|null>(null),[notice,setNotice]=useState(''),[listVersion,setListVersion]=useState(0),[entryVersion,setEntryVersion]=useState(0),[lastChanged,setLastChanged]=useState(''),[showNotes,setShowNotes]=useState(!!initial?.document.notes||!!initial?.document.reference);
 useEffect(()=>{const modal=dialog.current;modal?.showModal();modal?.querySelector<HTMLInputElement>('input[role="combobox"][aria-label="المطبخ المستلم"]')?.focus({preventScroll:true});},[]);
 const items=snapshot.items.filter(i=>i.active!==false&&i.unitId),total=estimate(snapshot,lines,location),sourceName=snapshot.locations.find(l=>l.id===location)?.name??location;
 const available=(id:string)=>projectedQuantity(snapshot,commands,location,id,openings);
 const selectedItem=items.find(i=>i.id===entry.itemId),existing=!editingId?lines.find(l=>l.itemId===entry.itemId):undefined,parsedEntry=quantitySchema.safeParse(normalizeNumber(entry.quantity));
 const plannedQuantity=parsedEntry.success&&existing?decimal(existing.quantity).add(parsedEntry.data).toString():entry.quantity;
 const entryPreview=selectedItem?issueStockPreview(available(selectedItem.id),plannedQuantity):null;
 const shortageCount=lines.filter(l=>issueStockPreview(available(l.itemId),l.quantity).status==='shortage').length;
 function focusEntry(kind:'item'|'quantity'){
  const form=dialog.current?.querySelector('form');requestAnimationFrame(()=>focusControl(form?.querySelector<HTMLInputElement>(kind==='item'?'input[aria-label="مادة الصرف"]':'input[aria-label="كمية الصرف"]'),form??null));
 }
 function updateEntry(key:'itemId'|'quantity',value:string){setEntry(old=>({...old,[key]:value}));setEntryError(null);setError('');setNotice('');}
 function clearEntry(){setEntryVersion(v=>v+1);setEntry({itemId:'',quantity:''});setEditingId(null);setEntryError(null);setError('');focusEntry('item');}
 function failEntry(message:string,field:'item'|'quantity'){setEntryError({message,field});setNotice('');focusEntry(field);}
 function addEntry(){
  if(busy)return;
  if(!items.some(item=>item.id===entry.itemId)){failEntry('اختر مادة نشطة من القائمة.','item');return;}
  const result=commitIssueEntry(lines,entry,available(entry.itemId),crypto.randomUUID(),editingId);
  if(!result.ok){
   const messages={
    'missing-item':'اختر مادة من القائمة.',
    'invalid-quantity':'أدخل كمية موجبة حتى ٦ منازل عشرية؛ يجب أن تظل الكمية المجمعة ضمن الحد المسموح.',
    'capacity':'الحد الأقصى ٢٠٠ مادة مختلفة في المستند. يمكنك تعديل مادة موجودة أو جمع كميتها.',
    'shortage':'الكمية الإجمالية لهذه المادة أكبر من الرصيد المتوقع المتاح؛ خفّضها أو سجّل الاستلام أولًا.',
    'missing-edit':'المادة الجاري تعديلها لم تعد في القائمة. ألغِ التعديل واخترها مجددًا.'
   };failEntry(messages[result.reason],result.reason==='missing-item'?'item':'quantity');return;
  }
  setEntryVersion(v=>v+1);setLines(result.lines);setLastChanged(result.line.lineId);setListVersion(v=>v+1);setEntry({itemId:'',quantity:''});setEditingId(null);setEntryError(null);setError('');
  const item=items.find(i=>i.id===result.line.itemId)!;
  setNotice((result.action==='merged'?'جُمعت الكمية مع المادة الموجودة':result.action==='updated'?'عُدلت الكمية في القائمة':'أُضيفت المادة')+' — '+item.name+' · '+number(result.line.quantity)+' '+item.unit);focusEntry('item');
 }
 function editLine(line:Line){
  if(editingId===line.lineId){focusEntry('quantity');return;}
  if(editingId||entry.itemId||entry.quantity){failEntry('أضف الإدخال الحالي أو امسحه قبل تعديل مادة أخرى.','quantity');return;}
  setEditingId(line.lineId);setEntry({itemId:line.itemId,quantity:line.quantity});setEntryError(null);setError('');setNotice('');focusEntry('quantity');
 }
 function removeLine(line:Line){setListVersion(v=>v+1);setLines(old=>old.filter(l=>l.lineId!==line.lineId));setError('');setNotice('حُذفت المادة من المستند.');if(editingId===line.lineId)clearEntry();else focusEntry('item');}
 function keyboard(e:KeyboardEvent<HTMLFormElement>){
  if(e.key==='Enter'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&!e.nativeEvent.isComposing&&e.target instanceof HTMLInputElement&&e.target.getAttribute('aria-label')==='كمية الصرف'){
   e.preventDefault();if(!e.repeat&&!busy)addEntry();
  }
 }
 function check(){
  if(snapshot.generation!==generation)return {message:'تغيّرت نسخة البيانات. أغلق المستند وافتحه مجدداً.'};
  if(!snapshot.kitchens?.some(k=>k.id===kitchenId&&k.active&&k.locationId!==location))return {message:'اختر مطبخًا نشطًا.',field:'المطبخ المستلم'};
  if(editingId||entry.itemId||entry.quantity)return {message:editingId?'احفظ تعديل الكمية أو ألغِه قبل حفظ المستند.':'أضف المادة الحالية إلى القائمة أو امسح الإدخال قبل حفظ المستند.',field:entry.itemId?'كمية الصرف':'مادة الصرف'};
  if(!lines.length)return {message:'أضف مادة واحدة على الأقل إلى القائمة.',field:'مادة الصرف'};
  const seen=new Set<string>();for(const line of lines){
   const item=items.find(i=>i.id===line.itemId);
   if(!item)return {message:'توجد مادة غير نشطة في القائمة؛ احذفها واختر مادة نشطة.'};
   if(seen.has(line.itemId))return {message:'المادة مكررة؛ احذف التكرار واجمع كميتها.'};seen.add(line.itemId);
   if(!quantitySchema.safeParse(normalizeNumber(line.quantity)).success)return {message:'عدّل كمية '+item.name+'؛ أدخل كمية موجبة.'};
   if(decimal(normalizeNumber(line.quantity)).gt(available(line.itemId)))return {message:'كمية '+item.name+' أكبر من الرصيد المتوقع المتاح؛ عدّلها من القائمة أو سجّل الاستلام أولًا.'};
  }return undefined;
 }
 async function submit(){if(locked.current)return;locked.current=true;setBusy(true);setError('');try{
  const kitchen=snapshot.kitchens!.find(k=>k.id===kitchenId)!;
  const doc=kitchenIssueSchema.parse({generation,operationId:operationId.current,organizationId:snapshot.organizationId,locationId:location,type:kitchen.locationId?'kitchen.transfer':'kitchen.issue',destinationLocationId:kitchen.locationId,kitchenId,kitchen:kitchen.name,businessDate,reference,notes,capturedAt:new Date().toISOString(),schemaVersion:1,currency:'EGP',lines:lines.map(l=>({...l,quantity:normalizeNumber(l.quantity),unitId:items.find(i=>i.id===l.itemId)!.unitId}))});
  await saveKitchenIssue(doc,initial?.id);saved(doc.operationId);
 }catch(e){setError(e instanceof Error&&e.name!=='ZodError'?e.message:'راجع بيانات المستند والكميات.');locked.current=false;}finally{setBusy(false);}}
 return <dialog ref={dialog} className="modal kitchen-issue-modal" aria-labelledby="kitchen-issue-title" onCancel={e=>{e.preventDefault();if(!busy)close();}}>
  <WorkflowForm className="kitchen-issue-form" busy={busy} error={error} onEdit={()=>setError('')} onInvalid={()=>{if(reference.trim().length===1||reference.length>100||notes.length>300)setShowNotes(true);}} documentCheck={check} onKeyDown={keyboard} onSubmit={()=>void submit()} header={<div className="modal-header kitchen-supply-header">
   <div className="kitchen-supply-title"><span className="eyebrow">صرف داخلي من <strong>{sourceName}</strong></span><h2 id="kitchen-issue-title">{initial?'تصحيح صرف مطبخ':'صرف مواد للمطبخ'}</h2><p>اختر المطبخ وأضف المواد. تُنقل بعد الحفظ وقبول المزامنة.</p><FormKeyboardHelp/></div>
   <div className="kitchen-supply-header-fields" role="group" aria-label="بيانات مستند الصرف">
    <label><span>المطبخ المستلم <span className="field-required" aria-hidden="true">*</span></span><SearchableSelect aria-label="المطبخ المستلم" aria-describedby="kitchen-recipient-hint" required disabled={busy} value={kitchenId} onChange={e=>setKitchenId(e.target.value)}><option value="">اختر أو ابحث عن المطبخ</option>{(snapshot.kitchens??[]).filter(k=>(k.active&&k.locationId!==location)||k.id===kitchenId).map(k=><option key={k.id} value={k.id} disabled={!k.active||k.locationId===location}>{k.name}{!k.active?' (محذوف)':''}</option>)}</SearchableSelect><small className="field-hint" id="kitchen-recipient-hint">تُضاف المواد إلى مخزون هذا المطبخ.</small></label>
    <label><span>تاريخ الصرف <span className="field-required" aria-hidden="true">*</span></span><FormInput aria-label="تاريخ الصرف" type="date" required disabled={busy} max={today()} value={businessDate} onChange={e=>setDate(e.target.value)}/></label>
    <div className="kitchen-supply-header-optional"><button type="button" className="text-button" disabled={busy} aria-label="تفاصيل إضافية للصرف" aria-expanded={showNotes} aria-controls="kitchen-issue-notes" onClick={e=>{const form=e.currentTarget.closest('form');setShowNotes(!showNotes);if(!showNotes)requestAnimationFrame(()=>focusControl(form?.querySelector<HTMLInputElement>('[aria-label="مرجع الصرف"]'),form));}}>تفاصيل إضافية <span aria-hidden="true">{showNotes?'⌃':'⌄'}</span></button><small className="optional-summary">{[reference,notes].filter(Boolean).join(' · ')||'مرجع وملاحظات · اختياري'}</small></div>
   </div>
   <div className="kitchen-supply-header-actions"><HelpButton topic="kitchenSupply"/><button type="button" className="icon-button" disabled={busy} aria-label="إغلاق صرف المطبخ" onClick={close}>×</button></div>
  </div>}>
   <div id="kitchen-issue-notes" className="kitchen-optional-fields" hidden={!showNotes}><label>مرجع الصرف <small>اختياري</small><FormInput aria-label="مرجع الصرف" minLength={2} maxLength={100} placeholder="مثال: وردية الغداء" value={reference} onChange={e=>setReference(e.target.value)}/></label><label>ملاحظات <small>اختياري</small><FormInput aria-label="ملاحظات صرف المطبخ" maxLength={300} placeholder="تفاصيل إضافية للمستلم…" value={notes} onChange={e=>setNotes(e.target.value)}/></label></div>
   <div className="kitchen-entry-workspace">
   <CollapsibleSection data-form-scroll className={'kitchen-entry-composer'+(editingId?' kitchen-entry-editing':'')} aria-labelledby="kitchen-entry-title">
    <div className="kitchen-material-heading"><div><h3 id="kitchen-entry-title">{editingId?'تعديل كمية المادة':'إضافة مادة للصرف'}</h3><p><kbd>Enter</kbd> لاختيار المادة، ثم بعد الكمية لإضافتها للقائمة. يعود المؤشر إلى بحث المواد.</p></div></div>
    <div className="kitchen-composer-row" key={editingId??entryVersion}>
     <label className="kitchen-item-field"><span>المادة</span><SearchableSelect aria-label="مادة الصرف" openOnFocus={!notice} value={entry.itemId} required={!!entry.quantity} disabled={!!editingId} aria-invalid={entryError?.field==='item'||undefined} aria-describedby={entryError?.field==='item'?'kitchen-entry-error':undefined} onChange={e=>{updateEntry('itemId',e.target.value);focusEntry('quantity');}} onSearchEnter={value=>{if(value){updateEntry('itemId',value);focusEntry('quantity');}else focusEntry('item');}}><option value="">ابحث باسم المادة أو الكود</option>{items.map(i=><option value={i.id} key={i.id}>{i.name} · {i.sku} · {i.unit}</option>)}</SearchableSelect></label>
     <label className="kitchen-quantity-field"><span>الكمية {selectedItem&&<small>({selectedItem.unit})</small>}</span><FormInput aria-label="كمية الصرف" inputMode="decimal" dir="ltr" placeholder="0.00" validateAs="positive" required={!!entry.itemId} value={entry.quantity} aria-invalid={entryError?.field==='quantity'||entryPreview?.status==='shortage'||undefined} aria-describedby="kitchen-entry-preview" onChange={e=>updateEntry('quantity',e.target.value)}/></label>
     <button data-keyboard-add type="button" className="primary kitchen-entry-add" onClick={addEntry}>{editingId?'حفظ التعديل':'إضافة للقائمة'} <kbd>↵</kbd></button>
    </div>
    <div id="kitchen-entry-preview" className="kitchen-entry-preview">{selectedItem?<><span>المتاح <strong>{number(available(selectedItem.id))} {selectedItem.unit}</strong></span>{existing&&<span>في القائمة <strong>{number(existing.quantity)} {selectedItem.unit}</strong> · تُضاف الكمية الجديدة إليها</span>}{entryPreview?.status==='ready'&&<span>المتبقي بعد الصرف <strong>{number(entryPreview.remaining!)} {selectedItem.unit}</strong></span>}{entryPreview?.status==='shortage'&&<span className="kitchen-entry-shortage">الإجمالي يتجاوز المتاح بـ <strong>{number(entryPreview.shortage!)} {selectedItem.unit}</strong></span>}</>:<span>اختر المادة لعرض وحدتها ورصيدها المتاح.</span>}{(entry.itemId||entry.quantity||editingId)&&<button type="button" className="text-button" onClick={clearEntry}>{editingId?'إلغاء التعديل':'مسح الإدخال'}</button>}</div>
    {entryError&&<p id="kitchen-entry-error" className="field-error" role="alert">{entryError.message}</p>}
    <p className="kitchen-entry-notice" role="status" aria-live="polite">{notice}</p>
   </CollapsibleSection>
   <CollapsibleSection className={'kitchen-receipt-section'+(lines.length<=10?' kitchen-compact-receipt':'')} aria-labelledby="kitchen-materials-title">
    <div className="kitchen-material-heading"><h3 id="kitchen-materials-title">قائمة مواد الصرف <span className="pill">{number(lines.length)} مادة</span></h3><span className="kitchen-receipt-order">افتراضيًا: آخر إضافة في الأعلى</span></div>
    <Collection rows={lines} title="مواد مستند الصرف" searchText={lines.length>10?l=>{const item=snapshot.items.find(i=>i.id===l.itemId);return (item?.name??l.itemId)+' '+(item?.sku??'');}:undefined} sorts={lines.length>10?amountSorts<Line>('quantity','الكمية',l=>l.quantity):[]} resetKey={String(listVersion)} rowIds={l=>[l.lineId]} emptyText={lines.length?'لا توجد مواد مطابقة للبحث.':'لم تُضف مواد بعد. اختر مادة وأدخل الكمية ثم اضغط Enter.'}>{page=><ol className="kitchen-receipt-list">{page.map(line=>{
     const item=snapshot.items.find(i=>i.id===line.itemId),q=available(line.itemId),preview=issueStockPreview(q,line.quantity),value=item?estimate(snapshot,[line],location):null,unitCost=value===null?null:decimal(value).div(line.quantity).toString();
     return <li key={line.lineId}><article className={'kitchen-receipt-line'+(preview.status==='shortage'?' kitchen-line-shortage':'')+(lastChanged===line.lineId?' kitchen-receipt-latest':'')} aria-label={'مادة بالقائمة '+(item?.name??line.itemId)}>
      <div className="kitchen-receipt-item"><strong>{item?.name??line.itemId}</strong><small><bdi>{item?.sku??'—'}</bdi> · {item?.category??'—'}</small><span>المتاح {number(q)} {item?.unit}{preview.status==='ready'&&<> · المتبقي {number(preview.remaining!)} {item?.unit}</>}</span></div>
      <dl className="kitchen-receipt-details"><div><dt>الكمية</dt><dd className="kitchen-receipt-quantity">{number(line.quantity)} <small>{item?.unit}</small></dd></div><div><dt>تكلفة الوحدة</dt><dd>{unitCost===null?'—':number(unitCost)+' ج.م'}</dd></div><div><dt>القيمة التقديرية</dt><dd>{value===null?'—':number(value)+' ج.م'}</dd></div></dl>
      <div className="kitchen-receipt-actions"><button type="button" className="text-button" aria-label={'تعديل كمية '+(item?.name??line.itemId)} onClick={()=>editLine(line)}>{editingId===line.lineId?'جارٍ التعديل':'تعديل'}</button><button type="button" className="text-button kitchen-receipt-remove" aria-label={'حذف '+(item?.name??line.itemId)+' من مستند الصرف'} onClick={()=>removeLine(line)}>حذف</button></div>
      {preview.status==='shortage'&&<p className="kitchen-stock-warning" role="status">الكمية تتجاوز المتاح بـ {number(preview.shortage!)} {item?.unit}. عدّل الكمية قبل الحفظ.</p>}
     </article></li>;
    })}</ol>}</Collection>
   </CollapsibleSection>
   </div>
   <div className="workflow-actions kitchen-issue-actions">
    <div className="kitchen-issue-total"><div><span>إجمالي تقديري · {number(lines.length)} مادة</span><strong>{total===null?'—':number(total)+' ج.م'}</strong></div><small>{total===null?(lines.length?'لا تتوفر تكلفة مؤكدة لبعض المواد؛ تُثبت القيمة بعد قبول المزامنة.':'يظهر بعد إضافة المواد إلى القائمة.'):'بمتوسط تكلفة المخزون الحالي؛ القيمة النهائية بعد القبول.'}</small>{shortageCount>0&&<span className="kitchen-shortage-count" role="status">راجع الكمية في {number(shortageCount)} مادة</span>}</div>
    <div className="kitchen-save-buttons"><button type="submit" className="primary">{busy?'جارٍ الحفظ…':'حفظ صرف المطبخ'}</button><button type="button" className="secondary" onClick={close}>إلغاء</button></div>
    <small className="kitchen-consumption-note">المواد تُنقل إلى مخزون المطبخ بقيمتها الحالية؛ الاستهلاك يحدث عند البيع أو الهالك.</small>
   </div>
  </WorkflowForm>
 </dialog>;
}

function KitchenIssuePrint({snapshot,row,close}:{snapshot:Snapshot;row:IssueRow;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);useEffect(()=>{dialog.current?.showModal();},[]);
 const d=row.document,p=row.posted;
 return <dialog ref={dialog} className="modal kitchen-print-modal" aria-labelledby="kitchen-print-title" onCancel={e=>{e.preventDefault();close();}}><div className="modal-header kitchen-no-print"><h2 id="kitchen-print-title">طباعة مستند صرف</h2><button type="button" className="icon-button" aria-label="إغلاق طباعة الصرف" onClick={close}>×</button></div><article className="kitchen-print-sheet" dir="rtl"><header>{snapshot.organizationProfile?.logoPath&&<img src={snapshot.organizationProfile.logoPath} alt=""/>}<div><h2>{snapshot.organizationName}</h2><h1>{d.type==='kitchen.transfer'?'مستند تحويل مخزون للمطبخ':'مستند استهلاك مواد للمطبخ'}</h1></div></header><p><bdi className="kitchen-number">{documentNumber(row.id)}</bdi></p><div className="kitchen-print-info"><p>المطبخ: <strong>{d.kitchen}</strong></p><p>التاريخ: {d.businessDate}</p><p>المخزن: {snapshot.locations.find(l=>l.id===d.locationId)?.name}</p><p>المرجع: {d.reference||'—'}</p></div>{!p&&<p className="kitchen-print-pending">غير مقبول بعد — حالة المزامنة: <OperationStatus status={row.status}/> · الكميات والتكلفة غير نهائية.</p>}<table><thead><tr><th>المادة</th><th>الكمية</th><th>الوحدة</th><th>تكلفة الوحدة</th><th>القيمة</th></tr></thead><tbody>{d.lines.map(l=>{const v=p?.lines.find(x=>x.lineId===l.lineId),item=snapshot.items.find(i=>i.id===l.itemId);return <tr key={l.lineId}><td>{v?.name??item?.name??l.itemId}</td><td>{number(l.quantity)}</td><td>{v?.unit??item?.unit}</td><td>{v?number(decimal(v.amount).div(l.quantity).toString()):'—'}</td><td>{v?number(v.amount):'—'}</td></tr>;})}</tbody></table><p className="kitchen-print-total">{d.type==='kitchen.transfer'?'قيمة المخزون المنقول':'قيمة الاستهلاك'}: <strong>{p?number(p.amount)+' ج.م':'تُثبت بعد قبول المزامنة'}</strong></p>{d.notes&&<p>ملاحظات: {d.notes}</p>}<p>{d.type==='kitchen.transfer'?'هذا تحويل مخزون؛ لا يحتسب استهلاكاً.':'المواد المصروفة في هذا المستند احتسبت استهلاكاً مباشراً.'}</p><div className="kitchen-signatures"><p>توقيع مسؤول المخزن: __________________</p><p>توقيع المستلم: __________________</p></div><footer>FooDo · مستند داخلي لصرف المواد</footer></article><div className="modal-actions kitchen-no-print"><button type="button" className="primary" onClick={()=>window.print()}>طباعة / حفظ PDF</button><button type="button" className="secondary" onClick={close}>إغلاق</button></div></dialog>;
}
