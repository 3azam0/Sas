'use client';
import {formatMoney} from './money-format';
import UnitQuantityInput from './UnitQuantityInput';
import KitchenQuantityEditor from './KitchenQuantityEditor';
import {confirmKitchenRevision,pendingKitchenRevision} from './kitchen-quantity-client';
import {kitchenEditDocumentSchema,type KitchenDocumentChanges,type KitchenIssueRevisionCommand} from '../../../packages/contracts/document-corrections';
import {correctAcceptedDocument,CorrectionReason,CorrectionLink,canCorrectDocument,voidKitchenDocument} from './document-correction-client';
import VoidStockDocument from './VoidStockDocument';
import {kitchenExport} from './document-export';
import {HelpButton} from './ClientGuide';
import {SetupEditor} from './InventorySetup';
import PrintPreview,{PrintHeader,PrintTable} from './PrintPreview';
import CollapsibleSection from './CollapsibleSection';
import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import type {PreparationSupplySeed} from '../../../packages/contracts/preparation';
import {FormSizeButton} from './DocumentForm';
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
function estimate(s:Snapshot,lines:Line[],location:string,documentPrices=false){let total=decimal('0');for(const l of lines){if(documentPrices&&l.unitPrice!==undefined){total=total.add(decimal(l.unitPrice).mul(l.quantity));continue;}const b=s.balances.find(b=>b.locationId===location&&b.itemId===l.itemId);if(!b||!decimal(b.quantity).gt(0)||!quantitySchema.safeParse(normalizeNumber(l.quantity)).success)return null;total=total.add(decimal(b.value).div(b.quantity).mul(normalizeNumber(l.quantity)));}return lines.length?total.toString():null;}

function documentValue(snapshot:Snapshot,row:IssueRow){
 const {document,posted}=row;
 if(!posted)return estimate(snapshot,document.lines,document.locationId,true);
 const costs=new Map(posted.lines.map(line=>[line.lineId,line.amount]));
 return document.lines.reduce((sum,line)=>sum.add(line.unitPrice===undefined
  ?costs.get(line.lineId)??'0'
  :decimal(line.unitPrice).mul(line.quantity)),decimal('0')).toString();
}

