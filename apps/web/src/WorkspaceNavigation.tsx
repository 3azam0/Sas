'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {navigationGroups} from './navigation';
import type {View} from './store';

type Props={view:View;choose:(view:View)=>void;labels:Record<View,string>;icon:(view:View)=>ReactNode;pending:number;review:number;mobileOpen:boolean;openMobile:(trigger:HTMLButtonElement)=>void;closeMobile:()=>void;mobileTrigger:HTMLElement|null};
const quickViews:View[]=['overview','pos','kitchenDisplay','inventory'];
function Group({group,view,children}:{group:(typeof navigationGroups)[number];view:View;children:ReactNode}){
 const active=group.views.includes(view),[open,setOpen]=useState(active);
 useEffect(()=>{if(active)setOpen(true);},[active,view]);
 if(!group.collapsible)return <div className="nav-group"><h2 className="nav-group-title">{group.title}</h2>{children}</div>;
 return <details className="nav-group nav-disclosure" open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary>{group.title}<span aria-hidden="true">⌄</span></summary>{children}</details>;
}
export default function WorkspaceNavigation(props:Props){
 const {view,choose,labels,icon,pending,review,mobileOpen,openMobile,closeMobile,mobileTrigger}=props;
 function item(v:View,close=false){return <button type="button" key={v} aria-current={view===v?'page':undefined} className={view===v?'nav-button active':'nav-button'} onClick={()=>{choose(v);if(close)closeMobile();}}>{icon(v)}{labels[v]}{v==='sync'&&pending+review>0&&<span className="count">{new Intl.NumberFormat('ar-EG').format(pending+review)}</span>}</button>;}
 return <><nav className="workspace-navigation desktop-navigation" aria-label="التنقل الرئيسي">{navigationGroups.map(group=><Group key={group.title} group={group} view={view}>{group.views.map(v=>item(v))}</Group>)}</nav>
  <nav className="workspace-navigation mobile-navigation" aria-label="التنقل السريع">{quickViews.map(v=>item(v))}<button type="button" className={'nav-button '+(!quickViews.includes(view)?'active':'')} aria-haspopup="dialog" aria-expanded={mobileOpen} aria-controls="workspace-mobile-menu" onClick={event=>openMobile(event.currentTarget)}><span className="more-icon" aria-hidden="true">☰</span>القائمة{review>0&&<span className="count">{new Intl.NumberFormat('ar-EG').format(review)}</span>}</button></nav>
  {mobileOpen&&<MoreNavigation close={closeMobile} trigger={mobileTrigger}>{navigationGroups.map(group=><section className="more-nav-group" key={group.title}><h3>{group.title}</h3>{group.views.map(v=>item(v,true))}</section>)}</MoreNavigation>}
 </>;
}
function MoreNavigation({children,close,trigger}:{children:ReactNode;close:()=>void;trigger:HTMLElement|null}){
 const dialog=useRef<HTMLDialogElement>(null),button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const node=dialog.current;node?.showModal();button.current?.focus();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{node?.close();document.body.style.overflow=overflow;if(trigger?.isConnected&&trigger.getClientRects().length)trigger.focus({preventScroll:true});};},[trigger]);
 return createPortal(<dialog ref={dialog} id="workspace-mobile-menu" className="modal more-navigation-dialog" aria-labelledby="more-navigation-title" onClick={event=>{if(event.target!==event.currentTarget)return;const box=event.currentTarget.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();}} onCancel={event=>{event.preventDefault();close();}}><div className="modal-header"><div><h2 id="more-navigation-title">كل أقسام FooDo</h2><p>اختر القسم الذي تحتاجه.</p></div><button ref={button} type="button" className="icon-button" aria-label="إغلاق القائمة" onClick={close}>×</button></div><nav className="more-navigation-body" aria-label="كل أقسام التطبيق">{children}</nav></dialog>,document.body);
}
