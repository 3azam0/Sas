'use client';
import {useEffect,useId,useRef,useState,type KeyboardEvent} from 'react';
import {purchaseCommandSchema,type PurchaseDefinition,type PurchaseOrder,type Snapshot} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {HelpButton} from './ClientGuide';
import CollapsibleSection from './CollapsibleSection';
import type {PurchaseDraftSeed} from '../../../packages/contracts/inventory-operations';
import Collection from './Collection';
import {DocumentSummary,FormSizeButton} from './DocumentForm';
import {FormInput,FormSelect,SearchableSelect,WorkflowForm,FormKeyboardHelp,focusControl} from './FormControls';
import {SetupEditor} from './InventorySetup';
import {commitReceivingEntry,type ReceivingLine} from './receiving-entry';
import {normalizeNumber} from '../../../packages/domain/opening-import';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const number=(value:string|number)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:6}).format(Number(value));
const fresh=():ReceivingLine=>({lineId:crypto.randomUUID(),itemId:'',selection:'',factor:'',enteredQuantity:'',unitCost:''});
type EntryField='item'|'quantity'|'cost'|'unit';

/** The receiving entry/list pattern captures only the existing purchase.save command. */
export default function PurchaseDraftEditor({snapshot,location,initial,seed,busy,expired,error,save,close}:{snapshot:Snapshot;location:string;initial?:PurchaseOrder;seed?:PurchaseDraftSeed;busy:boolean;expired:boolean;error:string;save:(document:PurchaseDefinition)=>Promise<void>;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),titleId=useId(),orderId=useRef(initial?.orderId??crypto.randomUUID()),locked=useRef(false);
 const [expanded,setExpanded]=useState(false),[supplier,setSupplier]=useState(initial?.document.supplierId??snapshot.suppliers?.find(s=>s.active)?.id??''),[businessDate,setDate]=useState(initial?.document.businessDate??today()),[reference,setReference]=useState(initial?.document.reference??seed?.reference??'');
 const [lines,setLines]=useState<ReceivingLine[]>(()=>initial?.document.lines.map(line=>({lineId:line.lineId,itemId:line.itemId,selection:line.purchaseUnitId??'',factor:line.factor,enteredQuantity:line.enteredQuantity,unitCost:line.unitCost}))??seed?.lines.map(line=>({lineId:crypto.randomUUID(),itemId:line.itemId,selection:'',factor:'1',enteredQuantity:line.quantity,unitCost:line.unitCost}))??[]);
 const [entry,setEntry]=useState(fresh),[editingId,setEditingId]=useState<string|null>(null),[entryVersion,setEntryVersion]=useState(0),[listVersion,setListVersion]=useState(0),[notice,setNotice]=useState(''),[localError,setLocalError]=useState(''),[lastChanged,setLastChanged]=useState('');
 const [createdItems,setCreatedItems]=useState<Snapshot['items']>([]),[newMaterial,setNewMaterial]=useState<{name:string}|null>(null),afterCreate=useRef<EntryField|null>(null);
 const catalog=[...snapshot.items,...createdItems.filter(item=>!snapshot.items.some(current=>current.id===item.id))],items=catalog.filter(item=>item.active!==false&&item.unitId),blocked=busy||!!newMaterial;
 const dirty=!!(editingId||entry.itemId||entry.enteredQuantity||entry.unitCost||entry.selection);
 const item=catalog.find(item=>item.id===entry.itemId),pack=item?.purchaseUnits?.find(pack=>pack.id===entry.selection);
 const factorFor=(line:ReceivingLine)=>line.selection?catalog.find(item=>item.id===line.itemId)?.purchaseUnits?.find(pack=>pack.id===line.selection)?.factor??'':'1';
 const total=lines.reduce((sum,line)=>sum.add(decimal(line.enteredQuantity).mul(factorFor(line)||'0').mul(line.unitCost)),decimal('0'));
 const labels:Record<EntryField,string>={item:'مادة الشراء',quantity:'كمية الشراء',cost:'تكلفة الشراء',unit:'وحدة الشراء'};
 function focusEntry(field:EntryField){const form=dialog.current?.querySelector('form');requestAnimationFrame(()=>focusControl(form?.querySelector<HTMLInputElement|HTMLSelectElement>('[aria-label="'+labels[field]+'"]:not([hidden])'),form??null));}
 useEffect(()=>{dialog.current?.showModal();focusEntry('item');},[]);
 useEffect(()=>{if(newMaterial||!afterCreate.current)return;const field=afterCreate.current;afterCreate.current=null;focusEntry(field);},[newMaterial]);
 function update(patch:Partial<ReceivingLine>){setEntry(previous=>({...previous,...patch}));setLocalError('');setNotice('');}
 function clearEntry(){setEntry(fresh());setEditingId(null);setEntryVersion(value=>value+1);setLocalError('');focusEntry('item');}
 function addEntry(){
  if(blocked)return;
  if(!items.some(item=>item.id===entry.itemId)){setLocalError('اختر مادة نشطة من القائمة.');focusEntry('item');return;}
  const result=commitReceivingEntry(lines,entry,factorFor,editingId);
  if(!result.ok){
   const messages={heads:'راجع بيانات المادة وأعد إضافتها.',item:'اختر مادة من القائمة.',quantity:'أدخل كمية موجبة ضمن الحد والدقة المسموحين.',factor:'اختر وحدة شراء متاحة للمادة.',cost:'أدخل تكلفة وحدة المخزون؛ يمكن أن تكون صفراً.',incompatible:'المادة موجودة بوحدة شراء أو تكلفة مختلفة؛ عدّل سطرها بدلاً من إضافتها مرة أخرى.',capacity:'الحد الأقصى ٢٠٠ مادة مختلفة في المستند.','missing-edit':'السطر الجاري تعديله لم يعد متاحاً. ألغِ التعديل واختر المادة مجدداً.'};
   setLocalError(messages[result.reason]);focusEntry(result.reason==='item'?'item':result.reason==='cost'?'cost':result.reason==='factor'?'unit':'quantity');return;
  }
  setLines(result.lines);setLastChanged(result.line.lineId);setListVersion(value=>value+1);clearEntry();setNotice((result.action==='merged'?'جُمعت الكمية':result.action==='updated'?'عُدلت المادة':'أُضيفت المادة')+' — '+catalog.find(item=>item.id===result.line.itemId)?.name);
 }
 function editLine(line:ReceivingLine){if(dirty){setLocalError('أضف الإدخال الحالي أو امسحه قبل تعديل مادة أخرى.');focusEntry('quantity');return;}setEntry({...line});setEditingId(line.lineId);setEntryVersion(value=>value+1);setLocalError('');setNotice('');focusEntry('quantity');}
 function removeLine(line:ReceivingLine){setLines(rows=>rows.filter(row=>row.lineId!==line.lineId));setListVersion(value=>value+1);setLocalError('');setNotice('حُذفت المادة من المسودة.');if(editingId===line.lineId)clearEntry();}
 function keyboard(event:KeyboardEvent<HTMLFormElement>){
  if(event.key!=='Enter'||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.nativeEvent.isComposing||!(event.target instanceof HTMLInputElement))return;
  const label=event.target.getAttribute('aria-label');if(label===labels.quantity||label===labels.cost){event.preventDefault();if(!event.repeat){if(label===labels.quantity)focusEntry('cost');else addEntry();}}
 }
 function check(){if(dirty)return {message:editingId?'احفظ تعديل المادة أو ألغِه قبل حفظ المسودة.':'أضف المادة الحالية إلى القائمة أو امسح الإدخال قبل حفظ المسودة.',field:entry.itemId?labels.cost:labels.item};if(!lines.length)return {message:'أضف مادة واحدة على الأقل إلى أمر الشراء.',field:labels.item};return undefined;}
 async function submit(){
  if(blocked||locked.current)return;
  if(expired){setLocalError('جدّد الجلسة قبل حفظ المسودة. بياناتك محفوظة في النموذج.');return;}
  locked.current=true;try{
   const command:PurchaseDefinition={operationId:crypto.randomUUID(),organizationId:snapshot.organizationId,generation:snapshot.generation,orderId:orderId.current,expectedRevision:initial?.revision??0,capturedAt:new Date().toISOString(),schemaVersion:1,type:'purchase.save',locationId:location,supplierId:supplier,businessDate,reference,currency:'EGP',lines:lines.map(line=>{
    const item=catalog.find(item=>item.id===line.itemId),pack=item?.purchaseUnits?.find(pack=>pack.id===line.selection);if(!item?.unitId||item.active===false||line.selection&&!pack)throw new Error('توجد مادة أو وحدة شراء لم تعد متاحة؛ عدّل السطر قبل الحفظ.');
    return {lineId:line.lineId,itemId:item.id,unitId:item.unitId,purchaseUnitId:pack?.id,unitName:pack?.name??item.unit,factor:pack?.factor??'1',enteredQuantity:line.enteredQuantity,quantity:decimal(line.enteredQuantity).mul(pack?.factor??'1').toString(),unitCost:line.unitCost};
   })};
   const parsed=purchaseCommandSchema.safeParse(command);if(!parsed.success||parsed.data.type!=='purchase.save'){setLocalError('راجع المورد والتاريخ والمرجع والمواد والكميات والتكلفة.');return;}await save(parsed.data);
  }catch(error){setLocalError(error instanceof Error?error.message:'تعذّر حفظ المسودة.');}finally{locked.current=false;}
 }
 let entryQuantity:string|undefined,entryAmount:string|undefined;try{if(entry.enteredQuantity&&decimal(normalizeNumber(entry.enteredQuantity)).gt(0)){entryQuantity=decimal(normalizeNumber(entry.enteredQuantity)).mul(pack?.factor??'1').toString();if(entry.unitCost)entryAmount=decimal(entryQuantity).mul(normalizeNumber(entry.unitCost)).toString();}}catch{}
 function returnFromCreate(field:EntryField){afterCreate.current=field;setNewMaterial(null);}
 return <><dialog ref={dialog} className={'modal receipt-modal purchase-draft-modal'+(expanded?' form-expanded':'')} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();if(!blocked)close();}}>
  <WorkflowForm className="purchase-draft-form" busy={blocked} error={localError||error} onEdit={()=>setLocalError('')} documentCheck={check} onKeyDown={keyboard} onSubmit={()=>void submit()} summary={<DocumentSummary label="صافي تكلفة الأمر المتوقع" value={number(total.toString())+' ج.م'} detail={number(lines.length)+' مادة · حفظ المسودة لا يغيّر المخزون'}/>} header={<div className="modal-header purchase-draft-header">
   <div className="receiving-header-title"><span className="eyebrow">{snapshot.locations.find(site=>site.id===location)?.name}</span><h2 id={titleId}>{initial?'تعديل أمر الشراء':'مسودة أمر شراء'}</h2></div>
   <div className="purchase-draft-header-fields">
    <label><span className="form-label">المورد <span className="field-required" aria-hidden="true">*</span></span><FormSelect required aria-label="مورد الشراء" value={supplier} onChange={event=>setSupplier(event.target.value)}><option value="">اختر المورد</option>{snapshot.suppliers?.filter(supplier=>supplier.active).map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</FormSelect></label>
    <label><span className="form-label">التاريخ <span className="field-required" aria-hidden="true">*</span></span><FormInput required aria-label="تاريخ أمر الشراء" type="date" max={today()} value={businessDate} onChange={event=>setDate(event.target.value)}/></label>
    <label><span className="form-label">المرجع <span className="field-required" aria-hidden="true">*</span></span><FormInput required minLength={2} maxLength={200} aria-label="مرجع أمر الشراء" placeholder="رقم الطلب أو مرجع المورد" value={reference} onChange={event=>setReference(event.target.value)}/></label>
   </div>
   <div className="receiving-header-actions"><FormSizeButton expanded={expanded} toggle={()=>setExpanded(value=>!value)} disabled={blocked}/><HelpButton topic="purchasing"/><button type="button" className="icon-button" aria-label="إغلاق المسودة" disabled={blocked} onClick={close}>×</button></div><FormKeyboardHelp/>
  </div>}>
   <div className="receiving-workspace">
    <CollapsibleSection key={entryVersion} data-form-scroll className={'receiving-composer'+(editingId?' receiving-composer-editing':'')} aria-labelledby="purchase-entry-title">
     <div className="form-section-heading"><div><h3 id="purchase-entry-title">{editingId?'تعديل المادة':'إضافة مادة'}</h3></div><button type="button" className="text-button" aria-label="إضافة مادة جديدة" disabled={blocked||!!editingId} onClick={()=>setNewMaterial({name:''})}>＋ إضافة مادة جديدة</button></div>
     <div className="receiving-composer-row"><div className="receiving-composer-main">
      <label><span className="form-label">المادة <span className="field-required" aria-hidden="true">*</span></span><SearchableSelect aria-label={labels.item} openOnFocus={!notice} value={entry.itemId} disabled={!!editingId} onCreate={name=>setNewMaterial({name})} onChange={event=>{update({itemId:event.target.value,selection:'',factor:''});focusEntry('quantity');}} onSearchEnter={()=>focusEntry('quantity')}>{items.map(item=><option key={item.id} value={item.id}>{item.name} · {item.sku} · {item.unit}</option>)}</SearchableSelect></label>
      <label><span className="form-label">الكمية{item&&' ('+(pack?.name??item.unit)+')'} <span className="field-required" aria-hidden="true">*</span></span><FormInput aria-label={labels.quantity} inputMode="decimal" dir="ltr" placeholder="0.00" validateAs="positive" value={entry.enteredQuantity} onChange={event=>update({enteredQuantity:event.target.value})}/></label>
     </div>
     <div className="receiving-composer-details">
      <label><span className="form-label">التكلفة (ج.م / {item?.unit??'وحدة مخزون'}) <span className="field-required" aria-hidden="true">*</span></span><FormInput aria-label={labels.cost} inputMode="decimal" dir="ltr" placeholder="0.00" validateAs="nonnegative" value={entry.unitCost} onChange={event=>update({unitCost:event.target.value})}/></label>
      <label><span className="form-label">وحدة الشراء</span><FormSelect aria-label={labels.unit} disabled={!item} value={entry.selection} onChange={event=>update({selection:event.target.value})}><option value="">{item?.unit??'اختر المادة أولاً'} · وحدة المخزون</option>{item?.purchaseUnits?.map(pack=><option key={pack.id} value={pack.id}>{pack.name} · {pack.factor} {item.unit}</option>)}</FormSelect></label>
      <button type="button" data-keyboard-add className="primary receiving-entry-add" onClick={addEntry}>{editingId?'حفظ تعديل المادة':'إضافة إلى القائمة'} <kbd aria-hidden="true">↵</kbd></button>
     </div></div>
     <div className="receiving-entry-preview">{pack&&<span className="receiving-conversion">١ {pack.name} = {number(pack.factor)} {item?.unit}</span>}{item&&<><span>كمية المخزون: <strong>{entryQuantity?number(entryQuantity):'—'} {item.unit}</strong></span><span>قيمة المادة: <strong>{entryAmount?number(entryAmount)+' ج.م':'—'}</strong></span></>}{dirty&&<button type="button" className="text-button" onClick={clearEntry}>{editingId?'إلغاء تعديل المادة':'مسح الإدخال'}</button>}</div><p role="status" aria-live="polite" className="kitchen-entry-notice">{notice}</p>
    </CollapsibleSection>
    <CollapsibleSection className={'form-section receipt-items-section kitchen-receipt-section receiving-receipt-pane'+(lines.length<=10?' kitchen-compact-receipt':'')} aria-labelledby="purchase-items-title">
     <div className="form-section-heading"><h3 id="purchase-items-title">المواد المطلوبة <span className="pill">{number(lines.length)} مادة</span></h3><small className="kitchen-receipt-order">آخر مادة مضافة أولاً</small></div>
     <div className="receiving-list-scroll"><Collection rows={lines} title="سطور أمر الشراء" resetKey={String(listVersion)} searchText={line=>{const item=catalog.find(item=>item.id===line.itemId);return (item?.name??'')+' '+(item?.sku??'');}} rowIds={line=>[line.lineId]} emptyText="أضف المواد من الحقول بالأعلى قبل حفظ المسودة.">{page=><ol className="kitchen-receipt-list">{page.map(line=>{
      const item=catalog.find(item=>item.id===line.itemId),pack=item?.purchaseUnits?.find(pack=>pack.id===line.selection),base=decimal(line.enteredQuantity).mul(factorFor(line)||'0');
      return <li key={line.lineId}><article data-purchase-line={line.lineId} className={'kitchen-receipt-line'+(lastChanged===line.lineId?' kitchen-receipt-latest':'')} aria-label={'مادة الشراء: '+item?.name}><div className="kitchen-receipt-item"><strong>{item?.name??line.itemId}</strong><small>{item?.sku} · {item?.category}</small></div><dl className="kitchen-receipt-details"><div><dt>الكمية</dt><dd>{number(line.enteredQuantity)} {pack?.name??item?.unit}</dd>{pack&&<small className="field-hint">({number(base.toString())} {item?.unit} للمخزون)</small>}</div><div><dt>تكلفة وحدة المخزون</dt><dd>{number(line.unitCost)} ج.م / {item?.unit}</dd></div><div><dt>قيمة المادة</dt><dd>{number(base.mul(line.unitCost).toString())} ج.م</dd></div></dl><div className="kitchen-receipt-actions"><button type="button" className="text-button" aria-label={'تعديل '+item?.name} onClick={()=>editLine(line)}>تعديل</button><button type="button" className="text-button kitchen-receipt-remove" aria-label={'حذف '+item?.name} onClick={()=>removeLine(line)}>حذف</button></div></article></li>;
     })}</ol>}</Collection></div>
    </CollapsibleSection>
   </div>
   <div className="heading-actions"><button type="submit" className="primary" disabled={blocked||expired}>حفظ مسودة الشراء</button><button type="button" className="secondary" disabled={blocked} onClick={close}>إغلاق المسودة</button></div>
  </WorkflowForm>
 </dialog>{newMaterial&&<SetupEditor section="items" snapshot={{...snapshot,items:catalog}} composeAvailable={false} saved={()=>{}} close={()=>returnFromCreate('item')} quickCreate={{name:newMaterial.name,context:'أضف المادة واخترها في أمر الشراء الحالي. بيانات المسودة محفوظة؛ حفظ الأمر لا يضيف مخزوناً.',created:record=>{setCreatedItems(previous=>[...previous,{...record,unit:snapshot.units?.find(unit=>unit.id===record.unitId)?.name??''}]);update({itemId:record.id,selection:'',factor:''});returnFromCreate('quantity');setNotice('حُفظت المادة. أدخل الكمية والتكلفة ثم أضفها للقائمة.');}}}/>}</>;
}