export default function KitchenIssues({snapshot,location,rows,setups,commands,openings,expired,synchronize,onSaved}:{snapshot:Snapshot;location:string;rows:LocalKitchenIssue[];setups:LocalSetup[];commands:Command[];openings:OpeningDocument[];expired:boolean;synchronize:()=>Promise<void>;onSaved?:(id:string)=>void}){
 const openSupplyReport=(kind:'kitchenSupply'|'kitchenSupplyByItem')=>{const ui=useUI.getState();ui.ensureReportScope(snapshot.organizationId+':'+snapshot.generation);ui.setReportFilters({...useUI.getState().reportFilters,kind,butcheryMode:undefined,category:'',itemId:'',supplierId:'',kitchenId:'',posId:'',search:'',sort:kind==='kitchenSupplyByItem'?'name_asc':'date_desc',...(kind==='kitchenSupplyByItem'?{locationId:'*'}:{}),page:1});ui.setView('reports');};
 const [editor,setEditor]=useState<{row?:IssueRow;location:string;generation?:string}|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[printing,setPrinting]=useState<IssueRow|null>(null),[directory,setDirectory]=useState(false),[posDirectory,setPOSDirectory]=useState(false);
 const [quantityEditor,setQuantityEditor]=useState<{issue:PostedKitchenIssue;line:PostedKitchenIssue['lines'][number]}|null>(null);
 const [voiding,setVoiding]=useState<IssueRow|null>(null);
 const trigger=useRef<HTMLButtonElement|null>(null);
 const docs=new Map<string,IssueRow>(rows.map(r=>[r.id,r]));
 for(const p of snapshot.kitchenIssues??[])docs.set(p.document.operationId,{...docs.get(p.document.operationId),id:p.document.operationId,scope:snapshot.organizationId,document:p.document,status:'accepted',createdAt:p.postedAt,error:undefined,posted:p});
 const all=[...docs.values()],kitchens=[...new Set(all.map(r=>r.document.kitchen))].sort((a,b)=>a.localeCompare(b,'ar'));
 const previousById=new Map((snapshot.documentCorrections??[]).filter(edit=>edit.kind==='kitchen'&&edit.replacementId!==edit.operationId).map(edit=>[edit.replacementId,edit]));
 const trail=(id:string)=>{
  const seen=new Set([id]),edits=[];
  let edit=previousById.get(id);
  while(edit&&!seen.has(edit.sourceId)){
   seen.add(edit.sourceId);
   edits.push(edit);
   edit=previousById.get(edit.sourceId);
  }
  return edits;
 };
 const currentByDocument=new Map<string,IssueRow>();
 for(const row of all){
  if(row.document.locationId!==location&&row.document.destinationLocationId!==location)continue;
  const history=trail(row.id),root=history.at(-1)?.sourceId??row.id;
  const current=currentByDocument.get(root);
  if(!current||history.length>trail(current.id).length)currentByDocument.set(root,row);
 }
 const visible=reviewFirst([...currentByDocument.values()]);
 const voidedIds=new Set(snapshot.documentCorrections?.filter(c=>c.kind==='kitchen'&&c.replacementId===c.operationId).map(c=>c.sourceId));
 const accepted=visible.filter(r=>r.status==='accepted'&&r.posted&&!snapshot.documentCorrections?.some(c=>c.sourceId===r.id)),amount=accepted.reduce((n,r)=>n.add(r.posted!.amount),decimal('0')).toString();
 const hasKitchen=snapshot.kitchens?.some(k=>k.active&&k.locationId!==location)??false;
 const active=snapshot.locations.find(l=>l.id===location)?.active!==false&&snapshot.locations.some(l=>l.id===location);
 async function resolve(r:LocalKitchenIssue,action:'retry'|'cancel'){try{setError('');await resolveKitchenIssue(r.scope,r.id,action);if(action==='retry')await synchronize();}catch(e){setError(e instanceof Error?e.message:'تعذرت معالجة الصرف');}}
 const cost=(r:IssueRow)=>documentValue(snapshot,r);
 return <>
  <section className="panel kitchen-intro"><div><span className="eyebrow">المطابخ والمخزون الفرعي</span><h2>صرف مواد للمطبخ</h2><p>صرف المواد إلى المطبخ ينقلها إلى مخزونه. تُستهلك المواد المحددة عند بيع الوجبة من نقطة بيعه.</p></div><div className="heading-actions"><button type="button" className="secondary" onClick={()=>setPOSDirectory(true)}>إدارة نقاط البيع</button><button type="button" className="secondary" onClick={e=>{trigger.current=e.currentTarget;setDirectory(true);}}>إدارة المطابخ</button><button type="button" className="primary" disabled={expired||!active||!hasKitchen||!snapshot.items.some(i=>i.active!==false&&i.unitId)} onClick={e=>{trigger.current=e.currentTarget;setEditor({location,generation:snapshot.generation});}}>إنشاء مستند صرف</button></div></section>
  {!hasKitchen&&<p className="notice">يوجد مطبخ في الموقع الحالي؟ اختر المخزن الرئيسي مصدراً للصرف، أو أضف مطبخاً آخر من «إدارة المطابخ».</p>}
  {directory&&<KitchenDirectory snapshot={snapshot} rows={setups} expired={expired} synchronize={synchronize} close={()=>{setDirectory(false);requestAnimationFrame(()=>trigger.current?.focus());}}/>}
  {notice&&<p role="status" className="notice">{notice}</p>}{posDirectory&&<POSDirectory snapshot={snapshot} rows={setups} expired={expired} synchronize={synchronize} close={()=>setPOSDirectory(false)}/>}
  {error&&<p role="alert" className="error">{error}</p>}
  <KitchenStock snapshot={snapshot} commands={commands} openings={openings}/>
  <div className="kitchen-metrics"><section className="panel"><small>المستندات المقبولة في البيانات الحالية</small><strong>{number(accepted.length)}</strong></section><section className="panel"><small>تكلفة المخزون المصروف المقبول</small><strong>{formatMoney(amount)} <small>ج.م</small></strong></section></div>
  <CollapsibleSection className="panel"><div className="panel-heading"><div><h2>سجل صرف المطابخ</h2><p>ابحث باسم المطبخ أو المرجع أو المادة؛ المستند المقبول يحتفظ بتكلفته عند الصرف.</p></div><div className="heading-actions"><button type="button" className="secondary" onClick={()=>openSupplyReport('kitchenSupplyByItem')}>تقرير الصرف المجمع حسب المادة</button><button type="button" className="secondary" onClick={()=>openSupplyReport('kitchenSupply')}>تقرير صرف المطابخ والرسوم ←</button></div></div>
   <Collection rows={visible} title="صرف المطابخ" resetKey={location} searchText={r=>[r.document.kitchen,r.document.reference,r.document.notes,r.id,...trail(r.id).flatMap(edit=>[edit.sourceId,edit.reason]),r.document.lines.map(l=>snapshot.items.find(i=>i.id===l.itemId)?.name).join(' ')].join(' ')} sortText={r=>r.document.kitchen} dateValue={r=>r.document.businessDate} filters={[{key:'kitchen',label:'المطبخ',value:r=>r.document.kitchen,options:kitchens.map(name=>({value:name,label:name}))},{key:'status',label:'حالة المزامنة',value:r=>r.status,options:syncStatusOptions}]} sorts={amountSorts('cost','قيمة المستند',cost)} rowIds={r=>[r.id,...trail(r.id).map(edit=>edit.sourceId)]} emptyText="لم تسجّل مستندات صرف مطابخ لهذا المخزن بعد.">
    {page=>page.map(r=><details className="opening-document" key={r.id} id={'operation-'+r.id} tabIndex={-1}><summary><strong>{r.document.type==='kitchen.transfer'?'تحويل إلى ':'استهلاك سابق — '}{r.document.kitchen}{r.document.reference&&' · '+r.document.reference}</strong> · {r.document.businessDate} · {number(r.document.lines.length)} مادة {voidedIds.has(r.id)?<span className="pill">ملغى</span>:<OperationStatus status={r.status}/>}</summary>{r.status==='accepted'&&canCorrectDocument(snapshot,r.id)&&<div className="heading-actions">
     {(r.posted||r.document.type==='kitchen.issue')&&<button type="button" className="secondary" disabled={expired} onClick={e=>{trigger.current=e.currentTarget;setEditor({row:r,location:r.document.locationId,generation:snapshot.generation});}}>{r.document.type==='kitchen.transfer'?'تعديل المستند':'تعديل المواد والكميات'}</button>}
     {!r.posted?.revision&&!r.posted?.quantityRevisions?.length&&<button type="button" className="text-button" disabled={expired} onClick={()=>setVoiding(r)}>إلغاء المستند</button>}
    </div>}<div className="kitchen-document-meta"><span>رقم المستند: <bdi className="kitchen-number">{documentNumber(r.id)}</bdi></span><span>{r.document.lines.some(l=>l.unitPrice!==undefined)?'قيمة المستند':r.posted?'تكلفة المخزون الفعلية':'قيمة تقديرية'}: <strong>{cost(r)===null?'غير متاحة':formatMoney(cost(r)!)} ج.م</strong></span>{r.posted&&<span>طريقة التكلفة: {r.posted.method==='fifo'?'FIFO':'المتوسط المرجح المتحرك'}</span>}</div>
     {r.document.notes&&<p>{r.document.notes}</p>}
     <Collection rows={r.document.lines} title={'مواد الصرف — '+(r.document.reference||documentNumber(r.id))} searchText={l=>r.posted?.lines.find(x=>x.lineId===l.lineId)?.name??snapshot.items.find(i=>i.id===l.itemId)?.name??l.itemId}>{lines=><div className="table-scroll"><table><thead><tr><th>المادة</th><th>الكمية</th><th>الوحدة</th><th>سعر الصرف</th><th>قيمة الصرف</th><th>تكلفة المخزون الفعلية</th><th>الإجراء</th></tr></thead><tbody>{lines.map(l=>{const p=r.posted?.lines.find(x=>x.lineId===l.lineId),item=snapshot.items.find(i=>i.id===l.itemId);return <tr key={l.lineId}><td>{p?.name??item?.name??l.itemId}</td><td>{number(l.quantity)}</td><td>{p?.unit??item?.unit}</td><td>{l.unitPrice!==undefined?formatMoney(l.unitPrice)+' ج.م':'—'}</td><td>{l.unitPrice!==undefined?formatMoney(decimal(l.unitPrice).mul(l.quantity).toString())+' ج.م':'—'}</td><td>{p?formatMoney(p.amount)+' ج.م':'بعد القبول'}</td><td>{p&&r.posted&&r.document.type==='kitchen.transfer'&&canCorrectDocument(snapshot,r.id)&&<button type="button" className="text-button" aria-label={'تصحيح كمية '+p.name} disabled={expired} onClick={event=>{trigger.current=event.currentTarget;setQuantityEditor({issue:r.posted!,line:p});}}>تصحيح كمية</button>}</td></tr>;})}</tbody></table></div>}</Collection>
     {r.error&&<p role="alert" className="error">{r.error}</p>}{r.replacesId&&<p>تصحيح للمستند: <DocumentLink id={r.replacesId} view="kitchenIssues" location={r.document.locationId}/></p>}{r.replacementId&&<p>المستند البديل: <DocumentLink id={r.replacementId} view="kitchenIssues" location={r.document.locationId}/></p>}
     <KitchenEditHistory row={r} corrections={trail(r.id)} documents={docs} items={snapshot.items}/>{snapshot.documentCorrections?.some(c=>c.sourceId===r.id)&&<CorrectionLink snapshot={snapshot} id={r.id}/>} <div className="heading-actions"><button type="button" className="secondary" onClick={()=>setPrinting(r)}>عرض وطباعة المستند</button>{r.status==='needsReview'&&<><button type="button" className="secondary" disabled={expired} onClick={()=>void resolve(r,'retry')}>إعادة المحاولة</button><button type="button" className="secondary" disabled={expired} onClick={e=>{trigger.current=e.currentTarget;setEditor({row:r,location:r.document.locationId,generation:snapshot.generation});}}>تصحيح الصرف</button><button type="button" className="text-button" onClick={()=>void resolve(r,'cancel')}>إلغاء الصرف المرفوض</button></>}</div>
    </details>)}
   </Collection>
  </CollapsibleSection>
  {editor&&<KitchenIssueEditor key={editor.row?.id??'new'} snapshot={snapshot} location={editor.location} generation={editor.generation} initial={editor.row} commands={commands.filter(c=>!editor.row?.document.lines.some(l=>l.lineId===c.operationId))} openings={openings} close={()=>{setEditor(null);requestAnimationFrame(()=>trigger.current?.focus());}} saved={(id,confirmed)=>{setEditor(null);requestAnimationFrame(()=>trigger.current?.focus());
   if(confirmed!==undefined){setNotice(confirmed?'تم حفظ تعديلات المستند على الخادم.':'تم حفظ التعديلات على الخادم. زامن مساحة العمل لعرض المستند المحدّث.');return;}
   if(onSaved)onSaved(id);else setNotice('محفوظ على الجهاز — بانتظار المزامنة.');void synchronize();
  }}/>}
  {quantityEditor&&<KitchenQuantityEditor snapshot={snapshot} issue={quantityEditor.issue} line={quantityEditor.line}
   close={()=>{setQuantityEditor(null);requestAnimationFrame(()=>trigger.current?.focus());}}
   saved={refreshed=>{setQuantityEditor(null);setNotice(refreshed?'تم تصحيح الكمية على الخادم.':'تم التصحيح على الخادم. زامن مساحة العمل لعرض الكمية الجديدة.');requestAnimationFrame(()=>trigger.current?.focus());}}/>}
  {voiding&&<VoidStockDocument title="إلغاء مستند صرف المطبخ" reference={documentNumber(voiding.id)} close={()=>setVoiding(null)} confirm={async reason=>{
   await voidKitchenDocument(snapshot,voiding.id,reason);
   setVoiding(null);setNotice('أُلغي مستند صرف المطبخ وسُجّل السبب.');await synchronize();
  }}/>}
  {printing&&<KitchenIssuePrint snapshot={snapshot} row={printing} close={()=>setPrinting(null)}/>}
 </>;
}

