'use client';
import {useEffect,useId,useRef,type ReactNode} from 'react';
import CollapsibleSection from './CollapsibleSection';
import {HelpButton} from './ClientGuide';
import type {GuideId} from './guide-content';

export function FormSizeButton({expanded,toggle,disabled=false}:{expanded:boolean;toggle:()=>void;disabled?:boolean}){
 return <button type="button" className="icon-button form-size-button" aria-label={expanded?'استعادة حجم النموذج':'ملء الشاشة'} title={expanded?'استعادة حجم النموذج':'ملء الشاشة'} aria-pressed={expanded} disabled={disabled} onClick={toggle}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{expanded?<path d="M9 3v6H3m12-6v6h6M3 15h6v6m12-6h-6v6"/>:<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>}</svg></button>;
}

export function DocumentEditor({children,title,close,busy=false,className='',closeLabel='إغلاق النموذج',helpTopic,eyebrow='مستندات المخزون والتكاليف'}:{children:ReactNode;title:ReactNode;close:()=>void;busy?:boolean;className?:string;closeLabel?:string;helpTopic?:GuideId;eyebrow?:string}){
 const dialog=useRef<HTMLDialogElement>(null),id=useId();
 useEffect(()=>{dialog.current?.showModal();},[]);
 return <dialog ref={dialog} className={`modal document-editor ${className}`} aria-labelledby={id} onCancel={event=>{event.preventDefault();if(!busy)close();}}><div className="modal-header"><div><span className="eyebrow">{eyebrow}</span><h2 id={id}>{title}</h2></div>{helpTopic&&<HelpButton topic={helpTopic}/>}<button type="button" className="icon-button" aria-label={closeLabel} disabled={busy} onClick={close}>×</button></div>{children}</dialog>;
}

export function DocumentFields({children,columns=3,collapsible=true,title='بيانات المستند'}:{children:ReactNode;columns?:2|3|4;collapsible?:boolean;title?:string}){
 const fields=<div className={`document-fields document-fields-${columns}`}>{children}</div>;
 return collapsible?<CollapsibleSection className="document-fields-section" title={title}>{fields}</CollapsibleSection>:fields;
}
export function DocumentLines({children,count,title='مواد المستند'}:{children:ReactNode;count:number;title?:ReactNode}){
 return <CollapsibleSection as="div" className={`document-lines ${count<=10?'document-lines-short':''}`} title={<>{title} <span className="pill">{new Intl.NumberFormat('ar-EG').format(count)}</span></>}>{children}</CollapsibleSection>;
}
export function DocumentSummary({label,value,detail}:{label:string;value:ReactNode;detail?:ReactNode}){
 return <div className="document-summary"><span>{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</div>;
}
export function FormExplanation({children}:{children:ReactNode}){
 return <details className="form-explanation"><summary>تفاصيل طريقة الحساب والحفظ</summary><div>{children}</div></details>;
}
