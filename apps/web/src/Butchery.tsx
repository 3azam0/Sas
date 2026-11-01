'use client';
import {useState,type FormEvent} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import type {Snapshot} from '@saas/contracts';
import {averageIssue,decimal} from '@saas/domain';
import {workshopCommandSchema,type WorkshopCommand,type MeatKind} from '../../../packages/contracts/butchery';
import {local} from './offline';
import {saveWorkshop,resolveWorkshop} from './workshop-offline';

import {workshopTitles as titles} from './workshop-labels';
const kinds:Record<MeatKind,string>={beef_input:'لحم بقري مشترى',sheep_live:'ضاني حي',beef_product:'منتج بقري للمطبخ',lamb_product:'منتج ضاني للمطبخ'};
const num=(v:string|number)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:3}).format(Number(v));
const normalize=(v:string)=>v.replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/٫/g,'.').trim();
const valid=(v:string)=>/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(v);
type Output={itemId:string;quantity:string;costShare:string};

export default function Butchery({snapshot,synchronize}:{snapshot:Snapshot;synchronize:()=>Promise<void>}) {
 const [tab,setTab]=useState('process'),[mode,setMode]=useState<'beef'|'lamb'>('beef'),[input,setInput]=useState(''),[quantity,setQuantity]=useState(''),[processing,setProcessing]=useState('0');
 const [outputs,setOutputs]=useState<Output[]>([{itemId:'',quantity:'',costShare:'100'}]);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false),[source,setSource]=useState('central');
 const rows=useLiveQuery(()=>local.workshop.where('scope').equals(snapshot.organizationId).toArray(),[snapshot.organizationId],[]);
 const expired=Date.parse(snapshot.access.expiresAt)<=Date.now();
 const items=snapshot.items.filter(i=>i.meatKind),products=items.filter(i=>i.meatKind===(mode==='beef'?'beef_product':'lamb_product'));
 const inputs=items.filter(i=>i.meatKind===(mode==='beef'?'beef_input':'sheep_live'));
 const pending=rows.filter(r=>r.status==='pending'||r.status==='acceptedAwaiting'),review=rows.filter(r=>r.status==='needsReview');
 const name=(id:string)=>snapshot.items.find(i=>i.id===id)?.name||id;
 const location=(id:string)=>snapshot.locations.find(l=>l.id===id)?.name||id;
 const available=(id:string,at='butchery')=>num(snapshot.balances.find(b=>b.locationId===at&&b.itemId===id)?.quantity||'0');
 const stock=snapshot.balances.filter(b=>b.locationId==='butchery'&&decimal(b.quantity).gt(0));
 let estimated:string|undefined;
 try{if(valid(quantity)&&decimal(quantity).gt(0)&&valid(processing))estimated=decimal(averageIssue(snapshot.layers.filter(l=>l.locationId==='butchery'&&l.itemId===input),quantity).amount).add(processing).toFixed(12);}catch{/* Confirmed stock is required for a reliable cost preview. */}
 const shares=outputs.reduce((n,o)=>n.add(valid(o.costShare)?o.costShare:'0'),decimal('0'));
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget,data=new FormData(form);setSaving(true);setError('');setNotice('');
  const field=(key:string)=>String(data.get(key)||'').trim();const weight=(key:string)=>normalize(field(key));
  try{
   const businessDate=field('businessDate'),base={operationId:crypto.randomUUID(),organizationId:snapshot.organizationId,businessDate,capturedAt:new Date().toISOString(),schemaVersion:1,reason:field('reason')};
   let command:unknown;
   if(tab==='catalog')command={...base,type:'product.create',itemId:crypto.randomUUID(),name:field('name'),meatKind:field('meatKind')};
   else if(tab==='process')command={...base,type:'butchery.process',mode,itemId:input,quantity,headCount:mode==='lamb'?Number(weight('headCount')):undefined,carcassWeight:mode==='lamb'?weight('carcassWeight'):undefined,slaughterLoss:mode==='lamb'?weight('slaughterLoss'):'0',cuttingLoss:weight('cuttingLoss'),processingCost:processing,outputs};
   else if(tab==='dispatch')command={...base,type:'transfer.dispatch',sourceId:source,destinationId:field('destinationId'),itemId:field('itemId'),quantity:weight('quantity')};
   else command={...base,type:'transfer.receive',transferId:field('transferId'),quantity:weight('quantity')};
   const parsed=workshopCommandSchema.parse(command);
   if(parsed.type==='butchery.process'){
    if(!shares.eq(100))throw new Error('مجموع نسب التكلفة يجب أن يساوي 100%');
    if(new Set(outputs.map(o=>o.itemId)).size!==outputs.length)throw new Error('اختر أصناف مخرجات مختلفة');
    const total=outputs.reduce((n,o)=>n.add(o.quantity),decimal('0'));
    if(mode==='lamb'&&(!decimal(parsed.carcassWeight!).add(parsed.slaughterLoss).eq(quantity)||!total.add(parsed.cuttingLoss).eq(parsed.carcassWeight!)))throw new Error('راجع توازن الوزن الحي والذبيحة والمخرجات والفاقد');
    if(mode==='beef'&&!total.add(parsed.cuttingLoss).eq(quantity))throw new Error('وزن المخرجات والفاقد يجب أن يساوي وزن المدخل');
   }
   if(parsed.type==='transfer.dispatch'&&parsed.sourceId===parsed.destinationId)throw new Error('اختر وجهة تختلف عن المصدر');
   await saveWorkshop(parsed);setNotice('حُفظت العملية على هذا الجهاز. تصبح نهائية بعد قبول المزامنة.');
   if(tab==='process'){setQuantity('');setOutputs([{itemId:'',quantity:'',costShare:'100'}]);}else form.reset();
   if(navigator.onLine)void synchronize();
  }catch(e){setError(e instanceof Error&&e.name!=='ZodError'?e.message:'أكمل الحقول بأرقام صحيحة؛ الكميات موجبة والأسماء حرفان على الأقل.');}finally{setSaving(false);}
 }
 async function resolve(id:string,action:'retry'|'cancel'){try{await resolveWorkshop(snapshot.organizationId,id,action);if(action==='retry'&&navigator.onLine)void synchronize();}catch(e){setError(e instanceof Error?e.message:'تعذر تحديث العملية');}}
 const update=(index:number,key:keyof Output,value:string)=>setOutputs(old=>old.map((o,i)=>i===index?{...o,[key]:key==='itemId'?value:normalize(value)}:o));
 const transit=(snapshot.transfers||[]).filter(t=>decimal(t.remaining).gt(0));
 return <div className="butchery">
  <section className="panel butchery-intro"><span className="eyebrow">المطبخ المركزي</span><h2>الجزارة والتجهيز</h2><p>ضاني حي للذبح والتقطيع، ولحم بقري مشترى للتقطيع. حوّل المدخلات إلى الجزارة واستلمها، ثم جهّز منتجات المطبخ وأرسلها إلى المخزن أو الفروع.</p><div className="butchery-summary"><span>أصناف بالجزارة <b>{num(stock.length)}</b></span><span>تحويلات بالطريق <b>{num(transit.length)}</b></span><span>بانتظار المزامنة <b>{num(pending.length)}</b></span><span>تحتاج مراجعة <b>{num(review.length)}</b></span></div></section>
  <div className="butchery-tabs" role="group" aria-label="عمليات الجزارة">{Object.entries({process:'دفعة تجهيز',dispatch:'إرسال تحويل',receive:'استلام تحويل',catalog:'تعريف الأصناف',history:'السجل والأرصدة'}).map(([key,label])=><button className={tab===key?'primary':'secondary'} key={key} onClick={()=>{setTab(key);setError('');}}>{label}</button>)}</div>
  {error&&<p className="alert error" role="alert">{error}</p>}{notice&&<p className="alert success" role="status">{notice}</p>}
  {tab!=='history'&&<section className="panel"><div className="panel-heading"><h2>{tab==='catalog'?'تعريف صنف باسمك':tab==='process'?'تسجيل دفعة تجهيز':tab==='dispatch'?'إرسال من المخزن أو الجزارة':'تأكيد الكمية المستلمة'}</h2><span className="pill">حفظ محلي ثم مزامنة</span></div><form className="butchery-form" key={tab} onSubmit={submit}>
   <fieldset disabled={saving||expired}>
   {tab==='catalog'&&<><label>كود المادة<input readOnly value='يُولَّد تلقائيًا عند المزامنة'/></label><div className="form-row"><label>اسم الصنف<input name="name" required minLength={2} maxLength={100}/></label><label>نوع الصنف<select aria-label="نوع الصنف" name="meatKind">{Object.entries(kinds).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div><p className="table-help">كل الأصناف بالكيلوجرام. الضاني الحي يُستلم بوزنه الحي؛ عدد الرؤوس يُسجل في دفعة التجهيز. اختر الصنف الموجود عند تكرار الاستخدام.</p></>}
   {tab==='process'&&<><label>مرجع الدفعة<input readOnly value='يُولَّد تلقائيًا عند المزامنة'/></label>
    <div className="form-row"><label>مسار التجهيز<select aria-label="مسار التجهيز" value={mode} onChange={e=>{setMode(e.target.value as 'beef'|'lamb');setInput('');setOutputs([{itemId:'',quantity:'',costShare:'100'}]);}}><option value="beef">تقطيع لحم بقري مشترى</option><option value="lamb">ذبح وتقطيع ضاني</option></select></label><label>صنف المدخل<select aria-label="صنف المدخل" required value={input} onChange={e=>setInput(e.target.value)}><option value="">اختر الصنف</option>{inputs.map(i=><option key={i.id} value={i.id}>{i.name} · المتاح {available(i.id)} كجم</option>)}</select></label></div>
    {(!inputs.length||!products.length)&&<p className="form-warning">عرّف أصناف المدخلات والمنتجات أولاً من «تعريف الأصناف».</p>}
    <div className="form-row"><label>{mode==='lamb'?'الوزن الحي (كجم)':'وزن اللحم المستخدم (كجم)'}<input required inputMode="decimal" value={quantity} onChange={e=>setQuantity(normalize(e.target.value))}/></label><label>تكاليف التجهيز الإضافية (ج.م)<input required inputMode="decimal" value={processing} onChange={e=>setProcessing(normalize(e.target.value))}/></label></div>
    {mode==='lamb'&&<><div className="form-row"><label>عدد الرؤوس<input name="headCount" required inputMode="numeric"/></label><label>وزن الذبيحة والأحشاء المستخدمة (كجم)<input name="carcassWeight" required inputMode="decimal"/></label><label>فاقد الذبح (كجم)<input name="slaughterLoss" required defaultValue="0" inputMode="decimal"/></label></div><p className="table-help">أدخل وزن الذبيحة مع الأحشاء المستخدمة في المطبخ. الوزن الحي = هذا الوزن + فاقد الذبح.</p></>}
    <h3>المنتجات الناتجة ونسب التكلفة</h3><p className="table-help">أضف كل منتج أو ناتج قابل للاستخدام. يمكن أن تكون نسبة تكلفته صفراً؛ مجموع النسب يجب أن يساوي 100%.</p>
    {outputs.map((o,index)=><div className="butchery-output" key={index}><label>المنتج {index+1}<select aria-label={`المنتج ${index+1}`} required value={o.itemId} onChange={e=>update(index,'itemId',e.target.value)}><option value="">اختر المنتج</option>{products.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label><label>وزن المنتج {index+1} (كجم)<input required inputMode="decimal" value={o.quantity} onChange={e=>update(index,'quantity',e.target.value)}/></label><label>نسبة التكلفة {index+1} (%)<input required inputMode="decimal" value={o.costShare} onChange={e=>update(index,'costShare',e.target.value)}/></label><button type="button" className="text-button" disabled={outputs.length===1} onClick={()=>setOutputs(old=>old.filter((_,i)=>i!==index))}>حذف</button></div>)}
    <button type="button" className="secondary" disabled={outputs.length>=50} onClick={()=>setOutputs(old=>[...old,{itemId:'',quantity:'',costShare:'0'}])}>إضافة منتج للدفعة</button>
    <div className="form-row"><label>فاقد التقطيع (كجم)<input name="cuttingLoss" required defaultValue="0" inputMode="decimal"/></label><div className="operation-summary"><span>مجموع نسب التكلفة</span><strong className={shares.eq(100)?'success':'error'}>{num(shares.toString())}%</strong></div></div>
    <div className="operation-summary"><span>تكلفة الدفعة المتوقعة من الرصيد المؤكد</span><strong>{estimated?`${num(estimated)} ج.م`:'تتوفر بعد تحديد مدخل برصيد كافٍ'}</strong></div>
    {estimated&&<div className="table-scroll"><table><thead><tr><th>المنتج</th><th>التكلفة المتوقعة</th><th>تكلفة الكجم</th></tr></thead><tbody>{outputs.map((o,i)=>{const cost=decimal(estimated!).mul(valid(o.costShare)?o.costShare:'0').div(100);return <tr key={i}><td>{o.itemId?name(o.itemId):'—'}</td><td>{num(cost.toString())}</td><td>{valid(o.quantity)&&decimal(o.quantity).gt(0)?num(cost.div(o.quantity).toString()):'—'}</td></tr>;})}</tbody></table></div>}
    <p className="table-help">المنتجات + فاقد التقطيع = وزن اللحم المستخدم. تُحسب التكلفة النهائية عند قبول العملية؛ يبقى الفاقد ضمن تكلفة المنتجات.</p>
   </>}
   {tab==='dispatch'&&<><div className="form-row"><label>مصدر التحويل<select aria-label="مصدر التحويل" value={source} onChange={e=>setSource(e.target.value)}>{snapshot.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label>وجهة التحويل<select aria-label="وجهة التحويل" name="destinationId" required defaultValue=""><option value="">اختر الوجهة</option>{snapshot.locations.filter(l=>l.id!==source&&(source==='butchery'||l.id==='butchery')).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label></div><div className="form-row"><label>الصنف المحوّل<select aria-label="الصنف المحوّل" name="itemId" required defaultValue=""><option value="">اختر الصنف</option>{items.map(i=><option key={i.id} value={i.id}>{i.name} · المتاح {available(i.id,source)} كجم</option>)}</select></label><label>كمية الإرسال (كجم)<input name="quantity" required inputMode="decimal"/></label></div><p className="table-help">الإرسال يخصم من المصدر ويضع الكمية بالطريق. يمكن تقسيم دفعة على أكثر من وجهة بتحويلات مستقلة.</p></>}
   {tab==='receive'&&<><label>التحويل المطلوب استلامه<select aria-label="التحويل المطلوب استلامه" name="transferId" required defaultValue=""><option value="">اختر التحويل</option>{transit.map(t=><option key={t.id} value={t.id}>{name(t.itemId)} · {location(t.sourceId)} ← {location(t.destinationId)} · متبقٍ {num(t.remaining)} كجم · {t.reference||t.id.slice(0,8)}</option>)}</select></label><label>كمية الاستلام الفعلية (كجم)<input name="quantity" required inputMode="decimal"/></label><p className="table-help">يمكن الاستلام جزئياً. يبقى الباقي بالطريق، ولا يُضاف للمخزون قبل التأكيد. زامن الإرسال أولاً لتنزيل التحويل.</p>{!transit.length&&<p className="form-warning">لا توجد تحويلات مؤكدة بالطريق حالياً.</p>}</>}
   <div className="form-row"><label>تاريخ العمل<input type="date" name="businessDate" required defaultValue={new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}/></label><label>{tab==='process'?'سبب الفاقد / ملاحظة التجهيز':'ملاحظات (اختياري)'}<input name="reason" required={tab==='process'} minLength={tab==='process'?2:undefined} maxLength={200}/></label></div><button className="primary" type="submit">{saving?'جارٍ الحفظ…':'حفظ عملية الجزارة'}</button>
   </fieldset>
  </form></section>}
  {tab==='history'&&<><section className="panel"><div className="panel-heading"><h2>الرصيد المؤكد داخل الجزارة</h2></div><div className="table-scroll"><table><thead><tr><th>الصنف</th><th>الكمية (كجم)</th><th>القيمة (ج.م)</th></tr></thead><tbody>{stock.map(b=><tr key={b.itemId}><td>{name(b.itemId)}</td><td>{num(b.quantity)}</td><td>{num(b.value)}</td></tr>)}</tbody></table>{!stock.length&&<p className="empty">لا يوجد رصيد مؤكد داخل الجزارة.</p>}</div></section>
   <section className="panel"><div className="panel-heading"><h2>التحويلات بالطريق</h2></div>{transit.map(t=><div className="butchery-history" key={t.id}><strong>{name(t.itemId)} · {num(t.remaining)} كجم</strong><p>{location(t.sourceId)} ← {location(t.destinationId)} · قيمة متبقية {num(t.remainingValue)} ج.م · {t.reference||t.id.slice(0,8)}</p></div>)}{!transit.length&&<p className="empty">لا توجد كميات بالطريق.</p>}</section>
   <section className="panel"><div className="panel-heading"><h2>سجل الدفعات والتحويلات المقبولة</h2></div>{(snapshot.workshopDocuments||[]).map(d=><details className="butchery-history" key={d.id}><summary>{titles[d.command.type]} · {d.reference||''} · {d.command.businessDate} · {d.command.reason} · {num(d.amount)} ج.م</summary><p dir="ltr">{d.reference||d.id}</p>{d.command.type==='butchery.process'&&<><p>{name(d.command.itemId)} · {num(d.command.quantity)} كجم · {d.command.headCount?`${num(d.command.headCount)} رأس · `:''}فاقد ذبح {num(d.command.slaughterLoss)} كجم · فاقد تقطيع {num(d.command.cuttingLoss)} كجم · تجهيز {num(d.command.processingCost)} ج.م</p><div className="table-scroll"><table><thead><tr><th>المنتج</th><th>كجم</th><th>نسبة التكلفة</th><th>القيمة</th><th>تكلفة الكجم</th></tr></thead><tbody>{(d.details.outputs as (Output&{amount:string;unitCost:string})[]||[]).map(o=><tr key={o.itemId}><td>{name(o.itemId)}</td><td>{num(o.quantity)}</td><td>{num(o.costShare)}%</td><td>{num(o.amount)}</td><td>{num(o.unitCost)}</td></tr>)}</tbody></table></div></>}{d.command.type==='product.create'&&<p>{d.command.name} · {kinds[d.command.meatKind]}</p>}{d.command.type==='transfer.dispatch'&&<p>{name(d.command.itemId)} · {num(d.command.quantity)} كجم · {location(d.command.sourceId)} ← {location(d.command.destinationId)}</p>}{d.command.type==='transfer.receive'&&<p>استلام {num(d.command.quantity)} كجم · التحويل {d.command.transferId}</p>}</details>)}{!snapshot.workshopDocuments?.length&&<p className="empty">تظهر هنا العمليات بعد قبول المزامنة.</p>}</section></>}
  <section className="panel"><div className="panel-heading"><h2>عمليات الجزارة على هذا الجهاز</h2><span className="pill">{rows.length}</span></div>{[...rows].reverse().map(row=><div className="queue-row" key={row.id}><div className="queue-info"><strong>{titles[row.command.type]} · {snapshot.workshopDocuments?.find(d=>d.id===row.id)?.reference||'بانتظار توليد المرجع'}{row.command.reason?` · ${row.command.reason}`:''}</strong><small>{row.command.businessDate} · {row.id.slice(0,8)}</small>{row.error&&<span className="error">{row.error}</span>}{row.status==='needsReview'&&<div className="review-actions"><button className="secondary" disabled={expired} onClick={()=>void resolve(row.id,'retry')}>إعادة المحاولة</button><button className="text-button" onClick={()=>void resolve(row.id,'cancel')}>إلغاء المرفوضة</button></div>}</div><span className={`pill ${row.status==='accepted'?'good':row.status==='needsReview'?'warning':''}`}>{row.status==='accepted'?'مقبولة':row.status==='needsReview'?'تحتاج مراجعة':row.status==='cancelled'?'ملغاة':row.status==='acceptedAwaiting'?'انتظار تنزيل النتيجة':'محفوظة محلياً'}</span></div>)}{!rows.length&&<p className="empty">عملياتك محفوظة محلياً قبل المزامنة. نسخة الاسترداد في مركز المزامنة تشمل الجزارة.</p>}</section>
 </div>;
}