type KitchenHistoryEntry={
 id:string;title:string;postedAt:string;reason:string;actor?:string;revision?:number;changes?:KitchenDocumentChanges;previousId?:string;
};

function KitchenEditHistory({row,corrections,documents,items}:{
 row:IssueRow;corrections:NonNullable<Snapshot['documentCorrections']>;documents:Map<string,IssueRow>;items:Snapshot['items'];
}){
 const posted=row.posted;
 const documentRevisions=posted?.documentRevisions??[];
 const linesById=new Map(posted?.lines.map(line=>[line.lineId,{name:line.name,unit:line.unit,itemId:line.itemId}]));
 for(const revision of documentRevisions){
  for(const line of revision.changes.lines){
   if(line.lineId&&!linesById.has(line.lineId))linesById.set(line.lineId,line);
  }
 }
 const history:KitchenHistoryEntry[]=[
  ...documentRevisions.map(edit=>({...edit,id:edit.operationId,title:'تعديل المستند'})),
  ...(posted?.quantityRevisions??[]).map(edit=>{
   const line=linesById.get(edit.lineId);
   return {...edit,id:edit.operationId,title:'تصحيح كمية',changes:{fields:[],lines:[{
    itemId:line?.itemId??edit.lineId,name:line?.name??'مادة محذوفة',unit:line?.unit??'',
    previous:{quantity:edit.previousQuantity},current:{quantity:edit.quantity}
   }]}};
  }),
  ...corrections.map(edit=>{
   const previous=documents.get(edit.sourceId)?.posted,updated=documents.get(edit.replacementId)?.document;
   return {id:edit.operationId,title:'تصحيح سابق',postedAt:edit.postedAt,reason:edit.reason,previousId:edit.sourceId,
    changes:previous&&updated?previewKitchenEdit(previous,updated,updated.lines,items):undefined};
  })
 ];
 if(!history.length)return null;
 history.sort((a,b)=>Date.parse(b.postedAt)-Date.parse(a.postedAt)||(b.revision??0)-(a.revision??0));
 const time=new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Cairo'});
 return <details className="transfer-edit-timeline">
  <summary>سجل تعديلات المستند ({number(history.length)})</summary>
  <ol>{history.map(edit=><li key={edit.id} id={edit.previousId?'operation-'+edit.previousId:undefined} tabIndex={edit.previousId?-1:undefined}>
   <p><strong>{edit.title}{edit.revision!==undefined?' '+number(edit.revision):''}</strong> · <time dateTime={edit.postedAt}>{time.format(new Date(edit.postedAt))}</time>{edit.actor&&<> · <bdi>{edit.actor}</bdi></>}</p>
   <p>{edit.reason}</p>
   {edit.previousId&&<small>المستند السابق <bdi>{documentNumber(edit.previousId)}</bdi></small>}
   {edit.changes&&<KitchenRevisionChanges changes={edit.changes}/>}
  </li>)}</ol>
 </details>;
}

