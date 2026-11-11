'use client';

import {useEffect,useRef,useState} from 'react';
import {quantitySchema,type PostedKitchenIssue,type Snapshot} from '@saas/contracts';
import type {KitchenQuantityCorrection} from '../../../packages/contracts/document-corrections';
import {decimal} from '@saas/domain';
import {normalizeNumber} from '../../../packages/domain/opening-import';
import {DocumentEditor} from './DocumentForm';
import {confirmKitchenQuantityCorrection,pendingKitchenQuantityCorrection} from './kitchen-quantity-client';

const quantityLabel=(value:string)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:6}).format(Number(value));

export default function KitchenQuantityEditor({snapshot,issue,line,close,saved}:{
 snapshot:Snapshot;issue:PostedKitchenIssue;line:PostedKitchenIssue['lines'][number];close:()=>void;saved:(refreshed:boolean)=>void
}){
 const sourceId=issue.document.operationId;
 const [quantity,setQuantity]=useState(line.quantity),[reason,setReason]=useState(''),[error,setError]=useState('');
 const [pending,setPending]=useState<KitchenQuantityCorrection>(),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const locked=useRef(false);
 useEffect(()=>{
  let active=true;
  void pendingKitchenQuantityCorrection(snapshot,sourceId).then(request=>{
   if(!active)return;
   setPending(request);
   if(request?.lineId===line.lineId){setQuantity(request.quantity);setReason(request.reason);}
   if(request&&request.lineId!==line.lineId){
    const other=issue.lines.find(row=>row.lineId===request.lineId);
    setError('يوجد تصحيح غير مؤكد للمادة '+(other?.name??'المسجلة')+'. افتح تصحيح تلك المادة لإعادة المحاولة.');
   }
  }).catch(()=>{if(active)setError('تعذر تحميل التصحيح المحفوظ.');}).finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false;};
 },[snapshot.organizationId,snapshot.generation,snapshot.access.userId,sourceId,line.lineId]);
 const validated=quantitySchema.safeParse(normalizeNumber(quantity.trim()));
 const delta=validated.success?decimal(validated.data).sub(line.quantity):undefined;
 const source=snapshot.locations.find(location=>location.id===issue.document.locationId)?.name??issue.document.locationId;
 const destination=issue.document.kitchen;
 const retry=pending?.lineId===line.lineId;
 const disabled=loading||busy||!!pending&&!retry||!retry&&(!validated.success||delta?.isZero()||reason.trim().length<2);
 async function submit(){
  if(locked.current||disabled||!snapshot.generation||!validated.success)return;
  locked.current=true;
  setBusy(true);
  setError('');
  try{
   const refreshed=await confirmKitchenQuantityCorrection(snapshot,pending??{
    operationId:crypto.randomUUID(),organizationId:snapshot.organizationId,generation:snapshot.generation,
    kind:'kitchen_quantity',sourceId,lineId:line.lineId,expectedRevision:issue.revision??issue.quantityRevisions?.at(-1)?.revision??0,
    quantity:validated.data,reason:reason.trim()
   });
   saved(refreshed);
  }catch(e){
   setError(e instanceof Error?e.message:'تعذر تصحيح الكمية.');
   try{setPending(await pendingKitchenQuantityCorrection(snapshot,sourceId));}catch{/* Keep the original save error visible. */}
  }finally{locked.current=false;setBusy(false);}
 }
 return <DocumentEditor eyebrow={issue.document.kitchen} title="تصحيح كمية الصرف" close={close} closeLabel="إغلاق تصحيح الكمية" busy={busy}>
  <form onSubmit={event=>{event.preventDefault();void submit();}}>
   <div className="modal-body">
    <p><strong>{line.name}</strong> · الكمية المسجلة {quantityLabel(line.quantity)} {line.unit}</p>
    <label>الكمية الصحيحة<input required inputMode="decimal" value={quantity} disabled={loading||busy||!!pending} onChange={event=>setQuantity(event.target.value)}/></label>
    <label>سبب التصحيح<textarea required minLength={2} maxLength={500} value={reason} disabled={loading||busy||!!pending} onChange={event=>setReason(event.target.value)}/></label>
    {delta&&!delta.isZero()&&<p>فرق المخزون: {delta.lt(0)?destination:source} −{quantityLabel(delta.abs().toString())}، {delta.lt(0)?source:destination} +{quantityLabel(delta.abs().toString())} {line.unit}.</p>}
    {retry&&<p role="status">التصحيح محفوظ على الجهاز وبانتظار التأكيد.</p>}
    {error&&<p className="error" role="alert">{error}</p>}
   </div>
   <div className="modal-footer"><div className="modal-actions">
    <button className="primary" type="submit" disabled={disabled}>{busy?'جارٍ التأكيد…':retry?'إعادة تأكيد التصحيح':'تأكيد تصحيح الكمية'}</button>
    <button className="secondary" type="button" disabled={busy} onClick={close}>إلغاء</button>
   </div></div>
  </form>
 </DocumentEditor>;
}
