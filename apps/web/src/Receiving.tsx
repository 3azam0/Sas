'use client';
import {useEffect,useRef,useState} from 'react';
import {receiptDocumentSchema,type ReceiptDocument,type Snapshot} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {receivingUnitFactor} from '../../../packages/domain/receiving';
import {normalizeNumber} from '../../../packages/domain/opening-import';
import {saveReceipt,resolveReceipt,type LocalReceipt} from './offline';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const number=(v:string|number)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:6}).format(Number(v));
const valid=(v:string)=>/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(v);
const statuses:Record<LocalReceipt['status'],string>={pending:'محفوظ محلياً',acceptedAwaiting:'انتظار تأكيد الرصيد',accepted:'مقبول',needsReview:'يحتاج مراجعة',cancelled:'ملغى',superseded:'تم التصحيح'};
export function ReceiptHistory({snapshot,location,rows,expired,synchronize,edit}:{snapshot:Snapshot;location?:string;rows:LocalReceipt[];expired:boolean;synchronize:()=>Promise<void>;edit:(row:LocalReceipt)=>void}){
 const [error,setError]=useState('');const docs=new Map(rows.map(r=>[r.id,r]));
 for(const posted of snapshot.receipts??[])docs.set(posted.document.operationId,{...docs.get(posted.document.operationId),id:posted.document.operationId,scope:snapshot.organizationId,document:posted.document,status:'accepted',error:undefined,createdAt:posted.postedAt});
 async function resolve(row:LocalReceipt,action:'retry'|'cancel'){try{setError('');await resolveReceipt(row.scope,row.id,action);if(action==='retry')await synchronize();}catch(e){setError(e instanceof Error?e.message:'تعذرت معالجة الاستلام');}}
 const visible=[...docs.values()].filter(r=>!location||r.document.locationId===location).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 return <section className="panel"><div className="panel-heading"><div><h2>مستندات الاستلام المباشر</h2><p>استلام عدة مواد في مستند واحد، مع المورد أو بدونه.</p></div><span className="pill">{visible.length} مستند</span></div>{error&&<p role="alert" className="error">{error}</p>}{!visible.length&&<p className="empty">ستظهر مستندات الاستلام المحفوظة هنا.</p>}{visible.map(row=><details className="opening-document" key={row.id}><summary><strong>{row.document.reason}</strong> · {row.document.businessDate} · {row.document.lines.length} مادة · {number(row.document.lines.reduce((s,l)=>s.add(decimal(l.quantity).mul(l.unitCost)),decimal('0')).toString())} ج.م <span className={'pill '+(row.status==='accepted'?'good':'warning')}>{statuses[row.status]}</span></summary><p>الموقع: {snapshot.locations.find(l=>l.id===row.document.locationId)?.name??row.document.locationId}</p><p>المورد: {snapshot.suppliers?.find(s=>s.id===row.document.supplierId)?.name??'بدون مورد محدد'}</p><small dir="ltr">{row.id}</small><div className="table-scroll"><table><thead><tr><th>المادة</th><th>كمية المخزون</th><th>تكلفة الوحدة</th><th>القيمة</th></tr></thead><tbody>{row.document.lines.map(l=><tr key={l.lineId}><td>{snapshot.items.find(i=>i.id===l.itemId)?.name??l.itemId}</td><td>{number(l.quantity)} {l.receivingUnit?.baseName??snapshot.units?.find(u=>u.id===l.unitId)?.name??l.unitId}{l.enteredQuantity&&<small className="setup-subline">{number(l.enteredQuantity)} {l.receivingUnit?.name??snapshot.items.find(i=>i.id===l.itemId)?.purchaseUnits?.find(p=>p.id===l.purchaseUnitId)?.name}{l.receivingUnit&&<> · ١ {l.receivingUnit.name} = {number(l.receivingUnit.factor)} {l.receivingUnit.baseName}</>}</small>}</td><td>{number(l.unitCost)}</td><td>{number(decimal(l.quantity).mul(l.unitCost).toString())}</td></tr>)}</tbody></table></div>{row.error&&<p className="error" role="alert">{row.error}</p>}{row.replacesId&&<p>تصحيح للمستند: <span dir="ltr">{row.replacesId}</span></p>}{row.replacementId&&<p>المستند البديل: <span dir="ltr">{row.replacementId}</span></p>}{row.status==='needsReview'&&<div className="review-actions"><button className="secondary" disabled={expired} onClick={()=>void resolve(row,'retry')}>إعادة محاولة الاستلام</button><button className="secondary" disabled={expired} onClick={()=>edit(row)}>تصحيح الاستلام</button><button className="text-button" onClick={()=>void resolve(row,'cancel')}>إلغاء الاستلام المرفوض</button></div>}</details>)}</section>;
}
type EditorLine={lineId:string;itemId:string;selection:string;factor:string;enteredQuantity:string;unitCost:string};
export default function ReceiptDialog({snapshot,location,itemId,initial,close,saved}:{snapshot:Snapshot;location:string;itemId?:string;initial?:LocalReceipt;close:()=>void;saved:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
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
 useEffect(()=>{dialog.current?.showModal();},[]);
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
 async function submit(e:React.FormEvent){
  e.preventDefault();if(busy)return;setBusy(true);setError('');
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
  <div className="panel-heading"><div><span className="eyebrow">{snapshot.locations.find(l=>l.id===location)?.name}</span><h2 id="receipt-title">{initial?'تصحيح استلام مواد':'استلام مواد'}</h2><p>أضف جميع مواد الاستلام ثم احفظها في مستند واحد.</p></div><button className="icon-button" disabled={busy} onClick={close} aria-label="إغلاق">×</button></div>
  <form onSubmit={e=>void submit(e)}><fieldset disabled={busy} className="receipt-fields">
   <div className="form-row">
    <label>المورد<select aria-label="المورد" value={supplierId} onChange={e=>setSupplier(e.target.value)}><option value="">بدون مورد محدد</option>{snapshot.suppliers?.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label>تاريخ الاستلام<input aria-label="تاريخ الاستلام" type="date" required max={today()} value={businessDate} onChange={e=>setDate(e.target.value)}/></label>
   </div>
   <label>مرجع الاستلام<input aria-label="مرجع الاستلام" required minLength={2} maxLength={200} placeholder="رقم الفاتورة أو ملاحظة" value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <p className="form-note">وحدة الاستلام تعرض جميع الوحدات المسجلة في إعداد المخزون، مع عبوات الشراء الخاصة بالصنف.</p>
   <div className="receipt-lines">{lines.map((l,index)=>{
    const choice=selected(l),{item,unit,pack,name,factor,manual}=choice,quantity=base(l);
    return <fieldset className="receipt-line" key={l.lineId}><legend>المادة {index+1}</legend>
     <div className="form-row">
      <label>المادة<select autoFocus={index===0} aria-label={index===0?'المادة':`مادة السطر ${index+1}`} required value={l.itemId} onChange={e=>change(l.lineId,'itemId',e.target.value)}>{items.map(i=><option key={i.id} value={i.id} disabled={lines.some(x=>x.lineId!==l.lineId&&x.itemId===i.id)}>{i.name} · {i.unit}</option>)}</select><small>{item?.sku}</small></label>
      <label>وحدة الاستلام<select aria-label={index===0?'وحدة الاستلام':`وحدة السطر ${index+1}`} value={l.selection} onChange={e=>change(l.lineId,'selection',e.target.value)}>
       <option value="">{item?.unit} · وحدة المخزون</option>
       <optgroup label="وحدات المخزون">{snapshot.units?.filter(u=>u.id!==item?.unitId).map(u=><option key={u.id} value={'unit:'+u.id}>{u.name}</option>)}</optgroup>
       {!!item?.purchaseUnits?.length&&<optgroup label="عبوات شراء الصنف">{item.purchaseUnits.map(p=><option key={p.id} value={p.id}>{p.name} · {p.factor} {item.unit}</option>)}</optgroup>}
      </select></label>
     </div>
     {manual?<label>محتوى وحدة الاستلام ({item?.unit})<small>١ {name} = كم {item?.unit}؟ أدخل محتوى العبوة أو معامل التحويل لهذا الاستلام.</small><input aria-label={index===0?'محتوى وحدة الاستلام':`محتوى وحدة السطر ${index+1}`} required inputMode="decimal" dir="ltr" value={l.factor} placeholder="مثال: ٥" onChange={e=>change(l.lineId,'factor',normalizeNumber(e.target.value))}/></label>
      :(unit||pack)&&<p className="form-note">١ {name} = {number(factor)} {item?.unit} · تحويل تلقائي</p>}
     <div className="form-row">
      <label>الكمية ({name})<input aria-label={index===0?`الكمية (${name})`:`كمية السطر ${index+1}`} required inputMode="decimal" dir="ltr" value={l.enteredQuantity} onChange={e=>change(l.lineId,'enteredQuantity',normalizeNumber(e.target.value))}/></label>
      <label>تكلفة الوحدة (ج.م)<small>لكل {item?.unit} من وحدة المخزون</small><input aria-label={index===0?'تكلفة الوحدة (ج.م)':`تكلفة السطر ${index+1}`} required inputMode="decimal" dir="ltr" value={l.unitCost} onChange={e=>change(l.lineId,'unitCost',normalizeNumber(e.target.value))}/></label>
     </div>
     {!quantity&&valid(l.enteredQuantity)&&valid(factor)&&decimal(l.enteredQuantity).gt(0)&&decimal(factor).gt(0)&&<p className="error">الكمية المحوّلة تتجاوز الحد المسموح أو ٦ منازل عشرية. راجع الكمية ومعامل التحويل.</p>}
     <div className="receipt-line-footer"><span>كمية المخزون: {quantity?number(quantity.toString()):'—'} {item?.unit} · القيمة: {quantity&&valid(l.unitCost)?number(quantity.mul(l.unitCost).toString())+' ج.م':'—'}</span><button type="button" className="text-button" disabled={lines.length===1} aria-label={`حذف السطر ${index+1}`} onClick={()=>setLines(lines.filter(x=>x.lineId!==l.lineId))}>حذف</button></div>
    </fieldset>;
   })}</div>
   <button type="button" className="secondary" disabled={lines.length>=200||lines.length>=items.length} onClick={()=>setLines([...lines,fresh(items.find(i=>!lines.some(l=>l.itemId===i.id))?.id)])}>إضافة مادة أخرى</button>
   <div className="operation-summary"><span>إجمالي الاستلام المتوقع · {lines.length} مادة</span><strong>{number(total.toString())} ج.م</strong></div>
   <p className="form-note">يُحفظ المستند على هذا الجهاز أولاً. يتغير الرصيد المؤكد بعد قبول جميع السطور معاً.</p>
   {error&&<p className="error" role="alert">{error}</p>}
   <div className="modal-actions"><button type="submit" className="primary" disabled={busy}>{busy?'جارٍ الحفظ…':'حفظ العملية'}</button><button type="button" className="secondary" onClick={close}>إلغاء</button></div>
  </fieldset></form>
 </dialog>;
}