export function KitchenIssueEditor({snapshot,location,generation,initial,seed,commands,openings,close,saved}:{snapshot:Snapshot;location:string;generation?:string;initial?:IssueRow;seed?:PreparationSupplySeed;commands:Command[];openings:OpeningDocument[];close:()=>void;saved:(id:string,confirmed?:boolean)=>void}){
 const original=initial?.status==='accepted'&&initial.posted?.document.type==='kitchen.transfer'?initial.posted:undefined;
 const sourceId=original?.document.operationId;
 const [pending,setPending]=useState<KitchenIssueRevisionCommand>(),[loadingPending,setLoadingPending]=useState(!!original);
 const [correctionReason,setCorrectionReason]=useState('');
 const [expanded,setExpanded]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),locked=useRef(false),operationId=useRef(seed?.operationId??crypto.randomUUID());
 const [kitchenId,setKitchenId]=useState(initial?.document.kitchenId??seed?.kitchenId??snapshot.kitchens?.find(k=>k.active&&k.name===initial?.document.kitchen)?.id??''),[businessDate,setDate]=useState(initial?.document.businessDate??seed?.businessDate??today()),[reference,setReference]=useState(initial?.document.reference??seed?.reference??''),[notes,setNotes]=useState(initial?.document.notes??seed?.notes??''),[lines,setLines]=useState<Line[]>(initial?.document.lines.map(l=>({...l,lineId:original?l.lineId:crypto.randomUUID()}))??seed?.lines.map(line=>{const balance=snapshot.balances.find(b=>b.locationId===location&&b.itemId===line.itemId);return {...line,unitPrice:balance&&decimal(balance.quantity).gt(0)?decimal(balance.value).div(balance.quantity).toFixed(6):'0'};})??[]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [entry,setEntry]=useState<IssueEntry>({itemId:'',quantity:''}),[editingId,setEditingId]=useState<string|null>(null),[entryError,setEntryError]=useState<{message:string;field:'item'|'quantity'|'price'}|null>(null),[notice,setNotice]=useState(''),[listVersion,setListVersion]=useState(0),[entryVersion,setEntryVersion]=useState(0),[lastChanged,setLastChanged]=useState(''),[showNotes,setShowNotes]=useState(!!seed||!!initial?.document.notes||!!initial?.document.reference);
 useEffect(()=>{const modal=dialog.current;modal?.showModal();modal?.querySelector<HTMLInputElement>('input[role="combobox"][aria-label="المطبخ المستلم"]')?.focus({preventScroll:true});},[]);
 useEffect(()=>{
  if(!sourceId)return;
  let active=true;
  void pendingKitchenRevision(snapshot,sourceId).then(request=>{if(active)setPending(request);})
   .catch(()=>{if(active)setError('تعذر تحميل طلب التعديل المحفوظ.');})
   .finally(()=>{if(active)setLoadingPending(false);});
  return ()=>{active=false;};
 },[sourceId,snapshot.organizationId,snapshot.generation,snapshot.access.userId]);
 const [createdItems,setCreatedItems]=useState<Snapshot['items']>([]),[newMaterial,setNewMaterial]=useState<{name:string}|null>(null);
 const catalog=[...snapshot.items,...createdItems.filter(item=>!snapshot.items.some(current=>current.id===item.id))];
 const focusAfterCreate=useRef<'item'|'quantity'|null>(null);
 function returnToEntry(kind:'item'|'quantity'){focusAfterCreate.current=kind;setNewMaterial(null);}
 useEffect(()=>{if(newMaterial||!focusAfterCreate.current)return;const kind=focusAfterCreate.current;focusAfterCreate.current=null;focusEntry(kind);},[newMaterial]);
 const originalItems=new Map(original?.document.lines.map(line=>[line.itemId,line]));
 const items=catalog.filter(i=>originalItems.has(i.id)||i.active!==false&&i.unitId),total=estimate(snapshot,lines,location,true),sourceName=snapshot.locations.find(l=>l.id===location)?.name??location;
 const available=(id:string)=>decimal(projectedQuantity(snapshot,commands,location,id,openings)).add(initial?.status==='accepted'?(initial.document.lines.find(l=>l.itemId===id)?.quantity??'0'):'0').toString();
 const destinations=(snapshot.kitchens??[]).filter(k=>k.active&&k.locationId!==location&&(!original||!!k.locationId));
 const target=destinations.find(k=>k.id===kitchenId);
 const sameKitchen=!!original&&original.document.kitchenId===kitchenId;
 const selectedItem=items.find(i=>i.id===entry.itemId),existing=!editingId?lines.find(l=>l.itemId===entry.itemId):undefined,parsedEntry=quantitySchema.safeParse(normalizeNumber(entry.quantity));
 const plannedQuantity=parsedEntry.success&&existing?decimal(existing.quantity).add(parsedEntry.data).toString():entry.quantity;
 const entryPreview=!original&&selectedItem?issueStockPreview(available(selectedItem.id),plannedQuantity):null;
 const shortageCount=original?0:lines.filter(l=>issueStockPreview(available(l.itemId),l.quantity).status==='shortage').length;
 function focusEntry(kind:'item'|'quantity'|'price'){
  const form=dialog.current?.querySelector('form');requestAnimationFrame(()=>focusControl(form?.querySelector<HTMLInputElement>(kind==='item'?'input[aria-label="مادة الصرف"]':kind==='price'?'input[aria-label="سعر وحدة الصرف"]':'input[aria-label="كمية الصرف"]'),form??null));
 }
 function defaultPrice(id:string){
  const existing=lines.find(line=>line.itemId===id);
  if(original&&existing)return existing.unitPrice??'';
  const balance=snapshot.balances.find(b=>b.locationId===location&&b.itemId===id);
  return existing?.unitPrice??(balance&&decimal(balance.quantity).gt(0)?decimal(balance.value).div(balance.quantity).toFixed(6):'0');
 }
 function updateEntry(key:'itemId'|'quantity'|'unitPrice',value:string){setEntry(old=>({...old,[key]:value,...(key==='itemId'?{unitPrice:defaultPrice(value)}:{})}));setEntryError(null);setError('');setNotice('');}
 function clearEntry(){setEntryVersion(v=>v+1);setEntry({itemId:'',quantity:''});setEditingId(null);setEntryError(null);setError('');focusEntry('item');}
 function failEntry(message:string,field:'item'|'quantity'|'price'){setEntryError({message,field});setNotice('');focusEntry(field);}
 function addEntry(){
  if(busy)return;
  if(!items.some(item=>item.id===entry.itemId)){failEntry('اختر مادة نشطة من القائمة.','item');return;}
  const input=original&&entry.unitPrice?.trim()===''?{...entry,unitPrice:null}:entry;
  const result=commitIssueEntry(lines,input,original?undefined:available(entry.itemId),originalItems.get(entry.itemId)?.lineId??crypto.randomUUID(),editingId);
  if(!result.ok){
   const messages={
    'missing-item':'اختر مادة من القائمة.',
    'invalid-quantity':'أدخل كمية موجبة حتى ٦ منازل عشرية؛ يجب أن تظل الكمية المجمعة ضمن الحد المسموح.',
    'capacity':'الحد الأقصى ٢٠٠ مادة مختلفة في المستند. يمكنك تعديل مادة موجودة أو جمع كميتها.',
    'shortage':'الكمية الإجمالية لهذه المادة أكبر من الرصيد المتوقع المتاح؛ خفّضها أو سجّل الاستلام أولًا.',
    'invalid-price':'أدخل سعراً صحيحاً حتى ٦ منازل عشرية؛ يمكن أن يكون صفراً.',
    'price-conflict':'السعر مختلف عن السطر الموجود؛ عدّل سعر السطر أولاً أو استخدم السعر نفسه لجمع الكميات.',
    'missing-edit':'المادة الجاري تعديلها لم تعد في القائمة. ألغِ التعديل واخترها مجددًا.'
   };failEntry(messages[result.reason],result.reason==='missing-item'?'item':result.reason==='invalid-price'||result.reason==='price-conflict'?'price':'quantity');return;
  }
  setEntryVersion(v=>v+1);setLines(result.lines);setLastChanged(result.line.lineId);setListVersion(v=>v+1);setEntry({itemId:'',quantity:''});setEditingId(null);setEntryError(null);setError('');
  const item=items.find(i=>i.id===result.line.itemId)!;
  setNotice((result.action==='merged'?'جُمعت الكمية مع المادة الموجودة':result.action==='updated'?'عُدلت الكمية في القائمة':'أُضيفت المادة')+' — '+item.name+' · '+number(result.line.quantity)+' '+item.unit);focusEntry('item');
 }
 function editLine(line:Line){
  if(editingId===line.lineId){focusEntry('quantity');return;}
  if(editingId||entry.itemId||entry.quantity){failEntry('أضف الإدخال الحالي أو امسحه قبل تعديل مادة أخرى.','quantity');return;}
  setEditingId(line.lineId);setEntry({itemId:line.itemId,quantity:line.quantity,unitPrice:line.unitPrice??(original?'':defaultPrice(line.itemId))});setEntryError(null);setError('');setNotice('');focusEntry('quantity');
 }
 function removeLine(line:Line){setListVersion(v=>v+1);setLines(old=>old.filter(l=>l.lineId!==line.lineId));setError('');setNotice('حُذفت المادة من المستند.');if(editingId===line.lineId)clearEntry();else focusEntry('item');}
 function keyboard(e:KeyboardEvent<HTMLFormElement>){
  if(e.key==='Enter'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&!e.nativeEvent.isComposing&&e.target instanceof HTMLInputElement&&e.target.getAttribute('aria-label')==='سعر وحدة الصرف'){e.preventDefault();if(!e.repeat&&!busy)addEntry();return;}
  if(e.key==='Enter'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&!e.nativeEvent.isComposing&&e.target instanceof HTMLInputElement&&e.target.getAttribute('aria-label')==='كمية الصرف'){
   e.preventDefault();if(!e.repeat&&!busy)focusEntry('price');
  }
 }
 function check(){
  if(snapshot.generation!==generation)return {message:'تغيّرت نسخة البيانات. أغلق المستند وافتحه مجدداً.'};
  if(loadingPending)return {message:'جارٍ التحقق من طلبات التعديل المحفوظة.'};
  if(!target&&!sameKitchen)return {message:'اختر مطبخًا نشطًا.',field:'المطبخ المستلم'};
  if(editingId||entry.itemId||entry.quantity)return {message:editingId?'احفظ تعديل الكمية أو ألغِه قبل حفظ المستند.':'أضف المادة الحالية إلى القائمة أو امسح الإدخال قبل حفظ المستند.',field:entry.itemId?'كمية الصرف':'مادة الصرف'};
  if(!original&&!lines.length)return {message:'أضف مادة واحدة على الأقل إلى القائمة.',field:'مادة الصرف'};
  const seen=new Set<string>();for(const line of lines){
   const item=items.find(i=>i.id===line.itemId);
   if(!item)return {message:'توجد مادة غير نشطة في القائمة؛ احذفها واختر مادة نشطة.'};
   if(seen.has(line.itemId))return {message:'المادة مكررة؛ احذف التكرار واجمع كميتها.'};seen.add(line.itemId);
   if(!quantitySchema.safeParse(normalizeNumber(line.quantity)).success)return {message:'عدّل كمية '+item.name+'؛ أدخل كمية موجبة.'};
   if(!original&&decimal(normalizeNumber(line.quantity)).gt(available(line.itemId)))return {message:'كمية '+item.name+' أكبر من الرصيد المتوقع المتاح؛ عدّلها من القائمة أو سجّل الاستلام أولًا.'};
  }return undefined;
 }
 async function confirmRevision(request:KitchenIssueRevisionCommand){
  try{
   const refreshed=await confirmKitchenRevision(snapshot,request);
   saved(request.sourceId,refreshed);
  }catch(error){
   setPending(await pendingKitchenRevision(snapshot,request.sourceId).catch(()=>undefined));
   throw error;
  }
 }
 async function retry(){
  if(!pending||locked.current)return;
  locked.current=true;setBusy(true);setError('');
  try{await confirmRevision(pending);}
  catch(e){setError(e instanceof Error?e.message:'تعذر تأكيد التعديل.');}
  finally{locked.current=false;setBusy(false);}
 }
 async function submit(){if(locked.current||pending)return;locked.current=true;setBusy(true);setError('');try{
   if(original&&generation){
    const previous=original.document;
    const document=kitchenEditDocumentSchema.parse({
     ...previous,generation,kitchenId,kitchen:target?.name??previous.kitchen,destinationLocationId:sameKitchen?previous.destinationLocationId:target?.locationId,
     businessDate,reference,notes,lines:lines.map(line=>({...line,unitId:originalItems.get(line.itemId)?.unitId??items.find(item=>item.id===line.itemId)?.unitId}))
    });
    await confirmRevision({kind:'kitchen_edit',operationId:crypto.randomUUID(),sourceId:previous.operationId,
     organizationId:snapshot.organizationId,generation,expectedRevision:original.revision??original.quantityRevisions?.at(-1)?.revision??0,
     reason:correctionReason,document});
    return;
   }
  const kitchen=snapshot.kitchens!.find(k=>k.id===kitchenId)!;
  const doc=kitchenIssueSchema.parse({generation,operationId:operationId.current,organizationId:snapshot.organizationId,locationId:location,type:kitchen.locationId?'kitchen.transfer':'kitchen.issue',destinationLocationId:kitchen.locationId,kitchenId,kitchen:kitchen.name,businessDate,reference,notes,capturedAt:new Date().toISOString(),schemaVersion:1,currency:'EGP',lines:lines.map(l=>({...l,quantity:normalizeNumber(l.quantity),unitId:items.find(i=>i.id===l.itemId)!.unitId}))});
  if(initial?.status==='accepted'){const id=await correctAcceptedDocument(snapshot,initial.id,'kitchen',doc,correctionReason);saved(id);}else{await saveKitchenIssue(doc,initial?.id);saved(doc.operationId);}
 }catch(e){setError(e instanceof Error&&e.name!=='ZodError'?e.message:'راجع بيانات المستند والكميات.');locked.current=false;}finally{setBusy(false);}}
 return <><dialog ref={dialog} className={`modal kitchen-issue-modal${expanded?' form-expanded':''}`} aria-labelledby="kitchen-issue-title" onCancel={e=>{e.preventDefault();if(!busy&&!newMaterial)close();}}>
  {pending?<><div className="modal-header"><h2 id="kitchen-issue-title">تأكيد تعديل مستند الصرف</h2></div>
    <div className="modal-body"><p>يوجد طلب محفوظ لهذا المستند بانتظار التأكيد.</p>
     {original&&pending.kind==='kitchen_edit'&&<KitchenRevisionChanges changes={previewKitchenEdit(original,pending.document,pending.document.lines,snapshot.items)}/>}
     {pending.kind==='kitchen_quantity'&&<p>{original?.lines.find(line=>line.lineId===pending.lineId)?.name} · الكمية المطلوبة {number(pending.quantity)}</p>}
     <p>{pending.reason}</p>{error&&<p className="error" role="alert">{error}</p>}
    </div><div className="modal-footer"><div className="modal-actions">
     <button type="button" className="primary" disabled={busy} onClick={()=>void retry()}>{busy?'جارٍ التأكيد…':'إعادة تأكيد الطلب'}</button>
     <button type="button" className="secondary" disabled={busy} onClick={close}>إغلاق</button>
    </div></div></>:<WorkflowForm className="kitchen-issue-form" busy={busy||!!newMaterial} error={error} onEdit={()=>setError('')} onInvalid={()=>{if(reference.trim().length===1||reference.length>100||notes.length>300)setShowNotes(true);}} documentCheck={check} onKeyDown={keyboard} onSubmit={()=>void submit()} header={<div className="modal-header kitchen-supply-header">
   <div className="kitchen-supply-title"><span className="eyebrow">صرف داخلي من <strong>{sourceName}</strong></span><h2 id="kitchen-issue-title">{original?'تعديل مستند صرف المطبخ':initial?'تصحيح صرف مطبخ':'صرف مواد للمطبخ'}</h2></div>
   <div className="kitchen-supply-header-fields" role="group" aria-label="بيانات مستند الصرف">
    <label><span>المطبخ المستلم <span className="field-required" aria-hidden="true">*</span></span><SearchableSelect aria-label="المطبخ المستلم" aria-describedby="kitchen-recipient-hint" required disabled={busy||!!seed} value={kitchenId} onChange={e=>setKitchenId(e.target.value)}><option value="">اختر أو ابحث عن المطبخ</option>{sameKitchen&&!target&&<option value={kitchenId}>{original?.document.kitchen}</option>}{destinations.map(k=><option key={k.id} value={k.id}>{k.name}</option>)}</SearchableSelect><small className="field-hint" id="kitchen-recipient-hint">تُضاف المواد إلى مخزون هذا المطبخ.</small></label>
    <label><span>تاريخ الصرف <span className="field-required" aria-hidden="true">*</span></span><FormInput aria-label="تاريخ الصرف" type="date" required disabled={busy} max={today()} value={businessDate} onChange={e=>setDate(e.target.value)}/></label>
   </div>
   <div className="kitchen-supply-header-actions"><FormSizeButton expanded={expanded} toggle={()=>setExpanded(value=>!value)} disabled={busy||!!newMaterial}/><HelpButton topic="kitchenSupply"/><button type="button" className="icon-button" disabled={busy} aria-label="إغلاق صرف المطبخ" onClick={close}>×</button></div><FormKeyboardHelp/>
  </div>}>
    <div className="kitchen-details-control"><button type="button" className="text-button" disabled={busy} aria-label="تفاصيل إضافية للصرف" aria-expanded={showNotes} aria-controls="kitchen-issue-notes" onClick={e=>{const form=e.currentTarget.closest('form');setShowNotes(!showNotes);if(!showNotes)requestAnimationFrame(()=>focusControl(form?.querySelector<HTMLInputElement>('[aria-label="مرجع الصرف"]'),form));}}>تفاصيل إضافية <span aria-hidden="true">{showNotes?'⌃':'⌄'}</span></button><small className="optional-summary">{[reference,notes].filter(Boolean).join(' · ')||'مرجع وملاحظات · اختياري'}</small></div>
   <div id="kitchen-issue-notes" className="kitchen-optional-fields" hidden={!showNotes}><label>مرجع الصرف <small>اختياري</small><FormInput aria-label="مرجع الصرف" minLength={2} maxLength={100} placeholder="مثال: وردية الغداء" value={reference} onChange={e=>setReference(e.target.value)}/></label><label>ملاحظات <small>اختياري</small><FormInput aria-label="ملاحظات صرف المطبخ" maxLength={300} placeholder="تفاصيل إضافية للمستلم…" value={notes} onChange={e=>setNotes(e.target.value)}/></label></div>
   {original?<label>سبب التعديل<FormInput aria-label="سبب التعديل" required minLength={2} maxLength={500} value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)}/></label>:initial?.status==='accepted'&&<CorrectionReason reason={correctionReason} setReason={setCorrectionReason}/>}
    <div className="kitchen-entry-workspace">
   <CollapsibleSection data-form-scroll className={'kitchen-entry-composer'+(editingId?' kitchen-entry-editing':'')} aria-labelledby="kitchen-entry-title">
    <div className="kitchen-material-heading"><div><h3 id="kitchen-entry-title">{editingId?'تعديل كمية المادة':'إضافة مادة للصرف'}</h3></div><button type="button" className="text-button" aria-label="إضافة مادة جديدة" disabled={busy||!!editingId} onClick={()=>setNewMaterial({name:''})}>＋ إضافة مادة جديدة</button></div>
    <div className="kitchen-composer-row" key={editingId??entryVersion}>
     <label className="kitchen-item-field"><span>المادة</span><SearchableSelect aria-label="مادة الصرف" onCreate={name=>setNewMaterial({name})} openOnFocus={!notice} value={entry.itemId} required={!!entry.quantity} disabled={!!editingId} aria-invalid={entryError?.field==='item'||undefined} aria-describedby={entryError?.field==='item'?'kitchen-entry-error':undefined} onChange={e=>{updateEntry('itemId',e.target.value);focusEntry('quantity');}} onSearchEnter={value=>{if(value){updateEntry('itemId',value);focusEntry('quantity');}else focusEntry('item');}}><option value="">ابحث باسم المادة أو الكود</option>{items.map(i=><option value={i.id} key={i.id}>{i.name} · {i.sku} · {i.unit}</option>)}</SearchableSelect></label>
     <label className="kitchen-quantity-field"><span>الكمية {selectedItem&&<small>({selectedItem.unit})</small>}</span><UnitQuantityInput unitName={selectedItem?.unit??''} packs={selectedItem?.purchaseUnits} aria-label="كمية الصرف" inputMode="decimal" dir="ltr" placeholder="0.00" validateAs="positive" required={!!entry.itemId} value={entry.quantity} aria-invalid={entryError?.field==='quantity'||entryPreview?.status==='shortage'||undefined} aria-describedby="kitchen-entry-preview" onValue={value=>updateEntry('quantity',value)}/></label>
     <label className="kitchen-price-field"><span>السعر (ج.م / {selectedItem?.unit??'وحدة مخزون'})</span><FormInput aria-label="سعر وحدة الصرف" inputMode="decimal" dir="ltr" placeholder="0.00" validateAs="nonnegative" disabled={!entry.itemId} required={!!entry.itemId&&!original} value={entry.unitPrice??''} aria-invalid={entryError?.field==='price'||undefined} aria-describedby={entryError?.field==='price'?'kitchen-entry-error':undefined} onChange={e=>updateEntry('unitPrice',e.target.value)}/></label>
     <button data-keyboard-add type="button" className="primary kitchen-entry-add" onClick={addEntry}>{editingId?'حفظ التعديل':'إضافة للقائمة'} <kbd>↵</kbd></button>
    </div>
    <div id="kitchen-entry-preview" className="kitchen-entry-preview">{selectedItem?<>{!original&&<span>المتاح <strong>{number(available(selectedItem.id))} {selectedItem.unit}</strong></span>}{existing&&<span>في القائمة <strong>{number(existing.quantity)} {selectedItem.unit}</strong> · تُضاف الكمية الجديدة إليها</span>}{entryPreview?.status==='ready'&&<span>المتبقي بعد الصرف <strong>{number(entryPreview.remaining!)} {selectedItem.unit}</strong></span>}{entryPreview?.status==='shortage'&&<span className="kitchen-entry-shortage">الإجمالي يتجاوز المتاح بـ <strong>{number(entryPreview.shortage!)} {selectedItem.unit}</strong></span>}</>:<span>اختر المادة لعرض وحدتها ورصيدها المتاح.</span>}{(entry.itemId||entry.quantity||editingId)&&<button type="button" className="text-button" onClick={clearEntry}>{editingId?'إلغاء التعديل':'مسح الإدخال'}</button>}</div>
    {entryError&&<p id="kitchen-entry-error" className="field-error" role="alert">{entryError.message}</p>}
    <p className="kitchen-entry-notice" role="status" aria-live="polite">{notice}</p>
   </CollapsibleSection>
   <CollapsibleSection className={'kitchen-receipt-section'+(lines.length<=10?' kitchen-compact-receipt':'')} aria-labelledby="kitchen-materials-title">
    <div className="kitchen-material-heading"><h3 id="kitchen-materials-title">قائمة مواد الصرف <span className="pill">{number(lines.length)} مادة</span></h3><span className="kitchen-receipt-order">افتراضيًا: آخر إضافة في الأعلى</span></div>
    <Collection rows={lines} title="مواد مستند الصرف" searchText={lines.length>10?l=>{const item=snapshot.items.find(i=>i.id===l.itemId);return (item?.name??l.itemId)+' '+(item?.sku??'');}:undefined} sorts={lines.length>10?amountSorts<Line>('quantity','الكمية',l=>l.quantity):[]} resetKey={String(listVersion)} rowIds={l=>[l.lineId]} emptyText={lines.length?'لا توجد مواد مطابقة للبحث.':'لم تُضف مواد بعد. اختر مادة وأدخل الكمية ثم اضغط Enter.'}>{page=><div className="kitchen-list-scroll material-list-scroll" tabIndex={0} role="region" aria-label="تمرير قائمة مواد الصرف"><ol className="kitchen-receipt-list">{page.map(line=>{
     const item=snapshot.items.find(i=>i.id===line.itemId),q=available(line.itemId),preview=issueStockPreview(q,line.quantity),value=item?estimate(snapshot,[line],location,true):null,unitCost=line.unitPrice??(value===null?null:decimal(value).div(line.quantity).toString());
     return <li key={line.lineId}><article className={'kitchen-receipt-line'+(!original&&preview.status==='shortage'?' kitchen-line-shortage':'')+(lastChanged===line.lineId?' kitchen-receipt-latest':'')} aria-label={'مادة بالقائمة '+(item?.name??line.itemId)}>
      <div className="kitchen-receipt-item"><strong>{item?.name??line.itemId}</strong><small><bdi>{item?.sku??'—'}</bdi> · {item?.category??'—'}</small>{!original&&<span>المتاح {number(q)} {item?.unit}{preview.status==='ready'&&<> · المتبقي {number(preview.remaining!)} {item?.unit}</>}</span>}</div>
      <dl className="kitchen-receipt-details"><div><dt>الكمية</dt><dd className="kitchen-receipt-quantity">{number(line.quantity)} <small>{item?.unit}</small></dd></div><div><dt>سعر الصرف</dt><dd>{unitCost===null?'—':formatMoney(unitCost)+' ج.م'}</dd></div><div><dt>قيمة الصرف</dt><dd>{value===null?'—':formatMoney(value)+' ج.م'}</dd></div></dl>
      <div className="kitchen-receipt-actions"><button type="button" className="text-button" aria-label={'تعديل كمية '+(item?.name??line.itemId)} onClick={()=>editLine(line)}>{editingId===line.lineId?'جارٍ التعديل':'تعديل'}</button><button type="button" className="text-button kitchen-receipt-remove" aria-label={'حذف '+(item?.name??line.itemId)+' من مستند الصرف'} onClick={()=>removeLine(line)}>حذف</button></div>
      {!original&&preview.status==='shortage'&&<p className="kitchen-stock-warning" role="status">الكمية تتجاوز المتاح بـ {number(preview.shortage!)} {item?.unit}. عدّل الكمية قبل الحفظ.</p>}
     </article></li>;
    })}</ol></div>}</Collection>
   </CollapsibleSection>
   </div>
   {original&&<KitchenEditPreview original={original} lines={lines} businessDate={businessDate} kitchen={sameKitchen?original.document.kitchen:target?.name??''} kitchenId={kitchenId} reference={reference} notes={notes} items={items} sourceName={sourceName}/>}
   <div className="workflow-actions kitchen-issue-actions">
    <div className="kitchen-issue-total"><div><span>إجمالي المستند · {number(lines.length)} مادة</span><strong>{total===null?'—':formatMoney(total)+' ج.م'}</strong></div><small>{total===null?(lines.length?'لا تتوفر تكلفة مؤكدة لبعض المواد؛ تُثبت القيمة بعد قبول المزامنة.':'يظهر بعد إضافة المواد إلى القائمة.'):'سعر خاص بمستند المطبخ؛ تكلفة المخزون لا تتغير.'}</small>{shortageCount>0&&<span className="kitchen-shortage-count" role="status">راجع الكمية في {number(shortageCount)} مادة</span>}<small className="kitchen-consumption-note">المواد تُنقل إلى مخزون المطبخ بقيمتها الحالية؛ الاستهلاك يحدث عند البيع أو الهالك.</small></div>
    <div className="kitchen-save-buttons"><button type="submit" className="primary" disabled={loadingPending}>{busy?'جارٍ الحفظ…':original?'حفظ تعديلات المستند':'حفظ صرف المطبخ'}</button><button type="button" className="secondary" onClick={close}>إلغاء</button></div>
   </div>
  </WorkflowForm>}
 </dialog>{newMaterial&&<SetupEditor section="items" snapshot={{...snapshot,items:catalog}} composeAvailable={false} saved={()=>{}} close={()=>returnToEntry('item')} quickCreate={{name:newMaterial.name,context:'أضف المادة واخترها في سطر الصرف الحالي. بيانات المستند محفوظة. يبدأ رصيد المادة بصفر؛ سجّل استلامًا قبل صرفها.',created:record=>{
  setCreatedItems(previous=>[...previous,{...record,unit:snapshot.units?.find(unit=>unit.id===record.unitId)?.name??''}]);
  updateEntry('itemId',record.id);returnToEntry('quantity');setNotice('تم حفظ المادة برصيد صفر. سجّل استلامًا قبل صرفها للمطبخ.');
 }}}/>}</>;
}

