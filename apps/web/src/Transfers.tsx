'use client';
import {formatMoney} from './money-format';
import UnitQuantityInput from './UnitQuantityInput';
import CollapsibleSection from './CollapsibleSection';
import {TransferWatch} from './InventoryFollowUp';
import {DocumentEditor,DocumentFields,DocumentSummary,FormExplanation} from './DocumentForm';
import {issueStockPreview} from './kitchen-issue-preview';
import {operationLabels,OperationStatus,reviewFirst,DocumentLink} from './OperationStatus';
import Collection,{syncStatusOptions} from './Collection';
import {FormInput,FormSelect,SearchableSelect,WorkflowForm,matchesSearch} from './FormControls';
import {useState} from 'react';
import type {Snapshot,Transfer,TransferCommand,TransferEdit} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {projectTransfers,saveTransfer,resolveTransfer,type LocalTransfer} from './offline';
import {saveTransferEdit,voidTransfer} from './transfer-edit-client';
import VoidStockDocument from './VoidStockDocument';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const num=(s:string)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:6}).format(Number(s));
const normalize=(s:string)=>s.replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/٫/g,'.').trim();
const actionName=(c:TransferCommand)=>c.type==='transfer.dispatch'?'إرسال':c.type==='transfer.receive'?'استلام':'فقد في الطريق';
const states={inTransit:'في الطريق',partial:'استلام / تسوية جزئية',completed:'مستلم بالكامل',resolvedWithLoss:'مغلق مع فقد',voided:'ملغى'};
const labels=operationLabels;
export default function Transfers({snapshot,location,rows,expired,synchronize,notify}:{snapshot:Snapshot;location:string;rows:LocalTransfer[];expired:boolean;synchronize:()=>Promise<void>;notify:(s:string)=>void}){
 const [search,setSearch]=useState('');
 const [editing,setEditing]=useState<Transfer|null>(null);
 const [voiding,setVoiding]=useState<Transfer|null>(null);
 const [editReason,setEditReason]=useState('');
 const [mode,setMode]=useState<TransferCommand['type']|null>(null),[transferId,setId]=useState(''),[sourceId,setSource]=useState(location),[destinationId,setDestination]=useState(''),[reason,setReason]=useState(''),[businessDate,setDate]=useState(today()),[quantities,setQuantities]=useState<Record<string,string>>({}),[replacesId,setReplaces]=useState<string|undefined>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const transfers=projectTransfers(snapshot,rows).filter(t=>t.document.sourceId===location||t.document.destinationId===location),selected=transfers.find(t=>t.transferId===transferId);
 const name=(id:string)=>snapshot.locations.find(l=>l.id===id)?.name??id;
 const itemName=(id:string)=>snapshot.items.find(i=>i.id===id)?.name??id;
 const pending=rows.filter(r=>(r.status==='pending'||r.status==='acceptedAwaiting')&&!snapshot.acceptedOperationIds.includes(r.id));
 type TransferHistoryRow={command:TransferCommand;status:LocalTransfer['status'];amount?:string;error?:string;replacesId?:string;replacementId?:string};
 const history=new Map<string,TransferHistoryRow>();
 for(const t of snapshot.transfers??[])if(t.document.sourceId===location||t.document.destinationId===location)history.set(t.document.operationId,{command:t.document,status:'accepted',amount:t.amount});
 for(const a of snapshot.transferActions??[])if(transfers.some(t=>t.transferId===a.document.transferId))history.set(a.document.operationId,{command:a.document,status:'accepted',amount:a.amount});
 for(const r of rows){const d=r.command.type==='transfer.dispatch'?r.command:transfers.find(t=>t.transferId===r.command.transferId)?.document;if(d&&(d.sourceId===location||d.destinationId===location))history.set(r.id,{...history.get(r.id),command:history.get(r.id)?.command??r.command,status:snapshot.acceptedOperationIds.includes(r.id)?'accepted':r.status,error:r.error,replacesId:r.replacesId,replacementId:r.replacementId});}
 const acceptedDispatches=new Set([...history.values()].filter(row=>row.status==='accepted'&&row.command.type==='transfer.dispatch').map(row=>row.command.transferId));
 const acceptedEvents=new Map<string,TransferHistoryRow[]>();
 const documentHistory=[...history.values()].filter(row=>{
  if(row.status!=='accepted'||row.command.type==='transfer.dispatch'||!acceptedDispatches.has(row.command.transferId))return true;
  const events=acceptedEvents.get(row.command.transferId)??[];
  events.push(row);
  acceptedEvents.set(row.command.transferId,events);
  return false;
 });
 const eventsFor=(row:TransferHistoryRow)=>row.status==='accepted'&&row.command.type==='transfer.dispatch'?acceptedEvents.get(row.command.transferId)??[]:[];
 function start(type:TransferCommand['type'],t?:Transfer,row?:LocalTransfer){
  setEditing(null);setEditReason('');setSearch('');setMode(type);setError('');setReason(row?.command.reason??'');setDate(row?.command.businessDate??today());setReplaces(row?.id);setId(t?.transferId??crypto.randomUUID());setSource(row?.command.type==='transfer.dispatch'?row.command.sourceId:location);setDestination(row?.command.type==='transfer.dispatch'?row.command.destinationId:snapshot.locations.find(l=>l.id!==location&&l.active!==false)?.id??'');
  setQuantities(row?Object.fromEntries(row.command.lines.map(l=>['itemId'in l?l.itemId:l.dispatchLineId,l.quantity])):{});
 }
 function editTransfer(transfer:Transfer){
  start('transfer.dispatch',transfer);
  setEditing(transfer);
  setSource(transfer.document.sourceId);
  setDestination(transfer.document.destinationId);
  setReason(transfer.document.reason);
  setDate(transfer.document.businessDate);
  setQuantities(Object.fromEntries(transfer.document.lines.map(line=>[line.itemId,line.quantity])));
 }
 const canEdit=['owner','manager'].includes(snapshot.access.role??'');
 async function save(){setBusy(true);setError('');try{
  if(editing){
   const oldLines=new Map(editing.document.lines.map(line=>[line.itemId,line]));
   const lines=snapshot.items.flatMap(item=>{
    const quantity=normalize(quantities[item.id]??'');
    return quantity&&Number(quantity)!==0?[{itemId:item.id,unitId:oldLines.get(item.id)?.unitId??item.unitId!,quantity}]:[];
   });
   await saveTransferEdit(snapshot,{transferId:editing.transferId,expectedRevision:editing.revision,businessDate,reference:reason,reason:editReason,lines});
   setMode(null);setEditing(null);notify('تم حفظ التعديل في مستند التحويل وسجل تعديلاته.');
   await synchronize();
   return;
  }
  const envelope={operationId:crypto.randomUUID(),organizationId:snapshot.organizationId,generation:snapshot.generation,transferId,expectedRevision:mode==='transfer.dispatch'?0:selected?.revision??0,businessDate,reason,capturedAt:new Date().toISOString(),schemaVersion:1 as const};
  const command:TransferCommand=mode==='transfer.dispatch'?{...envelope,type:'transfer.dispatch',sourceId,destinationId,lines:snapshot.items.filter(i=>quantities[i.id]?.trim()&&normalize(quantities[i.id])!=='0').map(i=>({movementId:crypto.randomUUID(),itemId:i.id,unitId:i.unitId!,quantity:normalize(quantities[i.id])}))}:{...envelope,type:mode==='transfer.loss'?'transfer.loss':'transfer.receive',lines:(selected?.lines??[]).filter(l=>quantities[l.dispatchLineId]?.trim()&&normalize(quantities[l.dispatchLineId])!=='0').map(l=>({movementId:crypto.randomUUID(),dispatchLineId:l.dispatchLineId,quantity:normalize(quantities[l.dispatchLineId])}))};
  await saveTransfer(command,replacesId);setMode(null);setReplaces(undefined);notify('تم حفظ مستند التحويل محلياً. المخزون النهائي يتغير بعد قبول المزامنة.');if(navigator.onLine)await synchronize();
 }catch(e){setError(e instanceof Error&&e.name!=='ZodError'?e.message:'اختر المواقع وأدخل سبباً وكميات موجبة صحيحة.');}finally{setBusy(false);}}
 async function resolve(id:string,action:'retry'|'cancel'){try{await resolveTransfer(snapshot.organizationId,id,action);if(action==='retry'&&navigator.onLine)await synchronize();}catch(e){setError(e instanceof Error?e.message:'تعذرت معالجة التحويل.');}}
 const editRows=mode==='transfer.dispatch'?snapshot.items.filter(i=>i.active!==false||editing?.document.lines.some(line=>line.itemId===i.id)).map(i=>{
  const balance=snapshot.balances.find(b=>b.locationId===sourceId&&b.itemId===i.id)?.quantity??'0';
  const oldLine=editing?.document.lines.find(line=>line.itemId===i.id);
  return {key:i.id,itemId:i.id,name:i.name,sku:i.sku,unit:i.unit,available:decimal(balance).add(oldLine?.quantity??'0').toString()};
 }):(selected?.lines??[]).map(l=>({key:l.dispatchLineId,itemId:l.itemId,name:itemName(l.itemId),sku:snapshot.items.find(i=>i.id===l.itemId)?.sku??'',unit:snapshot.items.find(i=>i.id===l.itemId)?.unit??'',available:l.remaining}));
 return <>
  <TransferWatch snapshot={snapshot} location={location}/>
  {voiding&&<VoidStockDocument title="إلغاء مستند التحويل" reference={voiding.document.reason} close={()=>setVoiding(null)} confirm={async reason=>{
   await voidTransfer(snapshot,{transferId:voiding.transferId,expectedRevision:voiding.revision,reason});
   setVoiding(null);notify('أُلغي التحويل وسُجّل السبب في سجل التعديلات.');await synchronize();
  }}/> }
  <CollapsibleSection className="panel opening-intro"><div className="panel-heading"><div><h2>تحويلات المخزون</h2><p>من فرع أو مخزن أو مطبخ إلى موقع آخر، بقيمة الإرسال المقبولة.</p></div><button className="primary" disabled={expired||busy||snapshot.locations.filter(l=>l.active!==false).length<2} onClick={()=>start('transfer.dispatch')}>تحويل جديد</button></div>{snapshot.locations.filter(l=>l.active!==false).length<2&&<p className="disabled-reason">التحويل يحتاج موقعين نشطين: مصدر ووجهة. أضف الموقع الآخر في إعداد المخزون.</p>}<p>الإرسال يخفض المصدر. الاستلام يزيد الوجهة. المتبقي يبقى في الطريق حتى استلامه أو تسجيل فقد بسبب واضح.</p></CollapsibleSection>
  {error&&!mode&&<p role="alert" className="alert error">{error}</p>}
  {mode&&<DocumentEditor helpTopic="transfers" title={editing?'تعديل مستند التحويل':replacesId?'تصحيح المستند المرفوض':mode==='transfer.dispatch'?'إعداد إرسال مخزون':mode==='transfer.receive'?'استلام تحويل':'تسجيل فقد في الطريق'} close={()=>{setMode(null);setReplaces(undefined);}} busy={busy} className="opening-editor transfer-editor"><WorkflowForm summary={<DocumentSummary label="مواد المستند" value={num(String(editRows.filter(r=>quantities[r.key]?.trim()&&Number(normalize(quantities[r.key]))>0).length))+' مادة'} detail={mode==='transfer.dispatch'?'الإرسال يخفض رصيد المصدر بعد القبول':mode==='transfer.receive'?'الاستلام يزيد رصيد الوجهة بعد القبول':'الفقد يخص مخزون الطريق فقط'}/>} busy={expired||busy} error={error} onEdit={()=>setError('')} onInvalid={()=>setSearch('')} documentCheck={()=>Object.values(quantities).some(q=>q.trim()&&Number(normalize(q))>0)?undefined:{message:'أدخل كمية لمادة واحدة على الأقل.',field:'كمية تحويل'}} onSubmit={()=>void save()}>
   {mode==='transfer.dispatch'?<DocumentFields columns={2} title="مصدر التحويل ووجهته"><label><span className="form-label">المصدر</span><FormSelect aria-label="مصدر التحويل" disabled={!!replacesId||!!editing} value={sourceId} onChange={e=>setSource(e.target.value)}>{snapshot.locations.filter(l=>l.active!==false||editing?.document.sourceId===l.id).map(l=><option value={l.id} key={l.id}>{l.name}</option>)}</FormSelect></label><label><span className="form-label">الوجهة<span className="field-required" aria-hidden="true">*</span></span><FormSelect required aria-label="وجهة التحويل" disabled={!!replacesId||!!editing} value={destinationId} onChange={e=>setDestination(e.target.value)}><option value="">اختر الوجهة</option>{snapshot.locations.filter(l=>l.id!==sourceId&&(l.active!==false||editing?.document.destinationId===l.id)).map(l=><option value={l.id} key={l.id}>{l.name}</option>)}</FormSelect></label></DocumentFields>:<p>{selected?`${name(selected.document.sourceId)} ← ${name(selected.document.destinationId)} · ${selected.document.reason}`:'الإرسال غير متاح. زامن وراجع التحويل.'}</p>}
   <DocumentFields columns={2} title="تاريخ المستند ومرجعه"><label><span className="form-label">تاريخ المستند<span className="field-required" aria-hidden="true">*</span></span><FormInput required aria-label="تاريخ التحويل" type="date" max={today()} value={businessDate} onChange={e=>setDate(e.target.value)}/></label><label>{mode==='transfer.loss'?'سبب الفقد':'المرجع / السبب'}<FormInput required minLength={2} aria-label="سبب التحويل" maxLength={200} value={reason} onChange={e=>setReason(e.target.value)}/></label></DocumentFields>
   <div className="document-filters"><label><span className="form-label">بحث مواد التحويل</span><FormInput type="search" aria-label="بحث مواد التحويل" value={search} placeholder="اسم المادة أو الكود…" onChange={e=>setSearch(e.target.value)}/></label><button type="button" className="secondary" onClick={()=>setSearch('')}>مسح بحث التحويل</button></div><Collection rows={editRows} title="مواد التحويل" keepMounted resetKey={mode} pageResetKey={search} rowIds={row=>[row.key]} matches={row=>matchesSearch(row.name+' '+row.sku,search)}>{(pageRows,isShown,isIncluded)=><div className="entry-table table-scroll"><table><thead><tr><th>المادة</th><th>الوحدة الأساسية</th><th>{mode==='transfer.dispatch'?'الرصيد المؤكد بالمصدر':'المتبقي في الطريق'}</th><th>الكمية</th></tr></thead><tbody>{pageRows.map(row=>{const stock=issueStockPreview(row.available,quantities[row.key]??'');return <tr className={stock.status==='shortage'?'entry-row-warning':undefined} key={row.key} data-collection-row={row.key} data-keyboard-excluded={!isIncluded(row)||undefined} hidden={!isShown(row)}><td data-label="المادة">{row.name}</td><td data-label="الوحدة الأساسية">{row.unit}</td><td data-label={mode==='transfer.dispatch'?'الرصيد المؤكد بالمصدر':'المتبقي في الطريق'}>{num(row.available)}</td><td data-label="الكمية"><UnitQuantityInput unitName={row.unit} aria-invalid={stock.status==='shortage'||undefined} aria-describedby={stock.status==='shortage'?`transfer-limit-${row.key}`:undefined} placeholder="0.00" aria-label={`كمية تحويل ${row.itemId}`} dir="ltr" inputMode="decimal" value={quantities[row.key]??''} onValue={value=>setQuantities(q=>({...q,[row.key]:value}))}/>{stock.status==='shortage'&&<small role="status" id={`transfer-limit-${row.key}`} className="entry-limit-warning">تتجاوز المتاح بـ {num(stock.shortage)} {row.unit}. التوفر النهائي يراجع عند المزامنة.</small>}</td></tr>;})}</tbody></table></div>}</Collection>
   {editing&&<label><span className="form-label">سبب التعديل</span><FormInput required minLength={2} maxLength={500} aria-label="سبب تعديل التحويل" value={editReason} onChange={event=>setEditReason(event.target.value)}/></label>}
   <FormExplanation><p className="form-note">{editing?'يُحفظ التعديل بنفس رقم التحويل. التحويل المستلم بالكامل يحدّث رصيد الوجهة أيضاً. في التحويل الجزئي تبقى كميات الاستلام والفقد المسجلة كما هي.':mode==='transfer.loss'?'الفقد يخص مخزون الطريق فقط، ولا يخصم رصيد المصدر مرة أخرى. لا يمكن التراجع عن مستند مقبول محلياً.':'قيمة الإرسال حسب طريقة تكلفة المصدر؛ تُحفظ خلال الطريق وتضاف لمخزون الوجهة عند الاستلام. الكميات المحلية مؤقتة حتى المزامنة.'}</p></FormExplanation><div className="heading-actions"><button className="primary" type="submit" disabled={expired||busy||mode!=='transfer.dispatch'&&!selected}>{editing?'حفظ تعديل التحويل':'حفظ مستند التحويل'}</button><button className="secondary" disabled={busy} onClick={()=>{setMode(null);setReplaces(undefined);}}>إغلاق التحويل</button></div></WorkflowForm>
  </DocumentEditor>}
  <CollapsibleSection className="panel"><div className="panel-heading"><h2>التحويلات والطريق</h2><span className="pill">{transfers.length}</span></div><Collection rows={([...transfers].reverse())??[]} title="التحويلات والطريق" resetKey={location} searchText={t=>[t.document.reason,name(t.document.sourceId),name(t.document.destinationId),t.lines.map(l=>itemName(l.itemId)).join(" ")].join(" ")} dateValue={t=>t.document.businessDate} filters={[{key:"state",label:"حالة التحويل",value:t=>t.state,options:Object.entries(states).map(([value,label])=>({value,label}))},{key:"direction",label:"الاتجاه",value:t=>t.document.sourceId===location?"out":"in",options:[{value:"out",label:"صادر"},{value:"in",label:"وارد"}]}]} rowIds={t=>[t.document.operationId]}>{pageRows=>pageRows.map(t=>{const provisional=pending.some(r=>r.command.transferId===t.transferId),confirmed=snapshot.transfers?.find(x=>x.transferId===t.transferId);return <details className="opening-document transfer-document" key={t.transferId}><summary><strong>{t.document.reason}</strong> · {states[t.state]}{provisional&&' · كميات محلية معلقة'}</summary><p>{name(t.document.sourceId)} ← {name(t.document.destinationId)} · {t.document.businessDate}</p><Collection rows={t.lines} title={"مواد التحويل — "+t.document.reason} searchText={l=>itemName(l.itemId)}>{pageRows=>(<div className="table-scroll"><table><thead><tr><th>المادة</th><th>مرسل</th><th>مستلم</th><th>فقد</th><th>في الطريق</th></tr></thead><tbody>{pageRows.map(l=><tr key={l.dispatchLineId}><td>{itemName(l.itemId)}</td><td>{num(l.quantity)}</td><td>{num(l.received)}</td><td>{num(l.lost)}</td><td>{num(l.remaining)}</td></tr>)}</tbody></table></div>)}</Collection><p>قيمة الطريق المؤكدة: {confirmed?formatMoney(confirmed.lines.reduce((sum,l)=>sum.add(l.remainingValue),decimal('0')).toString())+' ج.م':'تنتظر قبول الإرسال'}</p>{t.lines.some(l=>decimal(l.remaining).gt(0))&&<div className="heading-actions">{t.document.destinationId===location&&<button className="secondary" disabled={expired||busy} onClick={()=>start('transfer.receive',t)}>استلام التحويل</button>}<button className="text-button" disabled={expired||busy} onClick={()=>start('transfer.loss',t)}>تسجيل فقد التحويل</button></div>}</details>})}</Collection></CollapsibleSection>
  <CollapsibleSection className="panel"><div className="panel-heading"><h2>سجل مستندات التحويل</h2></div><Collection rows={reviewFirst([...documentHistory].reverse())} title="إجراءات التحويل" resetKey={location} searchText={r=>[r.command.reason,actionName(r.command),...eventsFor(r).map(event=>event.command.reason+' '+actionName(event.command))].join(' ')} dateValue={r=>r.command.businessDate} filters={[{key:"status",label:"حالة المزامنة",value:r=>r.status,options:syncStatusOptions}]} rowIds={r=>[r.command.operationId,...eventsFor(r).map(event=>event.command.operationId)]}>{pageRows=>pageRows.map(r=><details open={r.status==='needsReview'} className="opening-document transfer-action" key={r.command.operationId} id={`operation-${r.command.operationId}`} tabIndex={-1}><summary><strong>{actionName(r.command)} · {r.command.reason}</strong> · {r.command.type==='transfer.dispatch'&&!r.command.lines.length?<span className="pill">ملغى</span>:<OperationStatus status={r.status}/>} {r.amount&&` · ${formatMoney(r.amount)} ج.م`}</summary><p>{r.command.businessDate} · {r.command.operationId.slice(0,8)}</p>{r.replacesId&&<small>تصحيح مرتبط بالمستند <DocumentLink id={r.replacesId} view="transfers" location={location}/></small>}{r.replacementId&&<small>بديل المستند <DocumentLink id={r.replacementId} view="transfers" location={location}/></small>}{r.error&&<p className="error">{r.error}</p>}{eventsFor(r).length>0&&<details className="transfer-edit-timeline"><summary>الاستلام والفقد ({num(String(eventsFor(r).length))})</summary><ul>{eventsFor(r).map(event=><li key={event.command.operationId} id={`operation-${event.command.operationId}`} tabIndex={-1}><strong>{actionName(event.command)} · {event.command.reason}</strong> · {event.command.businessDate}{event.amount&&` · ${formatMoney(event.amount)} ج.م`}</li>)}</ul></details>}{r.status==='accepted'&&r.command.type==='transfer.dispatch'&&<><TransferEditTimeline edits={snapshot.transferEdits?.filter(edit=>edit.transferId===r.command.transferId)??[]} itemName={itemName}/>{canEdit&&r.command.lines.length>0&&<div className="heading-actions"><button type="button" className="secondary" disabled={expired||busy||pending.some(row=>row.command.transferId===r.command.transferId)} onClick={()=>{const confirmed=snapshot.transfers?.find(transfer=>transfer.transferId===r.command.transferId);if(confirmed)editTransfer(confirmed);}}>تعديل التحويل</button><button type="button" className="text-button" disabled={expired||busy||pending.some(row=>row.command.transferId===r.command.transferId)} onClick={()=>setVoiding(snapshot.transfers?.find(transfer=>transfer.transferId===r.command.transferId)??null)}>إلغاء المستند</button></div>}</>}{r.status==='needsReview'&&<div className="heading-actions"><button className="secondary" disabled={expired||busy} onClick={()=>void resolve(r.command.operationId,'retry')}>إعادة محاولة التحويل</button><button className="secondary" disabled={expired||busy} onClick={()=>start(r.command.type,transfers.find(t=>t.transferId===r.command.transferId),rows.find(x=>x.id===r.command.operationId))}>تصحيح التحويل</button><button className="text-button" disabled={busy} onClick={()=>void resolve(r.command.operationId,'cancel')}>إلغاء التحويل المرفوض</button></div>}</details>)}</Collection></CollapsibleSection>
 </>;
}

