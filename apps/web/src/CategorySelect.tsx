'use client';
import {useEffect,useId,useRef,useState,type SelectHTMLAttributes} from 'react';
import {createPortal} from 'react-dom';
import {FormInput,SearchableSelect,WorkflowForm} from './FormControls';
import {DocumentSummary} from './DocumentForm';

export const cleanCategory=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ');
export function categoryChoices(categories:string[],current=''){
 const choices=new Map<string,string>();
 for(const name of [...categories,current]){const clean=cleanCategory(name),key=clean.toLocaleLowerCase();if(clean&&(!choices.has(key)||name===current))choices.set(key,name.trim());}
 return [...choices.values()].sort((a,b)=>a.localeCompare(b,'ar',{numeric:true}));
}
export default function CategorySelect({categories,value,onSelect,...props}:Omit<SelectHTMLAttributes<HTMLSelectElement>,'value'|'onChange'|'onSelect'|'children'>&{categories:string[];value:string;onSelect:(name:string)=>void}){
 const anchor=useRef<HTMLSpanElement>(null),[creating,setCreating]=useState<string|null>(null);
 const choices=categoryChoices(categories,value);
 function finish(name?:string){if(name!==undefined)onSelect(name);setCreating(null);requestAnimationFrame(()=>anchor.current?.querySelector<HTMLInputElement>('[role=combobox]')?.focus({preventScroll:true}));}
 return <span className="category-picker" ref={anchor}>
  <SearchableSelect {...props} value={value} createLabel="إضافة فئة جديدة" onCreate={name=>setCreating(name)} onChange={event=>onSelect(event.target.value)}>{choices.map(name=><option key={name} value={name}>{name}</option>)}</SearchableSelect>
  {creating!==null&&typeof document!=='undefined'&&createPortal(<CategoryDialog initial={creating} categories={choices} close={()=>finish()} choose={finish}/>,document.body)}
 </span>;
}
function CategoryDialog({initial,categories,close,choose}:{initial:string;categories:string[];close:()=>void;choose:(name:string)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),title=useId(),[name,setName]=useState(initial);
 useEffect(()=>{dialog.current?.showModal();},[]);
 const cleaned=cleanCategory(name),existing=categories.find(category=>cleanCategory(category).toLocaleLowerCase()===cleaned.toLocaleLowerCase());
 return <dialog ref={dialog} className="modal category-modal structured-modal" aria-labelledby={title} onCancel={event=>{event.preventDefault();event.stopPropagation();close();}}>
  <div className="modal-header"><div><h2 id={title}>إضافة فئة جديدة</h2><p>أضف تصنيفاً للمادة أو اختر فئة موجودة بالاسم نفسه.</p></div><button className="icon-button" type="button" aria-label="إغلاق إضافة الفئة" onClick={close}>×</button></div>
  <WorkflowForm summary={<DocumentSummary label="الفئة" value={cleaned||'فئة جديدة'} detail="تُحفظ الفئة مع المادة عند حفظها"/>} onSubmit={event=>{event.stopPropagation();choose(existing??cleaned);}}>
   <label><span className="form-label">اسم الفئة <span className="field-required" aria-hidden="true">*</span></span><FormInput aria-label="اسم الفئة الجديدة" autoFocus required minLength={2} maxLength={100} placeholder="مثال: أسماك ومأكولات بحرية" value={name} onChange={event=>setName(event.target.value)}/></label>
   {existing&&<p className="notice" role="status">هذه الفئة موجودة؛ سيتم اختيارها دون تكرار.</p>}
   <div className="modal-actions"><button type="submit" className="primary">{existing?'اختيار الفئة الموجودة':'إضافة واختيار'}</button><button type="button" className="secondary" onClick={close}>إلغاء</button></div>
  </WorkflowForm>
 </dialog>;
}