type EditFields=Pick<KitchenIssueDocument,'businessDate'|'kitchen'|'kitchenId'|'reference'|'notes'>;
const changeLabels={businessDate:'تاريخ المستند',kitchen:'المطبخ المستلم',reference:'المرجع',notes:'الملاحظات'};

function previewKitchenEdit(original:PostedKitchenIssue,updated:EditFields,lines:Line[],items:Snapshot['items']):KitchenDocumentChanges{
 const previous=original.document;
 const fields:KitchenDocumentChanges['fields']=Object.keys(changeLabels).map(key=>key as keyof typeof changeLabels)
  .filter(field=>previous[field]!==updated[field]||field==='kitchen'&&previous.kitchenId!==updated.kitchenId)
  .map(field=>({field,previous:previous[field],current:updated[field]}));
 const before=new Map(previous.lines.map(line=>[line.itemId,line]));
 const after=new Map(lines.map(line=>[line.itemId,line]));
 const changes:KitchenDocumentChanges['lines']=[];
 for(const itemId of new Set([...before.keys(),...after.keys()])){
  const prior=before.get(itemId),current=after.get(itemId);
  if(prior&&current&&decimal(prior.quantity).eq(current.quantity)&&equalPrice(prior.unitPrice,current.unitPrice))continue;
  const item=original.lines.find(line=>line.itemId===itemId)??items.find(row=>row.id===itemId);
  changes.push({itemId,name:item?.name??itemId,unit:item?.unit??'',previous:prior,current});
 }
 return {fields,lines:changes};
}

