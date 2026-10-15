'use client';
import {HelpButton} from './ClientGuide';
import CollapsibleSection from './CollapsibleSection';
import {DocumentFields,DocumentSummary} from './DocumentForm';
import {focusControl,SearchableSelect,KeyboardForm,FormKeyboardHelp} from './FormControls';
import Collection,{syncStatusOptions} from './Collection';
import {operationLabels,OperationStatus,reviewFirst,DocumentLink} from './OperationStatus';
import {useEffect,useRef,useState,type FormEvent,type KeyboardEvent,type FocusEvent} from 'react';
import {receiptDocumentSchema,type ReceiptDocument,type Snapshot} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {receivingUnitFactor} from '../../../packages/domain/receiving';
import {normalizeNumber} from '../../../packages/domain/opening-import';
import {saveReceipt,resolveReceipt,type LocalReceipt} from './offline';
import {SetupEditor} from './InventorySetup';
import {commitReceivingEntry,type ReceivingLine} from './receiving-entry';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const number=(v:string|number)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:6}).format(Number(v));
const valid=(v:string)=>/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(v);
const statuses:Record<LocalReceipt['status'],string>=operationLabels;
export function ReceiptHistory({snapshot,location,rows,expired,synchronize,edit}:{snapshot:Snapshot;location?:string;rows:LocalReceipt[];expired:boolean;synchronize:()=>Promise<void>;edit:(row:LocalReceipt)=>void}){
 const [error,setError]=useState('');const docs=new Map(rows.map(r=>[r.id,r]));
 for(const posted of snapshot.receipts??[])docs.set(posted.document.operationId,{...docs.get(posted.document.operationId),id:posted.document.operationId,scope:snapshot.organizationId,document:posted.document,status:'accepted',error:undefined,createdAt:posted.postedAt});
 async function resolve(row:LocalReceipt,action:'retry'|'cancel'){try{setError('');await resolveReceipt(row.scope,row.id,action);if(action==='retry')await synchronize();}catch(e){setError(e instanceof Error?e.message:'تعذرت معالجة الاستلام');}}
 const visible=[...docs.values()].filter(r=>!location||r.document.locationId===location).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 return <CollapsibleSection className="panel"><div className="panel-heading"><div><h2>مستندات الاستلام المباشر</h2><p>استلام عدة مواد في مستند واحد، مع المورد أو بدونه.</p></div><span className="pill">{visible.length} مستند</span></div>{error&&<p role="alert" className="error">{error}</p>}<Collection rows={(reviewFirst(visible))??[]} title="مستندات الاستلام المباشر" resetKey={location??"all"} searchText={r=>[r.document.reason,snapshot.suppliers?.find(s=>s.id===r.document.supplierId)?.name,r.document.lines.map(l=>snapshot.items.find(i=>i.id===l.itemId)?.name).join(" ")].join(" ")} dateValue={r=>r.document.businessDate} filters={[{key:"status",label:"حالة المزامنة",value:r=>r.status,options:syncStatusOptions},{key:"supplier",label:"المورد",value:r=>r.document.supplierId??"none",options:[{value:"none",label:"بدون مورد"},...(snapshot.suppliers??[]).map(s=>({value:s.id,label:s.name}))]}]} rowIds={r=>[r.id]}>{pageRows=>pageRows.map(row=><details className="opening-document" key={row.id} id={`operation-${row.id}`} tabIndex={-1}><summary><strong>{row.document.reason||'استلام مواد'}</strong> · {row.document.businessDate} · {row.document.lines.length} مادة · {number(row.document.lines.reduce((s,l)=>s.add(decimal(l.quantity).mul(l.unitCost)),decimal('0')).toString())} ج.م <span className={'pill '+(row.status==='accepted'?'good':'warning')}><OperationStatus status={row.status}/></span></summary><p>الموقع: {snapshot.locations.find(l=>l.id===row.document.locationId)?.name??row.document.locationId}</p><p>المورد: {snapshot.suppliers?.find(s=>s.id===row.document.supplierId)?.name??'بدون مورد محدد'}</p><small dir="ltr">{row.id}</small><Collection rows={row.document.lines} title={"مواد الاستلام — "+(row.document.reason||row.id)} searchText={l=>snapshot.items.find(i=>i.id===l.itemId)?.name??l.itemId}>{pageRows=>(<div className="table-scroll"><table><thead><tr><th>المادة</th><th>كمية المخزون</th><th>تكلفة الوحدة</th><th>القيمة</th></tr></thead><tbody>{pageRows.map(l=><tr key={l.lineId}><td>{snapshot.items.find(i=>i.id===l.itemId)?.name??l.itemId}</td><td>{number(l.quantity)} {l.receivingUnit?.baseName??snapshot.units?.find(u=>u.id===l.unitId)?.name??l.unitId}{l.enteredQuantity&&<small className="setup-subline">{number(l.enteredQuantity)} {l.receivingUnit?.name??snapshot.items.find(i=>i.id===l.itemId)?.purchaseUnits?.find(p=>p.id===l.purchaseUnitId)?.name}{l.receivingUnit&&<> · ١ {l.receivingUnit.name} = {number(l.receivingUnit.factor)} {l.receivingUnit.baseName}</>}</small>}</td><td>{number(l.unitCost)}</td><td>{number(decimal(l.quantity).mul(l.unitCost).toString())}</td></tr>)}</tbody></table></div>)}</Collection>{row.error&&<p className="error" role="alert">{row.error}</p>}{row.replacesId&&<p>تصحيح للمستند: <span dir="ltr"><DocumentLink id={row.replacesId} view="activity" location={row.document.locationId} label={row.replacesId}/></span></p>}{row.replacementId&&<p>المستند البديل: <span dir="ltr"><DocumentLink id={row.replacementId} view="activity" location={row.document.locationId} label={row.replacementId}/></span></p>}{row.status==='needsReview'&&<div className="review-actions"><button className="secondary" disabled={expired} onClick={()=>void resolve(row,'retry')}>إعادة محاولة الاستلام</button><button className="secondary" disabled={expired} onClick={()=>edit(row)}>تصحيح الاستلام</button><button className="text-button" onClick={()=>void resolve(row,'cancel')}>إلغاء الاستلام المرفوض</button></div>}</details>)}</Collection></CollapsibleSection>;
}

