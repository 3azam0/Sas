'use client';
import {useId,useRef,useState,type ReactNode,type SelectHTMLAttributes} from 'react';
import {SearchableSelect} from './FormControls';
import {presetRange,type DatePreset} from './filter-helpers';
export type ActiveFilter={key:string;label:string;clear:()=>void};
export function FilterSelect(props:SelectHTMLAttributes<HTMLSelectElement>){return <SearchableSelect {...props} includeEmptyOption/>;}
export function DatePresets({from,to,change}:{from:string;to:string;change:(range:{from:string;to:string})=>void}){
 const presets:{key:DatePreset;label:string}[]=[{key:'today',label:'اليوم'},{key:'week',label:'آخر ٧ أيام'},{key:'month',label:'هذا الشهر'},{key:'thirty',label:'آخر ٣٠ يومًا'}];
 return <div className="filter-date-presets" role="group" aria-label="فترات سريعة">{presets.map(p=>{const range=presetRange(p.key);return <button type="button" key={p.key} aria-pressed={from===range.from&&to===range.to} onClick={()=>change(range)}>{p.label}</button>;})}</div>;
}
export default function FilterToolbar({title,search,primary,advanced,chips=[],reset,scope}:{title:string;search?:ReactNode;primary?:ReactNode;advanced?:ReactNode;chips?:ActiveFilter[];reset:()=>void;scope?:ReactNode}){
 const [open,setOpen]=useState(false),id=useId(),root=useRef<HTMLDivElement>(null),hasFields=!!primary||!!advanced;
 function clear(action:()=>void){action();requestAnimationFrame(()=>{const controls=root.current?.querySelectorAll<HTMLElement>('input,select,button');const target=controls&&Array.from(controls).find(node=>node.getClientRects().length&&!node.matches(':disabled,[hidden],[aria-hidden=true]'));target?.focus({preventScroll:true});});}
 return <div className="filter-toolbar" ref={root} data-expanded={open} aria-label={'فلاتر '+title}>
  <div className="filter-toolbar-main">{search&&<div className="filter-toolbar-search" data-filter-search>{search}</div>}{primary&&<div className="filter-toolbar-primary" id={id+'-primary'}>{primary}</div>}{hasFields&&<button type="button" className={'secondary filter-toolbar-toggle '+(!advanced?'filter-mobile-only':'')} aria-expanded={open} aria-controls={[primary?id+'-primary':'',advanced?id+'-advanced':''].filter(Boolean).join(' ')} onClick={()=>setOpen(value=>!value)}><span className="filter-toggle-wide">{open?'إخفاء الفلاتر':'فلاتر إضافية'}</span><span className="filter-toggle-phone">الفلاتر</span>{chips.length>0&&<span className="filter-active-count">{new Intl.NumberFormat('ar-EG').format(chips.length)}</span>}<span aria-hidden="true">{open?'⌃':'⌄'}</span></button>}</div>
  {advanced&&<div className="filter-toolbar-advanced" id={id+'-advanced'}>{advanced}</div>}
  {(chips.length>0||scope)&&<div className="filter-toolbar-context">{scope&&<span className="filter-scope">{scope}</span>}{chips.length>0&&<div className="filter-active" aria-label="الفلاتر المطبقة">{chips.map(chip=><button type="button" key={chip.key} className="filter-chip" aria-label={'إزالة تصفية: '+chip.label} onClick={()=>clear(chip.clear)}><span>{chip.label}</span><span aria-hidden="true">×</span></button>)}<button type="button" className="filter-clear" onClick={()=>clear(reset)}>مسح الكل</button></div>}</div>}
 </div>;
}