function equalPrice(a?:string,b?:string){
 return a===undefined||b===undefined?a===b:decimal(a).eq(b);
}

function KitchenRevisionChanges({changes}:{changes:KitchenDocumentChanges}){
 if(!changes.fields.length&&!changes.lines.length)return null;
 return <ul>{changes.fields.map(({field,previous,current})=><li key={field}>{changeLabels[field]} · {previous||'—'} ← {current||'—'}</li>)}
  {changes.lines.map(({itemId,name,unit,previous,current})=><li key={itemId}>
   {name} · {!previous?'إضافة ':!current?'حذف ':''}{number(previous?.quantity??'0')} ← {number(current?.quantity??'0')} {unit}
   {!equalPrice(previous?.unitPrice,current?.unitPrice)&&<> · سعر الوحدة {previous?.unitPrice===undefined?'—':formatMoney(previous.unitPrice)} ← {current?.unitPrice===undefined?'—':formatMoney(current.unitPrice)} ج.م</>}
  </li>)}
 </ul>;
}

function KitchenEditPreview({original,lines,items,sourceName,...fields}:EditFields&{original:PostedKitchenIssue;lines:Line[];items:Snapshot['items'];sourceName:string}){
 const changes=previewKitchenEdit(original,fields,lines,items);
 if(!changes.lines.length&&!changes.fields.length)return null;
 const changedKitchen=original.document.kitchenId!==fields.kitchenId;
 const before=new Map(original.document.lines.map(line=>[line.itemId,line.quantity]));
 const after=new Map(lines.map(line=>[line.itemId,line.quantity]));
 const affected=changedKitchen?[...new Set([...before.keys(),...after.keys()])]:changes.lines.map(line=>line.itemId);
 const movements=affected.flatMap(id=>{
  const old=decimal(before.get(id)??'0'),next=decimal(after.get(id)??'0'),delta=next.sub(old);
  const locations=changedKitchen?[[original.document.kitchen,old.neg()],[fields.kitchen,next],[sourceName,delta.neg()]] as const
   :[[fields.kitchen,delta],[sourceName,delta.neg()]] as const;
  const net=locations.filter(([,quantity])=>!quantity.isZero());
  if(!net.length)return [];
  const item=original.lines.find(line=>line.itemId===id)??items.find(row=>row.id===id);
  return [<li key={id}>{item?.name??id} · {net.map(([place,quantity])=>place+' '+(quantity.gt(0)?'+':'−')+number(quantity.abs().toString())+' '+(item?.unit??'')).join('، ')}</li>];
 });
 return <details className="kitchen-receipt-section" open><summary>مراجعة تعديلات المستند</summary>
  <KitchenRevisionChanges changes={changes}/>
  {movements.length>0&&<><strong>فرق كميات المخزون</strong><ul>{movements}</ul></>}
 </details>;
}