type EditorLine=ReceivingLine;
export default function ReceiptDialog({snapshot,location,itemId,initial,close,saved,materialSaved}:{snapshot:Snapshot;location:string;itemId?:string;initial?:LocalReceipt;close:()=>void;saved:(id:string)=>void;materialSaved?:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),form=useRef<HTMLFormElement>(null),locked=useRef(false);
 const [createdItems,setCreatedItems]=useState<Snapshot['items']>([]);
 const catalog=[...snapshot.items,...createdItems.filter(item=>!snapshot.items.some(current=>current.id===item.id))];
 const items=catalog.filter(i=>i.active!==false&&i.unitId);
 const [newMaterial,setNewMaterial]=useState<{name:string}|null>(null);
 const fresh=(id=''):EditorLine=>({lineId:crypto.randomUUID(),itemId:id,selection:'',factor:'',enteredQuantity:'',unitCost:''});
 const [lines,setLines]=useState<EditorLine[]>(()=>initial?initial.document.lines.map(l=>({
  lineId:crypto.randomUUID(),itemId:l.itemId,
  selection:l.purchaseUnitId??(l.receivingUnit&&l.receivingUnit.unitId!==l.unitId?'unit:'+l.receivingUnit.unitId:''),
  factor:l.receivingUnit?.factor??'',enteredQuantity:l.enteredQuantity??l.quantity,unitCost:l.unitCost
 })):[]);
 const [entry,setEntry]=useState<EditorLine>(()=>fresh(itemId)),[editingId,setEditingId]=useState<string|null>(null);
 const [entrySubmitted,setEntrySubmitted]=useState(false),[entryVersion,setEntryVersion]=useState(0),[listVersion,setListVersion]=useState(0),[notice,setNotice]=useState(''),[lastChanged,setLastChanged]=useState('');
 const [businessDate,setDate]=useState(initial?.document.businessDate??today());
 const [reason,setReason]=useState(initial?.document.reason??''),[supplierId,setSupplier]=useState(initial?.document.supplierId??'');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [detailsOpen,setDetailsOpen]=useState(!!initial?.document.supplierId||!!initial?.document.reason);const listScroll=useRef<HTMLDivElement>(null),listHeading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{listHeading.current?.dispatchEvent(new CustomEvent('fodo:reveal-control',{bubbles:true}));listScroll.current?.scrollTo({top:0});},[listVersion]);
 const [touched,setTouched]=useState<Record<string,boolean>>({}),[submitted,setSubmitted]=useState(false);
 useEffect(()=>{dialog.current?.showModal();},[]);
 const fieldKey=(line:EditorLine,key:keyof EditorLine)=>'line:'+line.lineId+':'+key;
 const errorId=(key:string)=>'receipt-error-'+key.replaceAll(':','-');
 function focusEntry(key:keyof EditorLine='itemId'){
  requestAnimationFrame(()=>focusControl(form.current?.querySelector<HTMLInputElement|HTMLSelectElement>('[data-field="'+fieldKey(entry,key)+'"]:not([hidden])'),form.current));
 }
 function touch(key:string){setTouched(previous=>({...previous,[key]:true}));}
 function change(key:keyof EditorLine,value:string){
  setError('');setNotice('');
  setEntry(l=>({...l,[key]:value,...(key==='itemId'?{selection:'',factor:''}:key==='selection'?{factor:''}:{})}));
 }
 function selected(l:EditorLine){
  const item=catalog.find(i=>i.id===l.itemId);
  const unit=l.selection.startsWith('unit:')?snapshot.units?.find(u=>u.id===l.selection.slice(5)):undefined;
  const pack=item?.purchaseUnits?.find(p=>p.id===l.selection);
  const automatic=unit&&item?receivingUnitFactor(item.unit,unit.name):undefined;
  return {item,unit,pack,name:unit?.name??pack?.name??item?.unit,factor:unit?automatic??l.factor:pack?.factor??(l.selection?'':'1'),manual:!!unit&&automatic===undefined};
 }
 function base(l:EditorLine){
  const {factor}=selected(l);
  if(!valid(l.enteredQuantity)||!valid(factor)||decimal(l.enteredQuantity).lte(0)||decimal(factor).lte(0))return null;
  const quantity=decimal(l.enteredQuantity).mul(factor);
  return quantity.decimalPlaces()<=6&&quantity.lte('999999999.999999')?quantity:null;
 }
 function lineErrors(line:EditorLine){
  const choice=selected(line),errors:Record<string,string>={};
  if(!items.some(item=>item.id===line.itemId))errors[fieldKey(line,'itemId')]='اختر مادة نشطة لها وحدة مخزون محددة.';
  if(line.selection&&!choice.unit&&!choice.pack)errors[fieldKey(line,'selection')]='اختر وحدة استلام متاحة للصنف.';
  if(choice.manual&&(!valid(line.factor)||decimal(line.factor).lte(0)))errors[fieldKey(line,'factor')]='أدخل محتوى وحدة الاستلام بوحدة المخزون، أكبر من صفر.';
  if(!line.enteredQuantity)errors[fieldKey(line,'enteredQuantity')]='أدخل الكمية المستلمة.';
  else if(!valid(line.enteredQuantity)||decimal(line.enteredQuantity).lte(0))errors[fieldKey(line,'enteredQuantity')]='أدخل كمية أكبر من صفر، حتى ٦ منازل عشرية.';
  else if(valid(choice.factor)&&decimal(choice.factor).gt(0)&&!base(line))errors[fieldKey(line,'enteredQuantity')]='الكمية المحوّلة تتجاوز الحد المسموح أو ٦ منازل عشرية. قلّل الكمية أو راجع معامل التحويل.';
  if(!valid(line.unitCost))errors[fieldKey(line,'unitCost')]=line.unitCost?'أدخل تكلفة صحيحة حتى ٦ منازل عشرية؛ يمكن أن تكون صفراً.':'أدخل تكلفة وحدة المخزون؛ اكتب ٠ إذا كانت دون تكلفة.';
  return errors;
 }
 const total=lines.reduce((sum,line)=>{const quantity=base(line);return quantity&&valid(line.unitCost)?sum.add(quantity.mul(line.unitCost)):sum;},decimal('0'));
 const fieldErrors:Record<string,string>={};
 if(!businessDate||!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)||!Number.isFinite(Date.parse(businessDate)))fieldErrors.businessDate='اختر تاريخ الاستلام.';
 else if(businessDate>today())fieldErrors.businessDate='اختر اليوم أو تاريخاً سابقاً.';
 if(reason.trim()&&reason.trim().length<2)fieldErrors.reason='أدخل حرفين على الأقل أو اترك المرجع فارغاً.';
 else if(reason.trim().length>200)fieldErrors.reason='اختصر المرجع إلى ٢٠٠ حرف أو أقل.';
 const entryErrors=lineErrors(entry);
 const shownError=(key:string)=>key.startsWith('line:')?(entrySubmitted||touched[key]?entryErrors[key]:undefined):(submitted||touched[key]?fieldErrors[key]:undefined);
 function fieldProps(key:string){return {'data-field':key,'aria-invalid':!!shownError(key),'aria-describedby':shownError(key)?errorId(key):undefined,onBlur:(event:FocusEvent<HTMLInputElement|HTMLSelectElement>)=>{if(!(event.relatedTarget instanceof HTMLButtonElement))touch(key);}};}
 function fieldError(key:string){const message=shownError(key);return message?<small id={errorId(key)} className="field-error">{message}</small>:null;}
 const dirty=!!(editingId||entry.itemId||entry.enteredQuantity||entry.unitCost||entry.selection||entry.factor);
 function clearEntry(){
  setEntry(fresh());setEditingId(null);setEntrySubmitted(false);setTouched({});setEntryVersion(v=>v+1);setError('');
  requestAnimationFrame(()=>focusControl(form.current?.querySelector<HTMLInputElement>('input[aria-label="المادة"]'),form.current));
 }
 function addEntry(){
  if(busy||newMaterial)return;
  setEntrySubmitted(true);setError('');setNotice('');
  const invalidField=Object.keys(entryErrors)[0];
  if(invalidField){setError(entryErrors[invalidField]);requestAnimationFrame(()=>focusControl(form.current?.querySelector<HTMLInputElement|HTMLSelectElement>('[data-field="'+invalidField+'"]:not([hidden])'),form.current));return;}
  const result=commitReceivingEntry(lines,entry,l=>selected(l).factor,editingId);
  if(!result.ok){
   const messages={item:'اختر مادة من القائمة.',quantity:'الكمية الإجمالية تتجاوز الحد المسموح؛ راجع الكمية ومعامل التحويل.',factor:'أدخل معامل تحويل صحيحاً.',cost:'أدخل تكلفة وحدة المخزون.',incompatible:'المادة موجودة بوحدة استلام أو تكلفة مختلفة؛ عدّل سطرها بدلاً من إضافتها مرة أخرى.',capacity:'الحد الأقصى ٢٠٠ مادة مختلفة. عدّل مادة موجودة أو اجمع كميتها.', 'missing-edit':'المادة الجاري تعديلها لم تعد في القائمة؛ ألغِ التعديل واخترها مجدداً.'};
   setError(messages[result.reason]);focusEntry(result.reason==='item'?'itemId':result.reason==='cost'?'unitCost':'enteredQuantity');return;
  }
  setLines(result.lines);setLastChanged(result.line.lineId);setListVersion(v=>v+1);setDetailsOpen(false);
  clearEntry();setNotice((result.action==='merged'?'جُمعت الكمية مع المادة الموجودة':result.action==='updated'?'عُدلت المادة':'أُضيفت المادة')+' — '+selected(result.line).item?.name);
 }
 function editLine(line:EditorLine){
  if(editingId===line.lineId){focusEntry('enteredQuantity');return;}
  if(dirty){setError('أضف الإدخال الحالي أو امسحه قبل تعديل مادة أخرى.');focusEntry('enteredQuantity');return;}
  setEntry({...line});setEditingId(line.lineId);setEntrySubmitted(false);setTouched({});setEntryVersion(v=>v+1);setError('');setNotice('');
  requestAnimationFrame(()=>focusControl(form.current?.querySelector<HTMLInputElement>('input[aria-label^="الكمية ("]'),form.current));
 }
 function removeLine(line:EditorLine){
  setLines(rows=>rows.filter(l=>l.lineId!==line.lineId));setListVersion(v=>v+1);setError('');setNotice('حُذفت المادة من المستند.');
  if(editingId===line.lineId)clearEntry();
 }
 function keyboard(e:KeyboardEvent<HTMLFormElement>){
  if(e.key!=='Enter'||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||e.nativeEvent.isComposing||!(e.target instanceof HTMLInputElement))return;
  const key=e.target.dataset.field;
  if(key===fieldKey(entry,'unitCost')){e.preventDefault();if(!e.repeat)addEntry();}
  else if(key===fieldKey(entry,'enteredQuantity')){e.preventDefault();if(!e.repeat)focusEntry('unitCost');}
 }
 async function submit(e:FormEvent){
  e.preventDefault();if(locked.current||busy||newMaterial)return;
  setSubmitted(true);setError('');
  const invalidField=Object.keys(fieldErrors)[0];
  if(invalidField){setDetailsOpen(true);setError(fieldErrors[invalidField]);requestAnimationFrame(()=>focusControl(form.current?.querySelector<HTMLInputElement>('[data-field="'+invalidField+'"]'),form.current));return;}
  if(dirty){setError(editingId?'احفظ تعديل المادة أو ألغِه قبل حفظ المستند.':'أضف المادة الحالية إلى القائمة أو امسح الإدخال قبل حفظ المستند.');focusEntry(entry.itemId?'enteredQuantity':'itemId');return;}
  if(!lines.length){setError('أضف مادة واحدة على الأقل إلى القائمة.');focusEntry();return;}
  const invalidLine=lines.find(l=>Object.keys(lineErrors(l)).length>0);
  if(invalidLine){editLine(invalidLine);setEntrySubmitted(true);setError('راجع بيانات المادة: '+selected(invalidLine).item?.name);return;}
  locked.current=true;setBusy(true);
  try{
   const receiptLines=lines.map((l,index)=>{
    const choice=selected(l),quantity=base(l);
    if(!quantity)throw new Error('راجع كمية السطر '+(index+1)+' ومعامل التحويل.');
    return {lineId:l.lineId,itemId:l.itemId,unitId:choice.item?.unitId,quantity:quantity.toString(),unitCost:l.unitCost,purchaseUnitId:choice.pack?.id,
     receivingUnit:choice.unit?{unitId:choice.unit.id,name:choice.unit.name,baseName:choice.item?.unit,factor:choice.factor}:undefined,
     enteredQuantity:l.selection?l.enteredQuantity:undefined};
   });
   const document:ReceiptDocument=receiptDocumentSchema.parse({operationId:crypto.randomUUID(),organizationId:snapshot.organizationId,generation:snapshot.generation,locationId:location,type:'receipt.document',businessDate,reason,supplierId:supplierId||undefined,capturedAt:new Date().toISOString(),schemaVersion:1,currency:'EGP',lines:receiptLines});
   await saveReceipt(document,initial?.id);saved(document.operationId);
  }catch(e){locked.current=false;setError(e instanceof Error&&e.name!=='ZodError'?e.message:'راجع المواد والكميات وتكلفة وحدة المخزون.');}
  finally{setBusy(false);}
 }
 function returnToEntry(key:'itemId'|'enteredQuantity'){setNewMaterial(null);focusEntry(key);}
 const choice=selected(entry),quantity=base(entry),item=choice.item;
 return <><dialog ref={dialog} className="modal receipt-modal" aria-labelledby="receipt-title" onCancel={e=>{e.preventDefault();if(!busy&&!newMaterial)close();}}>
  <KeyboardForm busy={busy||!!newMaterial} ref={form} className="modal-form" noValidate onKeyDown={keyboard} onSubmit={e=>void submit(e)}>
   <div className="modal-header receiving-header"><div className="receiving-header-title"><span className="eyebrow">{snapshot.locations.find(l=>l.id===location)?.name}</span><h2 id="receipt-title">{initial?'تصحيح استلام مواد':'استلام مواد'}</h2><p>أضف المواد إلى القائمة، ثم احفظ مستند الاستلام.</p><FormKeyboardHelp/></div>
     <div className="receiving-document-essential receiving-header-details">
      <label><span className="form-label">تاريخ الاستلام <span className="field-required" aria-hidden="true">*</span></span><input aria-label="تاريخ الاستلام" type="date" required disabled={busy||!!newMaterial} max={today()} value={businessDate} {...fieldProps('businessDate')} onChange={e=>{setDate(e.target.value);setError('');}}/>{fieldError('businessDate')}</label>
      <div><button type="button" className="receiving-details-toggle" disabled={busy||!!newMaterial} aria-label="تفاصيل إضافية للاستلام" aria-expanded={detailsOpen} aria-controls="receiving-document-fields" onClick={()=>setDetailsOpen(open=>!open)}>تفاصيل إضافية <small>اختياري</small><span aria-hidden="true">{detailsOpen?'⌃':'⌄'}</span></button><small className="receiving-optional-summary">{supplierId?(snapshot.suppliers?.find(s=>s.id===supplierId)?.name??'مورد محدد'):'بدون مورد محدد'}{reason&&' · '+reason}</small></div>
     </div>
     <div className="receiving-header-actions"><HelpButton topic="receiving"/><button type="button" className="icon-button" disabled={busy||!!newMaterial} onClick={close} aria-label="إغلاق">×</button></div>
   </div>
   <div className="modal-body"><fieldset disabled={busy||!!newMaterial} className="receipt-fields form-fields">
    <section id="receiving-document-fields" hidden={!detailsOpen} className="form-section receipt-document-section" aria-label="بيانات الاستلام الإضافية">
     <DocumentFields collapsible={false} columns={2}>
      <label><span className="form-label">المورد <small>اختياري</small></span><select aria-label="المورد" value={supplierId} onChange={e=>{setSupplier(e.target.value);setError('');}}><option value="">بدون مورد محدد</option>{snapshot.suppliers?.filter(s=>s.active||s.id===supplierId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label><span className="form-label">مرجع الاستلام <small>اختياري</small></span><input aria-label="مرجع الاستلام" minLength={2} maxLength={200} placeholder="فاتورة ١٢٣ أو توريد اليوم" value={reason} {...fieldProps('reason')} onChange={e=>{setReason(e.target.value);setError('');}}/>{fieldError('reason')}</label>
     </DocumentFields>
    </section>
    <div className="receiving-workspace">
    <CollapsibleSection data-form-scroll key={entryVersion} className={'receiving-composer'+(editingId?' receiving-composer-editing':'')} aria-labelledby="receiving-entry-title">
     <div className="form-section-heading"><div><h3 id="receiving-entry-title">{editingId?'تعديل المادة':'إضافة مادة'}</h3><p className="field-hint">المادة ← الكمية ← التكلفة ← Enter للإضافة.</p></div>{editingId&&<span className="pill warning">تعديل</span>}<button type="button" className="text-button receiving-show-list" onClick={()=>{listHeading.current?.dispatchEvent(new CustomEvent('fodo:reveal-control',{bubbles:true}));listHeading.current?.focus({preventScroll:true});listHeading.current?.scrollIntoView({block:'start',behavior:'smooth'});}}>عرض القائمة ({number(lines.length)})</button></div>
     <div className="receiving-composer-main">
      <label><span className="form-label">المادة <span className="field-required" aria-hidden="true">*</span></span><SearchableSelect aria-label="المادة" openOnFocus={!notice} value={entry.itemId} disabled={!!editingId} {...fieldProps(fieldKey(entry,'itemId'))} onCreate={name=>setNewMaterial({name})} onSearchEnter={()=>focusEntry('enteredQuantity')} onChange={e=>{change('itemId',e.target.value);focusEntry('enteredQuantity');}}>{items.map(i=><option key={i.id} value={i.id}>{i.name} · {i.sku} · {i.unit}</option>)}</SearchableSelect>{fieldError(fieldKey(entry,'itemId'))}</label>
      <label><span className="form-label">الكمية <span className="field-required" aria-hidden="true">*</span></span><input aria-label={'الكمية ('+(choice.name??'وحدة الاستلام')+')'} inputMode="decimal" dir="ltr" placeholder="0.00" value={entry.enteredQuantity} {...fieldProps(fieldKey(entry,'enteredQuantity'))} onChange={e=>change('enteredQuantity',normalizeNumber(e.target.value))}/>{choice.name&&<small className="field-hint">{choice.name}</small>}{fieldError(fieldKey(entry,'enteredQuantity'))}</label>
     </div>
     <div className="receiving-composer-details">
      <label><span className="form-label">وحدة الاستلام</span><select aria-label="وحدة الاستلام" disabled={!item} value={entry.selection} {...fieldProps(fieldKey(entry,'selection'))} onChange={e=>change('selection',e.target.value)}>
       <option value="">{item?.unit??'اختر المادة أولاً'} · وحدة المخزون</option>
       <optgroup label="وحدات المخزون">{snapshot.units?.filter(u=>u.id!==item?.unitId).map(u=><option key={u.id} value={'unit:'+u.id}>{u.name}</option>)}</optgroup>
       {!!item?.purchaseUnits?.length&&<optgroup label="عبوات شراء الصنف">{item.purchaseUnits.map(p=><option key={p.id} value={p.id}>{p.name} · {p.factor} {item.unit}</option>)}</optgroup>}
      </select>{fieldError(fieldKey(entry,'selection'))}</label>
      {choice.manual&&<label><span className="form-label">محتوى وحدة الاستلام ({item?.unit}) *</span><input aria-label="محتوى وحدة الاستلام" inputMode="decimal" dir="ltr" placeholder="مثال: ٥" value={entry.factor} {...fieldProps(fieldKey(entry,'factor'))} onChange={e=>change('factor',normalizeNumber(e.target.value))}/><small className="field-hint">١ {choice.name} = كم {item?.unit}؟</small>{fieldError(fieldKey(entry,'factor'))}</label>}
      <label><span className="form-label">تكلفة الوحدة (ج.م) <span className="field-required" aria-hidden="true">*</span></span><input aria-label="تكلفة الوحدة (ج.م)" inputMode="decimal" dir="ltr" placeholder="0.00" value={entry.unitCost} {...fieldProps(fieldKey(entry,'unitCost'))} onChange={e=>change('unitCost',normalizeNumber(e.target.value))}/><small className="field-hint">لكل {item?.unit??'وحدة مخزون'}</small>{fieldError(fieldKey(entry,'unitCost'))}</label>
      <button data-keyboard-add type="button" className="primary receiving-entry-add" onClick={addEntry}>{editingId?'حفظ تعديل المادة':'إضافة إلى القائمة'} <kbd aria-hidden="true">↵</kbd></button>
     </div>
     {(choice.unit||choice.pack)&&!choice.manual&&<p className="field-hint receiving-conversion">تحويل تلقائي: ١ {choice.name} = {number(choice.factor)} {item?.unit}</p>}
     <div className="receiving-entry-preview">{item&&<><span>إضافة للمخزون: <strong>{quantity?number(quantity.toString()):'—'} {item.unit}</strong></span><span>قيمة المادة: <strong>{quantity&&valid(entry.unitCost)?number(quantity.mul(entry.unitCost).toString())+' ج.م':'—'}</strong></span></>}{dirty&&<button type="button" className="text-button" onClick={clearEntry}>{editingId?'إلغاء تعديل المادة':'مسح الإدخال'}</button>}</div>
     <p role="status" aria-live="polite" className="kitchen-entry-notice">{notice}</p>
    </CollapsibleSection>
    <CollapsibleSection className={'form-section receipt-items-section kitchen-receipt-section receiving-receipt-pane'+(lines.length<=10?' kitchen-compact-receipt':'')} aria-labelledby="receipt-items-title">
     <div className="form-section-heading"><h3 ref={listHeading} tabIndex={-1} id="receipt-items-title">المواد المستلمة <span className="pill">{number(lines.length)} مادة</span></h3><small className="kitchen-receipt-order">آخر مادة مضافة أولاً</small></div>
     <div ref={listScroll} className="receiving-list-scroll"><Collection rows={lines} title="المواد المستلمة" pageSize={10} resetKey={String(listVersion)} searchText={l=>{const i=selected(l).item;return [i?.name,i?.sku,i?.category].join(' ');}} sortText={l=>selected(l).item?.name??''} rowIds={l=>[l.lineId]} emptyText="أضف المواد من الحقول بالأعلى؛ ستظهر هنا قبل حفظ المستند.">{pageRows=><ol className="kitchen-receipt-list">{pageRows.map(l=>{
      const c=selected(l),q=base(l),amount=q&&valid(l.unitCost)?q.mul(l.unitCost):null;
      return <li key={l.lineId}><article data-receiving-line={l.lineId} className={'kitchen-receipt-line'+(lastChanged===l.lineId?' kitchen-receipt-latest':'')} aria-label={'مادة الاستلام: '+c.item?.name}>
       <div className="kitchen-receipt-item"><strong>{c.item?.name??l.itemId}</strong><small>{c.item?.sku} · {c.item?.category}</small><span>الرصيد بعد القبول، تقديري: {q?number(decimal(snapshot.balances.find(b=>b.locationId===location&&b.itemId===l.itemId)?.quantity??'0').add(q).toString()):'—'} {c.item?.unit}</span></div>
       <dl className="kitchen-receipt-details"><div><dt>الكمية المستلمة</dt><dd className="kitchen-receipt-quantity">{number(l.enteredQuantity)} <small>{c.name}</small></dd>{l.selection&&<small className="field-hint">{q?number(q.toString()):'—'} {c.item?.unit} للمخزون · ١ {c.name} = {number(c.factor)} {c.item?.unit}</small>}</div><div><dt>تكلفة وحدة المخزون</dt><dd>{number(l.unitCost)} ج.م / {c.item?.unit}</dd></div><div><dt>قيمة المادة</dt><dd>{amount?number(amount.toString()):'—'} ج.م</dd></div></dl>
       <div className="kitchen-receipt-actions"><button type="button" className="text-button" aria-label={'تعديل '+c.item?.name} onClick={()=>editLine(l)}>تعديل</button><button type="button" className="text-button kitchen-receipt-remove" aria-label={'حذف '+c.item?.name} onClick={()=>removeLine(l)}>حذف</button></div>
      </article></li>;
     })}</ol>}</Collection></div>
    </CollapsibleSection>
    </div>
   </fieldset></div>
   <div className="modal-footer">
    {error&&<p className="error form-error-summary" role="alert">{error}</p>}
    <div className="document-actions"><DocumentSummary label="إجمالي الاستلام المتوقع" value={number(total.toString())+' ج.م'} detail={number(lines.length)+' مادة · يُحدّث الرصيد بعد قبول المستند بالمزامنة'}/><div className="document-buttons"><div className="modal-actions"><button type="submit" className="primary" disabled={busy||!!newMaterial}>{busy?'جارٍ الحفظ…':'حفظ الاستلام'}</button><button type="button" className="secondary" disabled={busy||!!newMaterial} onClick={close}>إلغاء</button></div></div></div>
   </div>
  </KeyboardForm>
 </dialog>{newMaterial&&<SetupEditor section="items" snapshot={snapshot} composeAvailable={false} saved={()=>{}} close={()=>returnToEntry('itemId')} quickCreate={{name:newMaterial.name,created:record=>{
  setCreatedItems(previous=>[...previous,{...record,unit:snapshot.units?.find(unit=>unit.id===record.unitId)?.name??''}]);
  change('itemId',record.id);returnToEntry('enteredQuantity');materialSaved?.();
 }}}/>}</>;
}
