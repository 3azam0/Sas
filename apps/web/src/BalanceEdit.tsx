'use client';
import UnitQuantityInput,{quantityUnits} from './UnitQuantityInput';
import {formatMoney} from './money-format';
import {HelpButton} from './ClientGuide';
import {DocumentSummary} from './DocumentForm';
import {useEffect,useRef,useState} from 'react';
import {countCommandSchema,type Snapshot} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {normalizeNumber} from '../../../packages/domain/opening-import';
import {FormInput,WorkflowForm} from './FormControls';
import {costingLabel} from './CostingSettings';
import {saveBalanceEdit} from './offline';
const num=(value:string)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:6}).format(Number(value));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export default function BalanceEdit({snapshot,location,itemId,close,saved,editItem}:{snapshot:Snapshot;location:string;itemId:string;close:()=>void;saved:()=>void;editItem?:(trigger:HTMLButtonElement)=>void}){
 const [basis]=useState(()=>structuredClone(snapshot)),item=snapshot.items.find(i=>i.id===itemId)??basis.items.find(i=>i.id===itemId)!,balance=basis.balances.find(b=>b.locationId===location&&b.itemId===itemId),expected=balance?.quantity??'0';
 const [quantity,setQuantity]=useState(decimal(expected).toString()),[reason,setReason]=useState(''),[cost,setCost]=useState(()=>balance?.average?decimal(balance.average).toFixed(6):basis.receiptPrices?.find(p=>p.locationId===location&&p.itemId===itemId)?.unitCost??''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [adjustCost,setAdjustCost]=useState(false);
 const [inputUnitId,setInputUnitId]=useState('base');
 const units=quantityUnits(item.unit,item.purchaseUnits),inputUnit=units.find(unit=>unit.id===inputUnitId)??units[0];
 const inInputUnit=(value:string)=>num(decimal(value).div(inputUnit.factor).toString());
 const dialog=useRef<HTMLDialogElement>(null);useEffect(()=>{dialog.current?.showModal();},[]);
 let difference:string|null=null;try{if(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(quantity))difference=decimal(quantity).sub(expected).toString();}catch{}
 const increasing=difference!==null&&decimal(difference).gt(0),validCost=/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(cost),newValue=adjustCost&&difference!==null&&validCost?decimal(quantity).mul(cost).toString():null,finish=()=>{if(busy)return;dialog.current?.close();close();};
 async function submit(){setBusy(true);setError('');try{
  const d=countCommandSchema.parse({operationId:crypto.randomUUID(),organizationId:basis.organizationId,generation:basis.generation,countId:crypto.randomUUID(),expectedRevision:0,type:'count.save',entryMode:'balance_edit',locationId:location,businessDate:today(),reason,cutoffAt:basis.fetchedAt,stockSequence:basis.stockCheckpoints?.find(p=>p.locationId===location)?.sequence,currency:'EGP',capturedAt:new Date().toISOString(),schemaVersion:1,lines:[{lineId:crypto.randomUUID(),itemId,unitId:item.unitId,expectedQuantity:expected,countedQuantity:quantity,...(increasing?{surplusUnitCost:cost}:{}),...(adjustCost?{targetUnitCost:cost}:{})}]});
  if(d.type!=='count.save')throw new Error('مستند تعديل غير صالح.');await saveBalanceEdit(d);saved();
 }catch(e){setError(e instanceof Error&&e.name!=='ZodError'?e.message:'راجع الرصيد الجديد والسبب وتكلفة أي زيادة.');}finally{setBusy(false);}}
 return <dialog ref={dialog} className="modal balance-edit-dialog" aria-labelledby="balance-edit-title" onCancel={e=>{e.preventDefault();finish();}}>
  <div className="modal-header"><div><h2 id="balance-edit-title">تعديل الرصيد</h2><p>{item.name} · {basis.locations.find(l=>l.id===location)?.name}</p></div>{editItem&&<button type="button" className="secondary" disabled={busy} onClick={event=>editItem(event.currentTarget)}>تعديل بيانات المادة</button>}<HelpButton topic="balance"/><button type="button" className="icon-button" aria-label="إغلاق تعديل الرصيد" disabled={busy} onClick={finish}>×</button></div>
  <WorkflowForm summary={<DocumentSummary label="الرصيد الجديد" value={quantity?inInputUnit(quantity)+' '+inputUnit.name:'—'} detail={newValue!==null?'قيمة المخزون الجديدة: '+formatMoney(newValue)+' ج.م':'يُسجّل الفرق والسبب بعد قبول المزامنة'}/>} busy={busy} error={error} onEdit={()=>setError('')} documentCheck={()=>difference===null?{message:'أدخل كمية صحيحة غير سالبة.',field:'الرصيد الجديد'}:adjustCost&&decimal(quantity).lte(0)?{message:'تعديل تكلفة الوحدة يحتاج رصيدًا جديدًا أكبر من صفر.',field:'الرصيد الجديد'}:decimal(difference).isZero()&&(!adjustCost||newValue!==null&&decimal(newValue).eq(balance?.value??0))?{message:'غيّر الرصيد أو تكلفة الوحدة قبل الحفظ.',field:'الرصيد الجديد'}:undefined} onSubmit={()=>void submit()}>
   <fieldset disabled={busy} className="receipt-fields">
    <div className="balance-edit-summary"><span>الرصيد الحالي <strong>{num(expected)} {item.unit}</strong></span><span>فرق التسوية <strong dir="ltr">{difference===null?'—':(decimal(difference).gt(0)?'+':'')+num(difference)}</strong> {item.unit}</span></div>
    <label><span className="form-label">الرصيد الجديد · اختر وحدة الإدخال<span className="field-required" aria-hidden="true">*</span></span><UnitQuantityInput unitName={item.unit} packs={item.purchaseUnits} unitLabel="وحدة إدخال الرصيد" onUnitChange={setInputUnitId} aria-label="الرصيد الجديد" required validateAs="nonnegative" inputMode="decimal" dir="ltr" value={quantity} onValue={value=>setQuantity(normalizeNumber(value))}/></label>
    {['owner','manager'].includes(basis.access.role??'')&&<label className="count-confirm"><input type="checkbox" checked={adjustCost} onChange={e=>setAdjustCost(e.target.checked)}/>تعديل تكلفة الوحدة لكل الرصيد المتبقي</label>}
    {(increasing||adjustCost)&&<label><span className="form-label">{adjustCost?'تكلفة الوحدة الجديدة':'تكلفة الوحدة المضافة'} (ج.م / {item.unit})<span className="field-required" aria-hidden="true">*</span></span><FormInput aria-label={adjustCost?'تكلفة الوحدة الجديدة':'تكلفة الوحدة المضافة'} required validateAs="nonnegative" inputMode="decimal" dir="ltr" value={cost} onChange={e=>setCost(normalizeNumber(e.target.value))}/><small>{adjustCost?'تُطبق على كامل الرصيد الجديد، وتُحفظ التكلفة السابقة وفرق القيمة في السجل. لا تتغير تكلفة حركات الصرف السابقة.':'تُطبق على الزيادة فقط. راجع السعر المقترح؛ أدخل ٠ إذا كانت الزيادة بلا تكلفة.'}</small></label>}
    {adjustCost&&<div className="balance-edit-summary"><span>القيمة الحالية <strong>{formatMoney(balance?.value??'0')} ج.م</strong></span><span>القيمة بعد التعديل <strong>{newValue===null?'—':formatMoney(newValue)+' ج.م'}</strong></span></div>}
    <label><span className="form-label">سبب تعديل الرصيد<span className="field-required" aria-hidden="true">*</span></span><FormInput aria-label="سبب تعديل الرصيد" required minLength={2} maxLength={200} value={reason} onChange={e=>setReason(e.target.value)} placeholder="مثل: تصحيح كمية بعد العد الفعلي"/></label>
    <p className="field-hint">يُحفظ الرصيد السابق والجديد والسبب والمستخدم والتاريخ. التخفيض يُقيّم بطريقة {costingLabel(basis)}.</p>
    <p className="field-hint">يصبح التعديل نهائياً بعد المزامنة. إذا تغير مخزون الموقع، راجع الرصيد وأدخل تعديلاً جديداً.</p>
    <div className="modal-actions"><button type="submit" className="primary">{busy?'جارٍ الحفظ…':'حفظ تعديل الرصيد'}</button><button type="button" className="secondary" onClick={finish}>إلغاء</button></div>
   </fieldset>
  </WorkflowForm>
 </dialog>;
}