function KitchenIssuePrint({snapshot,row,close}:{snapshot:Snapshot;row:IssueRow;close:()=>void}){
 return <PrintPreview organizationId={snapshot.organizationId} documentId={row.id} title="طباعة مستند صرف" exportRows={kitchenExport(snapshot,row)} close={close}><KitchenIssuePrintSheet snapshot={snapshot} row={row}/></PrintPreview>;
}
export function KitchenIssuePrintSheet({snapshot,row}:{snapshot:Snapshot;row:IssueRow}){
 const d=row.document,p=row.posted;
 return <><PrintHeader snapshot={snapshot} title={d.type==='kitchen.transfer'?'مستند تحويل مخزون للمطبخ':'مستند استهلاك مواد للمطبخ'} number={documentNumber(row.id)}/><div className="document-print-meta"><p>المطبخ: <strong>{d.kitchen}</strong></p><p>التاريخ: {d.businessDate}</p><p>المخزن: {snapshot.locations.find(l=>l.id===d.locationId)?.name??d.locationId}</p><p>المرجع: {d.reference||'—'}</p></div>{snapshot.documentCorrections?.some(edit=>edit.sourceId===row.id&&edit.replacementId===edit.operationId)&&<p className="document-print-warning">مستند ملغى</p>}{!p&&<p className="document-print-warning">غير مقبول بعد — حالة المزامنة: <OperationStatus status={row.status}/> · الكميات والتكلفة غير نهائية.</p>}
 <PrintTable columns={['المادة','الكمية','الوحدة','سعر الصرف ج.م','قيمة الصرف ج.م','تكلفة المخزون ج.م']} rows={d.lines.map(l=>{const v=p?.lines.find(x=>x.lineId===l.lineId),item=snapshot.items.find(i=>i.id===l.itemId);return {id:l.lineId,cells:[<><strong>{v?.name??item?.name??l.itemId}</strong><small><bdi>{item?.sku}</bdi></small></>,number(l.quantity),v?.unit??item?.unit??'—',l.unitPrice!==undefined?formatMoney(l.unitPrice):v?formatMoney(decimal(v.amount).div(l.quantity).toString()):'—',l.unitPrice!==undefined?formatMoney(decimal(l.unitPrice).mul(l.quantity).toString()):v?formatMoney(v.amount):'—',v?formatMoney(v.amount):'—']};})}/>
 {d.lines.some(l=>l.unitPrice!==undefined)&&<p className="document-print-total">قيمة مستند الصرف: <strong>{formatMoney(documentValue(snapshot,row)??'0')} ج.م</strong><small> · أسعار للمستند فقط؛ لا تغيّر تكلفة المخزون.</small></p>}
 <p className="document-print-total">{d.type==='kitchen.transfer'?'قيمة المخزون المنقول':'قيمة الاستهلاك'}: <strong>{p?formatMoney(p.amount)+' ج.م':'تُثبت بعد قبول المزامنة'}</strong></p>{d.notes&&<p className="document-print-note">ملاحظات: {d.notes}</p>}<p className="document-print-note">{d.type==='kitchen.transfer'?'هذا تحويل مخزون؛ لا يحتسب استهلاكاً.':'المواد المصروفة في هذا المستند احتسبت استهلاكاً مباشراً.'}</p><div className="document-print-signatures"><p>توقيع مسؤول المخزن: __________________</p><p>توقيع المستلم: __________________</p></div><footer className="document-print-footer">FooDo · مستند داخلي لصرف المواد</footer></>;
}
