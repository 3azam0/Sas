'use client';
import {useEffect,useId,useRef,type ReactNode} from 'react';
import CollapsibleSection from './CollapsibleSection';
import {HelpButton} from './ClientGuide';
import type {GuideId} from './guide-content';

export function DocumentEditor({children,title,close,busy=false,className='',closeLabel='إغلاق النموذج',helpTopic}:{children:ReactNode;title:ReactNode;close:()=>void;busy?:boolean;className?:string;closeLabel?:string;helpTopic?:GuideId}){
 const dialog=useRef<HTMLDialogElement>(null),id=useId();
 useEffect(()=>{dialog.current?.showModal();},[]);
 return <dialog ref={dialog} className={`modal document-editor ${className}`} aria-labelledby={id} onCancel={event=>{event.preventDefault();if(!busy)close();}}><div className="modal-header"><div><span className="eyebrow">مستندات المخزون والتكاليف</span><h2 id={id}>{title}</h2></div>{helpTopic&&<HelpButton topic={helpTopic}/>}<button type="button" className="icon-button" aria-label={closeLabel} disabled={busy} onClick={close}>×</button></div>{children}</dialog>;
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