function TransferEditTimeline({edits,itemName}:{edits:TransferEdit[];itemName:(id:string)=>string}){
 if(!edits.length)return null;
 const time=new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Cairo'});
 return <details className="transfer-edit-timeline">
  <summary>سجل التعديلات ({num(String(edits.length))})</summary>
  <ol>{edits.map(edit=>{
   const before=new Map(edit.previous.lines.map(line=>[line.itemId,line]));
   const after=new Map(edit.updated.lines.map(line=>[line.itemId,line]));
   const changed=[...new Set([...before.keys(),...after.keys()])].filter(id=>{
    const from=before.get(id),to=after.get(id);
    return from?.unitId!==to?.unitId||!decimal(from?.quantity??'0').eq(to?.quantity??'0');
   });
   return <li key={edit.operationId}>
    <p><time dateTime={edit.postedAt}>{time.format(new Date(edit.postedAt))}</time> · {!edit.updated.lines.length&&'إلغاء المستند · '}{edit.reason}</p>
    {edit.previous.businessDate!==edit.updated.businessDate&&<p>تاريخ المستند من <bdi>{edit.previous.businessDate}</bdi> إلى <bdi>{edit.updated.businessDate}</bdi></p>}
    {edit.previous.reason!==edit.updated.reason&&<p>المرجع: {edit.previous.reason} ← {edit.updated.reason}</p>}
    {!!changed.length&&<ul>{changed.map(id=><li key={id}>{itemName(id)} · من {num(before.get(id)?.quantity??'0')} إلى {num(after.get(id)?.quantity??'0')}</li>)}</ul>}
   </li>;
  })}</ol>
 </details>;
}
