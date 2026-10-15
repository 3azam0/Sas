'use client';
import type {MouseEvent} from 'react';
import {documentFeedback,type DocumentStage} from './document-feedback';

const n=(v:number)=>new Intl.NumberFormat('ar-EG').format(v);
export function SavedDocumentNotice({status,confirmed,title,dismiss,openSync}:{status?:DocumentStage;confirmed:boolean;title:string;dismiss:()=>void;openSync:()=>void}){
 const feedback=documentFeedback(status,confirmed);
 return <div className={`saved-document-notice saved-${feedback.tone}`} role="status" aria-live="polite"><span className="saved-state-symbol" aria-hidden="true">{feedback.tone==='success'?'✓':feedback.tone==='warning'?'!':'◷'}</span><div><small>{title}</small><strong>{feedback.title}</strong><p>{feedback.detail}</p></div><button type="button" className="text-button" onClick={openSync}>متابعة المستند</button><button type="button" className="icon-button" aria-label="إغلاق حالة المستند" onClick={dismiss}>×</button></div>;
}
type Props={locationName:string;receivingReason:string;kitchenReason:string;lowCount:number;pending:number;review:number;online:boolean;expired:boolean;receive:(event:MouseEvent<HTMLButtonElement>)=>void;supply:(event:MouseEvent<HTMLButtonElement>)=>void;inventory:()=>void;lowStock:()=>void;sync:()=>void;reports:()=>void;setup:()=>void;guide:()=>void};
export default function DailyWorkspace(props:Props){
 const {locationName,receivingReason,kitchenReason,lowCount,pending,review,online,expired}=props;
 return <section className="daily-workspace" aria-label="العمل اليومي"><div className="daily-heading"><div><span className="eyebrow">ابدأ من هنا</span><h2>ماذا تريد أن تفعل؟</h2><p>موقع العمل: <strong>{locationName}</strong></p></div><button type="button" className="text-button" onClick={props.guide}>دليل الاستخدام ←</button></div>
  <div className="daily-actions">
   <div className="daily-action"><button type="button" disabled={!!receivingReason} onClick={props.receive}><span className="daily-action-icon" aria-hidden="true">↓</span><strong>استلام مواد</strong><span>أضف المواد الواردة وكمياتها وتكلفتها.</span><span className="daily-action-link">ابدأ الاستلام ←</span></button>{receivingReason&&<p className="daily-disabled">{receivingReason}</p>}</div>
   <div className="daily-action"><button type="button" disabled={!!kitchenReason} onClick={props.supply}><span className="daily-action-icon" aria-hidden="true">⇄</span><strong>صرف للمطبخ</strong><span>انقل المواد إلى مخزون المطبخ المستلم.</span><span className="daily-action-link">اختر المطبخ والمواد ←</span></button>{kitchenReason&&<p className="daily-disabled">{kitchenReason}</p>}</div>
   <div className="daily-action"><button type="button" onClick={props.inventory}><span className="daily-action-icon" aria-hidden="true">▦</span><strong>عرض المخزون</strong><span>ابحث عن مادة وراجع الرصيد والتكلفة.</span><span className="daily-action-link">افتح مواد الموقع ←</span></button></div>
  </div>
  <section className="daily-attention" aria-labelledby="daily-attention-title"><h3 id="daily-attention-title">ما يحتاج انتباهك</h3><div className="daily-attention-list">
   {expired&&<p className="daily-warning">جدد الجلسة للمتابعة. عملياتك المعلقة محفوظة على هذا الجهاز.</p>}
   {!online&&<p className="daily-warning">أنت دون اتصال. احفظ العمل على الجهاز وتابع تأكيده بعد عودة الاتصال.</p>}
   {review>0&&<button type="button" className="daily-attention-row" onClick={props.sync}><span><strong>{n(review)} عملية تحتاج مراجعة</strong><small>اعرف السبب والخطوة المطلوبة؛ السجلات تخص كل المواقع على هذا الجهاز.</small></span><span aria-hidden="true">←</span></button>}
   {pending>0&&<button type="button" className="daily-attention-row" onClick={props.sync}><span><strong>{n(pending)} عملية بانتظار التأكيد</strong><small>محفوظة على هذا الجهاز لكل المواقع. الرصيد المؤكد يتحدث بعد القبول.</small></span><span aria-hidden="true">←</span></button>}
   {lowCount>0&&<button type="button" className="daily-attention-row" onClick={props.lowStock}><span><strong>{n(lowCount)} مادة تحت الحد الأدنى</strong><small>في الموقع الحالي؛ راجع المواد قبل الطلب أو الصرف.</small></span><span aria-hidden="true">←</span></button>}
   {!review&&!pending&&!lowCount&&!expired&&online&&<p className="daily-clear">✓ لا توجد عمليات معلقة أو مواد تحت الحد الأدنى في البيانات الحالية.</p>}
  </div></section>
  <div className="daily-secondary"><button type="button" className="secondary" onClick={props.reports}>التقارير والرسوم ←</button><button type="button" className="text-button" onClick={props.setup}>إعداد المواد والمواقع</button></div>
 </section>;
}
