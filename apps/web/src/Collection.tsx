'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {matchesSearch} from './FormControls';
import {operationLabels} from './OperationStatus';
import {decimal} from '@saas/domain';

export type ListSort<T>={value:string;label:string;compare:(a:T,b:T)=>number};
const collator=new Intl.Collator('ar-EG',{numeric:true,sensitivity:'base'});
/** Keep unavailable values last in both directions, and compare decimal strings exactly. */
export function amountSorts<T>(key:string,label:string,value:(row:T)=>string|null|undefined):ListSort<T>[]{
 return [1,-1].map(direction=>({value:key+(direction===1?'Asc':'Desc'),label:label+(direction===1?' — الأقل أولًا':' — الأعلى أولًا'),compare:(a,b)=>{const left=value(a),right=value(b);if(left==null)return right==null?0:1;if(right==null)return -1;return decimal(left).cmp(decimal(right))*direction;}}));
}
export type ListFilter<T>={key:string;label:string;value:(row:T)=>string;options:{value:string;label:string}[]};
export const syncStatusOptions=Object.entries(operationLabels).map(([value,label])=>({value,label}));
export const DocumentReferenceContext=createContext<string|undefined>(undefined);
const number=(value:number)=>new Intl.NumberFormat('ar-EG').format(value);

/** Filters, sorts and pages the downloaded snapshot only; totals and mutations stay with the caller. */
export default function Collection<T>({rows,title,children,searchText,sortText,sorts=[],dateValue,filters=[],resetKey='',pageResetKey='',rowIds,pageSize:initialSize=25,emptyText='لا توجد سجلات مطابقة.',keepMounted=false,matches}:{rows:T[];title:string;children:(visible:T[],isShown:(row:T)=>boolean,isIncluded:(row:T)=>boolean)=>ReactNode;searchText?:(row:T)=>string;sortText?:(row:T)=>string;sorts?:ListSort<T>[];dateValue?:(row:T)=>string;filters?:ListFilter<T>[];resetKey?:string;pageResetKey?:string;rowIds?:(row:T)=>string[];pageSize?:number;emptyText?:string;keepMounted?:boolean;matches?:(row:T)=>boolean}){
 const [query,setQuery]=useState(''),[values,setValues]=useState<Record<string,string>>({}),[from,setFrom]=useState(''),[to,setTo]=useState(''),[size,setSize]=useState(initialSize),[page,setPage]=useState(1),[reveal,setReveal]=useState(''),[sort,setSort]=useState('original');
 const reference=useContext(DocumentReferenceContext);
 const top=useRef<HTMLDivElement>(null),latest=useRef({rows,rowIds,size,selected:rows,key:''});
 const key=JSON.stringify([resetKey,pageResetKey,query,values,from,to,size,sort]);
 const [pageKey,setPageKey]=useState(key);
 const alphabet=sortText??searchText;
 const options:ListSort<T>[]=keepMounted?[]:[...(alphabet?[{value:'textAsc',label:'أبجديًا — أ إلى ي',compare:(a:T,b:T)=>collator.compare(alphabet(a),alphabet(b))},{value:'textDesc',label:'أبجديًا — ي إلى أ',compare:(a:T,b:T)=>collator.compare(alphabet(b),alphabet(a))}]:[]),...(dateValue?[{value:'dateDesc',label:'التاريخ — الأحدث أولًا',compare:(a:T,b:T)=>dateValue(b).localeCompare(dateValue(a))},{value:'dateAsc',label:'التاريخ — الأقدم أولًا',compare:(a:T,b:T)=>dateValue(a).localeCompare(dateValue(b))}]:[]),...sorts];
 const compare=options.find(option=>option.value===sort)?.compare;
 const selected=rows.filter(row=>(!matches||matches(row))&&(!searchText||matchesSearch(searchText(row),query))&&filters.every(filter=>!values[filter.key]||filter.value(row)===values[filter.key])&&(!dateValue||(!from||dateValue(row).slice(0,10)>=from)&&(!to||dateValue(row).slice(0,10)<=to)));
 if(compare)selected.sort(compare);latest.current={rows,rowIds,size,selected,key};
 const pages=Math.max(1,Math.ceil(selected.length/size)),current=Math.min(pageKey===key?page:1,pages),visible=selected.slice((current-1)*size,current*size);
 const previousLength=useRef(rows.length);
 useEffect(()=>{if(keepMounted&&rows.length>previousLength.current){const index=selected.indexOf(rows[rows.length-1]);if(index>=0){setPage(Math.floor(index/size)+1);setPageKey(key);}}previousLength.current=rows.length;},[keepMounted,rows.length]);
 function clear(){setQuery('');setValues({});setFrom('');setTo('');setReveal('');setSort('original');setPage(1);}
 useEffect(()=>{clear();},[resetKey]);
 useEffect(()=>{if(!reference)return;const {rows,rowIds,size}=latest.current,index=rowIds?rows.findIndex(row=>rowIds(row).includes(reference)):-1;if(index<0)return;setQuery('');setValues({});setFrom('');setTo('');setSort('original');setReveal(reference);setPage(Math.floor(index/size)+1);setPageKey(JSON.stringify([resetKey,pageResetKey,'',{},'','',size,'original']));},[reference,resetKey,pageResetKey]);
 useEffect(()=>{const open=(event:Event)=>{const id=(event as CustomEvent<{id:string}>).detail?.id;if(!id)return;const {rows,rowIds,size}=latest.current,index=rowIds?rows.findIndex(row=>rowIds(row).includes(id)):-1;if(index<0)return;setQuery('');setValues({});setFrom('');setTo('');setSort('original');setReveal(id);setPage(Math.floor(index/size)+1);setPageKey(JSON.stringify([resetKey,pageResetKey,'',{},'','',size,'original']));};window.addEventListener('fodo:document-reference',open);return()=>window.removeEventListener('fodo:document-reference',open);},[resetKey,pageResetKey]);
 useEffect(()=>{if(!reveal)return;const frame=requestAnimationFrame(()=>{const node=document.getElementById(`operation-${reveal}`);if(!node)return;for(let parent:HTMLElement|null=node;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;node.focus({preventScroll:true});node.scrollIntoView({block:'center'});});return()=>cancelAnimationFrame(frame);},[reveal,current]);
 useEffect(()=>{if(!keepMounted)return;const open=(event:Event)=>{const node=event.target;if(!(node instanceof HTMLElement)||!top.current?.parentElement?.contains(node))return;const id=node.closest<HTMLElement>('[data-collection-row]')?.dataset.collectionRow,{rows,rowIds,size,selected,key}=latest.current,included=id&&rowIds?selected.findIndex(row=>rowIds(row).includes(id)):-1;if(included>=0){setPage(Math.floor(included/size)+1);setPageKey(key);return;}const index=id&&rowIds?rows.findIndex(row=>rowIds(row).includes(id)):-1;if(index<0)return;setQuery('');setValues({});setFrom('');setTo('');setSort('original');setPage(Math.floor(index/size)+1);setPageKey(JSON.stringify([resetKey,pageResetKey,'',{},'','',size,'original']));};window.addEventListener('fodo:reveal-control',open);return()=>window.removeEventListener('fodo:reveal-control',open);},[keepMounted,resetKey,pageResetKey]);
 function go(next:number){setPage(next);setPageKey(key);setReveal('');requestAnimationFrame(()=>{top.current?.focus({preventScroll:true});top.current?.scrollIntoView({block:'start'});});}
 const active=!!query||!!from||!!to||Object.values(values).some(Boolean),invalid=!!from&&!!to&&from>to;
 const buttons=[...new Set([1,current-1,current,current+1,pages])].filter(n=>n>0&&n<=pages).sort((a,b)=>a-b);
 return <div className="collection" aria-label={title}>
  <div className="collection-top" ref={top} tabIndex={-1}>
   {(searchText||dateValue||filters.length>0||options.length>0)&&<div className="collection-filters">
    {searchText&&<label className="collection-search">بحث<input type="search" aria-label={`بحث ${title}`} placeholder="الاسم أو الكود أو المرجع…" value={query} onChange={e=>setQuery(e.target.value)}/></label>}
    {filters.map(filter=><label key={filter.key}>{filter.label}<select aria-label={`${filter.label} — ${title}`} value={values[filter.key]??''} onChange={e=>setValues(previous=>({...previous,[filter.key]:e.target.value}))}><option value="">الكل</option>{filter.options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}
    {options.length>0&&<label>ترتيب حسب<select aria-label={`ترتيب حسب — ${title}`} value={sort} onChange={e=>setSort(e.target.value)}><option value="original">الترتيب الافتراضي</option>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
    {dateValue&&<><label>من تاريخ<input type="date" aria-label={`من تاريخ — ${title}`} value={from} onInput={e=>setFrom(e.currentTarget.value)} onChange={e=>setFrom(e.target.value)}/></label><label>إلى تاريخ<input type="date" aria-label={`إلى تاريخ — ${title}`} min={from||undefined} aria-invalid={invalid||undefined} value={to} onInput={e=>setTo(e.currentTarget.value)} onChange={e=>setTo(e.target.value)}/></label></>}
    {active&&<button type="button" className="secondary collection-reset" onClick={clear}>مسح الفلاتر</button>}
   </div>}
   {invalid&&<p className="field-error" role="alert">تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساويًا له.</p>}
   <div className="collection-summary"><span role="status" aria-live="polite">{selected.length?`${number((current-1)*size+1)}–${number(Math.min(current*size,selected.length))} من ${number(selected.length)}`:'٠ نتائج'}{selected.length!==rows.length&&<> · إجمالي {number(rows.length)}</>}</span><label>لكل صفحة<select aria-label={`عدد السجلات في الصفحة — ${title}`} value={size} onChange={e=>setSize(Number(e.target.value))}>{[10,25,50,100].map(n=><option key={n} value={n}>{number(n)}</option>)}</select></label></div>
  </div>
  {children(keepMounted?rows:visible,row=>visible.includes(row),row=>selected.includes(row))}
  {!selected.length&&<div className="collection-empty"><strong>{emptyText}</strong>{active&&<button type="button" className="text-button" onClick={clear}>عرض كل السجلات</button>}</div>}
  {pages>1&&<nav className="pagination" aria-label={`صفحات ${title}`}><button type="button" className="secondary" disabled={current===1} aria-label={`الصفحة السابقة — ${title}`} onClick={()=>go(current-1)}>السابق</button><div className="page-numbers">{buttons.map((n,index)=><span key={n}>{index>0&&n>buttons[index-1]+1&&<span className="page-gap" aria-hidden="true">…</span>}<button type="button" aria-current={current===n?'page':undefined} aria-label={`صفحة ${number(n)} — ${title}`} onClick={()=>go(n)}>{number(n)}</button></span>)}</div><button type="button" className="secondary" disabled={current===pages} aria-label={`الصفحة التالية — ${title}`} onClick={()=>go(current+1)}>التالي</button></nav>}
 </div>;
}
