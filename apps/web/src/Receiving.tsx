'use client';
import {SearchableSelect} from './FormControls';
import {operationLabels,OperationStatus,reviewFirst,DocumentLink} from './OperationStatus';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {receiptDocumentSchema,type ReceiptDocument,type Snapshot} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {receivingUnitFactor} from '../../../packages/domain/receiving';
import {normalizeNumber} from '../../../packages/domain/opening-import';
import {saveReceipt,resolveReceipt,type LocalReceipt} from './offline';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const number=(v:string|number)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:6}).format(Number(v));
const valid=(v:string)=>/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(v);
const statuses:Record<LocalReceipt['status'],string>=operationLabels;
export function ReceiptHistory({snapshot,location,rows,expired,synchronize,edit}:{snapshot:Snapshot;location?:string;rows:LocalReceipt[];expired:boolean;synchronize:()=>Promise<void>;edit:(row:LocalReceipt)=>void}){
 const [error,setError]=useState('');const docs=new Map(rows.map(r=>[r.id,r]));
 for(const posted of snapshot.receipts??[])docs.set(posted.document.operationId,{...docs.get(posted.document.operationId),id:posted.document.operationId,scope:snapshot.organizationId,document:posted.document,status:'accepted',error:undefined,createdAt:posted.postedAt});
 async function resolve(row:LocalReceipt,action:'retry'|'cancel'){try{setError('');await resolveReceipt(row.scope,row.id,action);if(action==='retry')await synchronize();}catch(e){setError(e instanceof Error?e.message:'تعذرت معالجة الاستلام');}}
 const visible=[...docs.values()].filter(r=>!location||r.document.locationId===location).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 return <section className="panel"><div className="panel-heading"><div><h2>مستندات الاستلام المباشر</h2><p>استلام عدة مواد في مستند واحد، مع المورد أو بدونه.</p></div><span className="pill">{visible.length} مستند</span></div>{error&&<p role="alert" className="error">{error}</p>}{!visible.length&&<p className="empty">ستظهر مستندات الاستلام المحفوظة هنا.</p>}{reviewFirst(visible).map(row=><details className="opening-document" key={row.id} id={`operation-${row.id}`} tabIndex={-1}><summary><strong>{row.document.reason}</strong> · {row.document.businessDate} · {row.document.lines.length} مادة · {number(row.document.lines.reduce((s,l)=>s.add(decimal(l.quantity).mul(l.unitCost)),decimal('0')).toString())} ج.م <span className={'pill '+(row.status==='accepted'?'good':'warning')}><OperationStatus status={row.status}/></span></summary><p>الموقع: {snapshot.locations.find(l=>l.id===row.document.locationId)?.name??row.document.locationId}</p><p>المورد: {snapshot.suppliers?.find(s=>s.id===row.document.supplierId)?.name??'بدون مورد محدد'}</p><small dir="ltr">{row.id}</small><div className="table-scroll"><table><thead><tr><th>المادة</th><th>كمية المخزون</th><th>تكلفة الوحدة</th><th>القيمة</th></tr></thead><tbody>{row.document.lines.map(l=><tr key={l.lineId}><td>{snapshot.items.find(i=>i.id===l.itemId)?.name??l.itemId}</td><td>{number(l.quantity)} {l.receivingUnit?.baseName??snapshot.units?.find(u=>u.id===l.unitId)?.name??l.unitId}{l.enteredQuantity&&<small className="setup-subline">{number(l.enteredQuantity)} {l.receivingUnit?.name??snapshot.items.find(i=>i.id===l.itemId)?.purchaseUnits?.find(p=>p.id===l.purchaseUnitId)?.name}{l.receivingUnit&&<> · ١ {l.receivingUnit.name} = {number(l.receivingUnit.factor)} {l.receivingUnit.baseName}</>}</small>}</td><td>{number(l.unitCost)}</td><td>{number(decimal(l.quantity).mul(l.unitCost).toString())}</td></tr>)}</tbody></table></div>{row.error&&<p className="error" role="alert">{row.error}</p>}{row.replacesId&&<p>تصحيح للمستند: <span dir="ltr"><DocumentLink id={row.replacesId} view="activity" location={row.document.locationId} label={row.replacesId}/></span></p>}{row.replacementId&&<p>المستند البديل: <span dir="ltr"><DocumentLink id={row.replacementId} view="activity" location={row.document.locationId} label={row.replacementId}/></span></p>}{row.status==='needsReview'&&<div className="review-actions"><button className="secondary" disabled={expired} onClick={()=>void resolve(row,'retry')}>إعادة محاولة الاستلام</button><button className="secondary" disabled={expired} onClick={()=>edit(row)}>تصحيح الاستلام</button><button className="text-button" onClick={()=>void resolve(row,'cancel')}>إلغاء الاستلام المرفوض</button></div>}</details>)}</section>;
}
type EditorLine={lineId:string;itemId:string;selection:string;factor:string;enteredQuantity:string;unitCost:string};
export default function ReceiptDialog({snapshot,location,itemId,initial,close,saved}:{snapshot:Snapshot;location:string;itemId?:string;initial?:LocalReceipt;close:()=>void;saved:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const form=useRef<HTMLFormElement>(null);
 const items=snapshot.items.filter(i=>i.active!==false);
 const fresh=(id=items[0]?.id??''):EditorLine=>({lineId:crypto.randomUUID(),itemId:id,selection:'',factor:'',enteredQuantity:'',unitCost:''});
 const [lines,setLines]=useState<EditorLine[]>(()=>initial?initial.document.lines.map(l=>({
  lineId:crypto.randomUUID(),itemId:l.itemId,
  selection:l.purchaseUnitId??(l.receivingUnit&&l.receivingUnit.unitId!==l.unitId?'unit:'+l.receivingUnit.unitId:''),
  factor:l.receivingUnit?.factor??'',enteredQuantity:l.enteredQuantity??l.quantity,unitCost:l.unitCost
 })):[fresh(itemId)]);
 const [businessDate,setDate]=useState(initial?.document.businessDate??today());
 const [reason,setReason]=useState(initial?.document.reason??'');
 const [supplierId,setSupplier]=useState(initial?.document.supplierId??'');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [touched,setTouched]=useState<Record<string,boolean>>({});
 const [submitted,setSubmitted]=useState(false);
 useEffect(()=>{dialog.current?.showModal();},[]);
 const fieldKey=(line:EditorLine,key:keyof EditorLine)=>`line:${line.lineId}:${key}`;
 const errorId=(key:string)=>`receipt-error-${key.replaceAll(':','-')}`;
 function touch(key:string){setTouched(previous=>({...previous,[key]:true}));}
 function change(id:string,key:keyof EditorLine,value:string){
  setError('');
  setLines(rows=>rows.map(l=>l.lineId===id?{...l,[key]:value,...(key==='itemId'?{selection:'',factor:''}:key==='selection'?{factor:''}:{})}:l));
 }
 function selected(l:EditorLine){
  const item=snapshot.items.find(i=>i.id===l.itemId);
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
 const total=lines.reduce((sum,line)=>{const quantity=base(line);return quantity&&valid(line.unitCost)?sum.add(quantity.mul(line.unitCost)):sum;},decimal('0'));
 const fieldErrors:Record<string,string>={};
 if(!businessDate||!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)||!Number.isFinite(Date.parse(businessDate)))fieldErrors.businessDate='اختر تاريخ الاستلام.';
 else if(businessDate>today())fieldErrors.businessDate='اختر اليوم أو تاريخاً سابقاً.';
 if(reason.trim().length<2)fieldErrors.reason='أدخل رقم الفاتورة أو مرجعاً من حرفين على الأقل.';
 else if(reason.trim().length>200)fieldErrors.reason='اختصر المرجع إلى ٢٠٠ حرف أو أقل.';
 lines.forEach((line,index)=>{
  const choice=selected(line);
  if(!choice.item?.unitId)fieldErrors[fieldKey(line,'itemId')]='اختر مادة لها وحدة مخزون محددة.';
  else if(lines.slice(0,index).some(previous=>previous.itemId===line.itemId))fieldErrors[fieldKey(line,'itemId')]='المادة مضافة بالفعل؛ عدّل كميتها في سطرها.';
  if(line.selection&&!choice.unit&&!choice.pack)fieldErrors[fieldKey(line,'selection')]='اختر وحدة استلام متاحة للصنف.';
  if(choice.manual&&(!valid(line.factor)||decimal(line.factor).lte(0)))fieldErrors[fieldKey(line,'factor')]=`أدخل محتوى ١ ${choice.name} بوحدة ${choice.item?.unit}، أكبر من صفر.`;
  if(!line.enteredQuantity)fieldErrors[fieldKey(line,'enteredQuantity')]='أدخل الكمية المستلمة.';
  else if(!valid(line.enteredQuantity)||decimal(line.enteredQuantity).lte(0))fieldErrors[fieldKey(line,'enteredQuantity')]='أدخل كمية أكبر من صفر، حتى ٦ منازل عشرية.';
  else if(valid(choice.factor)&&decimal(choice.factor).gt(0)&&!base(line))fieldErrors[fieldKey(line,'enteredQuantity')]='الكمية المحوّلة تتجاوز الحد المسموح أو ٦ منازل عشرية. قلّل الكمية أو راجع معامل التحويل.';
  if(!valid(line.unitCost))fieldErrors[fieldKey(line,'unitCost')]=line.unitCost?'أدخل تكلفة صحيحة حتى ٦ منازل عشرية؛ يمكن أن تكون صفراً.':'أدخل تكلفة وحدة المخزون؛ اكتب ٠ إذا كانت دون تكلفة.';
 });
 const shownError=(key:string)=>(submitted||touched[key])?fieldErrors[key]:undefined;
 function fieldProps(key:string){return {'data-field':key,'aria-invalid':!!shownError(key),'aria-describedby':shownError(key)?errorId(key):undefined,onBlur:()=>touch(key)};}
 function fieldError(key:string){const message=shownError(key);return message?<small id={errorId(key)} className="field-error">{message}</small>:null;}
 async function submit(e:FormEvent){
  e.preventDefault();if(busy)return;
  setSubmitted(true);setError('');
  const invalidField=Object.keys(fieldErrors)[0];
  if(invalidField){
   const lineIndex=lines.findIndex(line=>invalidField.startsWith(`line:${line.lineId}:`));
   setError(`${lineIndex<0?'راجع بيانات المستند':`راجع السطر ${lineIndex+1}`}: ${fieldErrors[invalidField]}`);
   requestAnimationFrame(()=>form.current?.querySelector<HTMLInputElement|HTMLSelectElement>(`[data-field="${invalidField}"]`)?.focus());
   return;
  }
  setBusy(true);
  try{
   const receiptLines=lines.map((l,index)=>{
    const choice=selected(l),quantity=base(l);
    if(!quantity)throw new Error(`راجع كمية السطر ${index+1} ومعامل التحويل: كمية موجبة حتى ٦ منازل عشرية في وحدة المخزون.`);
    return {lineId:l.lineId,itemId:l.itemId,unitId:choice.item?.unitId,quantity:quantity.toString(),unitCost:l.unitCost,
     purchaseUnitId:choice.pack?.id,
     receivingUnit:choice.unit?{unitId:choice.unit.id,name:choice.unit.name,baseName:choice.item?.unit,factor:choice.factor}:undefined,
     enteredQuantity:l.selection?l.enteredQuantity:undefined};
   });
   const document:ReceiptDocument=receiptDocumentSchema.parse({operationId:crypto.randomUUID(),organizationId:snapshot.organizationId,generation:snapshot.generation,locationId:location,type:'receipt.document',businessDate,reason,supplierId:supplierId||undefined,capturedAt:new Date().toISOString(),schemaVersion:1,currency:'EGP',lines:receiptLines});
   await saveReceipt(document,initial?.id);saved();
  }catch(e){setError(e instanceof Error&&e.name!=='ZodError'?e.message:'راجع كل السطور: مواد مختلفة، كمية موجبة وتكلفة صحيحة حتى ٦ منازل عشرية.');}
  finally{setBusy(false);}
 }
 return <dialog ref={dialog} className="modal receipt-modal" aria-labelledby="receipt-title" onCancel={e=>{e.preventDefault();if(!busy)close();}}>
  <div className="modal-header"><div><span className="eyebrow">{snapshot.locations.find(l=>l.id===location)?.name}</span><h2 id="receipt-title">{initial?'تصحيح استلام مواد':'استلام مواد'}</h2><p>سجّل المواد المستلمة وكمياتها في مستند واحد.</p></div><button type="button" className="icon-button" disabled={busy} onClick={close} aria-label="إغلاق">×</button></div>
  <form ref={form} className="modal-form" noValidate onSubmit={e=>void submit(e)}>
   <div className="modal-body"><fieldset disabled={busy} className="receipt-fields form-fields">
    <section className="form-section receipt-document-section" aria-labelledby="receipt-details-title">
     <div className="form-section-heading"><h3 id="receipt-details-title">بيانات المستند</h3><small>الحقول المعلّمة بـ * مطلوبة</small></div>
     <div className="form-row">
      <label><span className="receipt-field-label">المورد <small>اختياري</small></span><select aria-label="المورد" value={supplierId} onChange={e=>{setSupplier(e.target.value);setError('');}}><option value="">بدون مورد محدد</option>{snapshot.suppliers?.filter(s=>s.active||s.id===supplierId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><small className="field-hint">يمكن حفظ الاستلام دون اختيار مورد.</small></label>
      <label><span className="receipt-field-label">تاريخ الاستلام <span className="field-required" aria-hidden="true">*</span></span><input aria-label="تاريخ الاستلام" type="date" required max={today()} value={businessDate} {...fieldProps('businessDate')} onChange={e=>{setDate(e.target.value);setError('');}}/>{fieldError('businessDate')}</label>
     </div>
     <label><span className="receipt-field-label">مرجع الاستلام <span className="field-required" aria-hidden="true">*</span></span><input autoFocus aria-label="مرجع الاستلام" required minLength={2} maxLength={200} placeholder="مثال: فاتورة ١٢٣ أو توريد اليوم" value={reason} {...fieldProps('reason')} onChange={e=>{setReason(e.target.value);setError('');}}/><small className="field-hint">مرجع يساعدك على العثور على هذا المستند لاحقاً.</small>{fieldError('reason')}</label>
    </section>
    <section className="form-section receipt-items-section" aria-labelledby="receipt-items-title">
     <div className="form-section-heading"><div><h3 id="receipt-items-title">المواد المستلمة</h3><p className="field-hint">اختر وحدة الاستلام؛ تُحوّل الكمية إلى وحدة المخزون لكل مادة.</p></div><span className="pill">{lines.length} مادة</span></div>
     <div className="receipt-lines">{lines.map((l,index)=>{
      const choice=selected(l),{item,unit,pack,name,factor,manual}=choice,quantity=base(l);
      return <fieldset className="receipt-line" key={l.lineId}><legend>المادة {index+1}</legend>
       <div className="form-row">
        <label><span className="receipt-field-label">المادة <span className="field-required" aria-hidden="true">*</span></span><SearchableSelect aria-label={index===0?'المادة':`مادة السطر ${index+1}`} required value={l.itemId} {...fieldProps(fieldKey(l,'itemId'))} onChange={e=>change(l.lineId,'itemId',e.target.value)}>{items.map(i=><option key={i.id} value={i.id} disabled={lines.some(x=>x.lineId!==l.lineId&&x.itemId===i.id)}>{i.name} · {i.sku} · {i.unit}</option>)}</SearchableSelect><small className="field-hint">كود الصنف: <bdi>{item?.sku??'—'}</bdi></small>{fieldError(fieldKey(l,'itemId'))}</label>
        <label><span className="receipt-field-label">وحدة الاستلام</span><select aria-label={index===0?'وحدة الاستلام':`وحدة السطر ${index+1}`} value={l.selection} {...fieldProps(fieldKey(l,'selection'))} onChange={e=>change(l.lineId,'selection',e.target.value)}>
         <option value="">{item?.unit} · وحدة المخزون</option>
         <optgroup label="وحدات المخزون">{snapshot.units?.filter(u=>u.id!==item?.unitId).map(u=><option key={u.id} value={'unit:'+u.id}>{u.name}</option>)}</optgroup>
         {!!item?.purchaseUnits?.length&&<optgroup label="عبوات شراء الصنف">{item.purchaseUnits.map(p=><option key={p.id} value={p.id}>{p.name} · {p.factor} {item.unit}</option>)}</optgroup>}
        </select><small className="field-hint">جميع الوحدات المسجلة وعبوات شراء الصنف.</small>{fieldError(fieldKey(l,'selection'))}</label>
       </div>
       {manual?<label className="receipt-conversion-field"><span className="receipt-field-label">محتوى وحدة الاستلام ({item?.unit}) <span className="field-required" aria-hidden="true">*</span></span><small className="field-hint">١ {name} = كم {item?.unit}؟ أدخل محتوى العبوة لهذا الاستلام.</small><input aria-label={index===0?'محتوى وحدة الاستلام':`محتوى وحدة السطر ${index+1}`} required inputMode="decimal" dir="ltr" value={l.factor} placeholder="مثال: ٥" {...fieldProps(fieldKey(l,'factor'))} onChange={e=>change(l.lineId,'factor',normalizeNumber(e.target.value))}/>{fieldError(fieldKey(l,'factor'))}</label>
        :(unit||pack)&&<p className="receipt-conversion-note field-hint">تحويل تلقائي: ١ {name} = {number(factor)} {item?.unit}</p>}
       <div className="form-row">
        <label><span className="receipt-field-label">الكمية ({name}) <span className="field-required" aria-hidden="true">*</span></span><input aria-label={index===0?`الكمية (${name})`:`كمية السطر ${index+1}`} required inputMode="decimal" dir="ltr" placeholder="0.00" value={l.enteredQuantity} {...fieldProps(fieldKey(l,'enteredQuantity'))} onChange={e=>change(l.lineId,'enteredQuantity',normalizeNumber(e.target.value))}/>{fieldError(fieldKey(l,'enteredQuantity'))}</label>
        <label><span className="receipt-field-label">تكلفة الوحدة (ج.م) <span className="field-required" aria-hidden="true">*</span></span><input aria-label={index===0?'تكلفة الوحدة (ج.م)':`تكلفة السطر ${index+1}`} required inputMode="decimal" dir="ltr" placeholder="0.00" value={l.unitCost} {...fieldProps(fieldKey(l,'unitCost'))} onChange={e=>change(l.lineId,'unitCost',normalizeNumber(e.target.value))}/><small className="field-hint">السعر لكل ١ {item?.unit} من وحدة المخزون، حتى عند الاستلام بعبوة.</small>{fieldError(fieldKey(l,'unitCost'))}</label>
       </div>
       <div className="receipt-line-footer"><div className="receipt-line-summary"><div className="receipt-summary-value"><small>كمية المخزون</small><strong>{quantity?number(quantity.toString()):'—'} {item?.unit}</strong></div><div className="receipt-summary-value"><small>قيمة المادة</small><strong>{quantity&&valid(l.unitCost)?number(quantity.mul(l.unitCost).toString())+' ج.م':'—'}</strong></div></div><button type="button" className="text-button" disabled={lines.length===1} aria-label={`حذف السطر ${index+1}`} onClick={()=>{setLines(lines.filter(x=>x.lineId!==l.lineId));setError('');}}>حذف</button></div>
      </fieldset>;
     })}</div>
     <button type="button" className="secondary" disabled={lines.length>=200||lines.length>=items.length} onClick={()=>{setLines([...lines,fresh(items.find(i=>!lines.some(l=>l.itemId===i.id))?.id)]);setError('');}}>إضافة مادة أخرى</button>
    </section>
   </fieldset></div>
   <div className="modal-footer">
    <div className="operation-summary"><span>إجمالي الاستلام المتوقع · {lines.length} مادة</span><strong>{number(total.toString())} ج.م</strong></div>
    <p className="field-hint">يُحفظ على هذا الجهاز أولاً، ويُحدّث الرصيد المؤكد بعد قبول جميع المواد بالمزامنة.</p>
    {error&&<p className="error form-error-summary" role="alert">{error}</p>}
    <div className="modal-actions"><button type="submit" className="primary" disabled={busy}>{busy?'جارٍ الحفظ…':'حفظ العملية'}</button><button type="button" className="secondary" disabled={busy} onClick={close}>إلغاء</button></div>
   </div>
  </form>
 </dialog>;
}
