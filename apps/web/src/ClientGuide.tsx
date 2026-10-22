'use client';
import {createContext,useContext,useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {findGuide,guideRevision,guideTopics,searchGuide,type GuideId,type GuideTopic} from './guide-content';
import KeyboardShortcuts from './KeyboardShortcuts';

const HelpContext=createContext<{open:(topic:GuideId,trigger:HTMLElement)=>void}|null>(null);
export function HelpButton({topic}:{topic:GuideId}){const help=useContext(HelpContext);if(!help)return null;return <button type="button" className="secondary help-trigger" aria-label={`مساعدة: ${findGuide(topic).title}`} aria-haspopup="dialog" onClick={event=>help.open(topic,event.currentTarget)}><span aria-hidden="true">?</span><span>مساعدة</span></button>;}
export function HelpProvider({children}:{children:ReactNode}){
 const [request,setRequest]=useState<{topic:GuideId;trigger:HTMLElement}|null>(null);
 return <HelpContext.Provider value={{open:(topic,trigger)=>setRequest({topic,trigger})}}>{children}{request&&<HelpPanel topic={request.topic} trigger={request.trigger} close={()=>setRequest(null)}/>}</HelpContext.Provider>;
}
function HelpPanel({topic,trigger,close}:{topic:GuideId;trigger:HTMLElement;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null),id=useId();
 useEffect(()=>{const node=dialog.current;node?.showModal();closeButton.current?.focus({preventScroll:true});return()=>{node?.close();if(trigger.isConnected&&!trigger.closest('[hidden],[inert]'))trigger.focus({preventScroll:true});};},[trigger]);
 return createPortal(<dialog ref={dialog} className="client-help-panel" dir="rtl" aria-labelledby={id} onCancel={event=>{event.preventDefault();event.stopPropagation();close();}} onKeyDown={event=>{event.stopPropagation();if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)||event.key==='Insert'&&event.altKey)event.preventDefault();}}>
  <header className="guide-panel-header"><div><span className="eyebrow">دليل استخدام FooDo</span><h2 id={id}>مساعدة أثناء العمل</h2><p>بيانات النموذج محفوظة أثناء قراءة المساعدة.</p></div><button ref={closeButton} type="button" className="icon-button" aria-label="إغلاق المساعدة" onClick={close}>×</button></header>
  <div className="guide-panel-body"><GuideExplorer initialTopic={topic} compact/></div>
 </dialog>,document.body);
}
export function GuideArticle({topic,choose}:{topic:GuideTopic;choose:(id:GuideId)=>void}){
 return <article className="guide-article" aria-label={topic.title}>
  <span className="eyebrow">{topic.group}</span><h2>{topic.title}</h2><p className="guide-summary">{topic.summary}</p>
  {topic.before&&<div className="guide-prerequisite"><strong>قبل البدء</strong><p>{topic.before}</p></div>}
  <h3>خطوات العمل</h3><ol className="guide-steps">{topic.steps.map((step,index)=><li key={index}>{step}</li>)}</ol>
  <div className="guide-example"><strong>مثال للتوضيح</strong><p>{topic.example}</p></div>
  <h3>ماذا يحدث بعد الحفظ؟</h3><p>{topic.after}</p>
  <details className="guide-details" open><summary>انتبه أثناء العمل</summary><ul>{topic.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></details>
  {topic.id==='keyboard'?<KeyboardShortcuts/>:<details className="guide-details"><summary>التنقل بلوحة المفاتيح</summary><KeyboardShortcuts/><p>تفاصيل الإضافة والبحث تختلف حسب النموذج؛ راجع <button type="button" className="text-button" onClick={()=>choose('keyboard')}>دليل الاختصارات</button>.</p></details>}
  <nav className="guide-related" aria-label="موضوعات مرتبطة"><h3>قد تحتاج أيضًا</h3>{topic.related.map(id=><button type="button" className="secondary" key={id} onClick={()=>choose(id)}>{findGuide(id).title}<span aria-hidden="true">←</span></button>)}</nav>
  <small className="guide-revision">تحديث التعليمات: <bdi>{guideRevision}</bdi></small>
 </article>;
}
export function GuideExplorer({initialTopic='start',compact=false}:{initialTopic?:GuideId;compact?:boolean}){
 const [query,setQuery]=useState(''),[selected,setSelected]=useState<GuideId>(initialTopic),[showTopics,setShowTopics]=useState(false),heading=useRef<HTMLHeadingElement>(null),searchId=useId();
 const results=searchGuide(query),groups=[...new Set(results.map(topic=>topic.group))];
 function choose(id:GuideId){setSelected(id);setQuery('');setShowTopics(false);requestAnimationFrame(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'nearest'});});}
 return <section className={`guide-explorer ${compact?'guide-compact':''}`} aria-label="تصفح دليل الاستخدام">
  <div className="guide-search"><label htmlFor={searchId}>ابحث في دليل الاستخدام</label><div><input id={searchId} type="search" value={query} onChange={event=>{setQuery(event.target.value);setShowTopics(true);}} placeholder="مثال: استلام، خصم المكونات، غير مكتمل…"/>{query&&<button type="button" className="text-button" onClick={()=>setQuery('')}>مسح البحث</button>}</div></div>
  <button type="button" className="secondary guide-topics-toggle" aria-expanded={showTopics||!!query} onClick={()=>{if(query)setQuery('');setShowTopics(value=>!value);}}>{showTopics||query?'إخفاء الموضوعات':'تصفح الموضوعات'} <span>{new Intl.NumberFormat('ar-EG').format(guideTopics.length)}</span></button>
  <div className="guide-layout"><nav className={`guide-index ${showTopics||query?'guide-index-visible':''}`} aria-label="موضوعات دليل الاستخدام">
   <p role="status">{query?`${new Intl.NumberFormat('ar-EG').format(results.length)} موضوعًا يطابق البحث`:'اختر المهمة التي تريد تنفيذها'}</p>
   {!results.length&&<div className="guide-no-results"><strong>لا توجد نتائج مطابقة</strong><p>جرّب كلمة مثل «استلام» أو «جرد»، أو امسح البحث لعرض الموضوعات.</p><button type="button" className="secondary" onClick={()=>setQuery('')}>عرض كل الموضوعات</button></div>}
   {groups.map(group=><div className="guide-group" key={group}><h3>{group}</h3>{results.filter(topic=>topic.group===group).map(topic=><button type="button" key={topic.id} aria-current={selected===topic.id?'page':undefined} onClick={()=>choose(topic.id)}><span>{topic.title}</span><small>{topic.summary}</small></button>)}</div>)}
  </nav><div className="guide-reading"><h2 className="guide-reading-label" ref={heading} tabIndex={-1}>تعليمات: {findGuide(selected).title}</h2><GuideArticle topic={findGuide(selected)} choose={choose}/></div></div>
 </section>;
}
export default function ClientGuide(){return <div className="client-guide-page"><div className="guide-welcome"><span className="eyebrow">معك في كل خطوة</span><h2>استخدم FooDo بثقة</h2><p>خطوات قصيرة للمهام اليومية، وأمثلة توضح أثرها على المخزون والتكلفة. اضغط «مساعدة» في أي شاشة أو نموذج للقراءة أثناء العمل.</p></div><GuideExplorer/></div>;}
