'use client';
import {Children,cloneElement,createContext,isValidElement,useCallback,useContext,useEffect,useId,useMemo,useRef,useState,forwardRef,type FormHTMLAttributes,type InputHTMLAttributes,type SelectHTMLAttributes,type ReactNode,type ReactElement} from 'react';
import {normalizeNumber} from '../../../packages/domain/opening-import';

type Control=HTMLInputElement|HTMLSelectElement;
type Check={check:()=>string;node:()=>Control|null};
type Feedback={errors:Record<string,string>;submitted:boolean;register:(id:string,check:Check)=>()=>void;report:(id:string,message:string)=>void};
const FeedbackContext=createContext<Feedback|null>(null);
type NumericKind='positive'|'nonnegative';
function inputError(node:Control,kind?:NumericKind){
 if(node.matches(':disabled'))return '';
 const value=node.value.trim();
 if(node.required&&!value)return 'هذا الحقل مطلوب.';
 if(!value)return '';
 if(node instanceof HTMLInputElement){
  if(node.type==='checkbox'||node.type==='file')return '';
  if(node.minLength>0&&value.length<node.minLength)return `أدخل ${node.minLength} أحرف على الأقل.`;
  if(node.maxLength>0&&value.length>node.maxLength)return `الحد الأقصى ${node.maxLength} حرفًا.`;
  if(node.type==='date'){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value)))return 'اختر تاريخًا صالحًا.';
   if(node.max&&value>node.max)return 'اختر اليوم أو تاريخًا سابقًا.';
   if(node.min&&value<node.min)return 'التاريخ أقدم من الحد المتاح.';
  }
  if(kind||node.inputMode==='decimal'){
   const normalized=normalizeNumber(value);
   if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(normalized))return 'أدخل رقمًا صحيحًا حتى ٦ منازل عشرية.';
   if(kind==='positive'&&Number(normalized)<=0)return 'أدخل كمية أكبر من صفر.';
  }
  if(node.type==='email'&&node.validity.typeMismatch)return 'أدخل بريدًا إلكترونيًا صالحًا.';
 }
 return '';
}
function useFeedback(node:React.RefObject<Control|null>,kind?:NumericKind){
 const context=useContext(FeedbackContext),id=useId(),kindRef=useRef(kind);kindRef.current=kind;
 const check=useCallback(()=>node.current?inputError(node.current,kindRef.current):'',[node]);
 const register=context?.register;
 useEffect(()=>register?.(id,{check,node:()=>node.current}),[register,id,check,node]);
 const message=context?.errors[id];
 return {id,message,context,check};
}
export function FormInput({validateAs,hint,...props}:InputHTMLAttributes<HTMLInputElement>&{validateAs?:NumericKind;hint?:string}){
 const node=useRef<HTMLInputElement>(null),{id,message,context,check}=useFeedback(node,validateAs);
 const described=[props['aria-describedby'],message?id+'-error':undefined,hint?id+'-hint':undefined].filter(Boolean).join(' ')||undefined;
 return <><input {...props} ref={node} aria-invalid={message?true:props['aria-invalid']} aria-describedby={described} onInput={e=>{props.onInput?.(e);if(props.type==='date')props.onChange?.(e as unknown as React.ChangeEvent<HTMLInputElement>);}} onBlur={e=>{props.onBlur?.(e);if(!(e.relatedTarget instanceof HTMLButtonElement))context?.report(id,check());}} onChange={e=>{props.onChange?.(e);if(message||context?.submitted)context?.report(id,check());}}/>{(props.required||hint)&&props.type!=='checkbox'&&<small className="field-hint" id={id+'-hint'}>{props.required&&<span className="field-required">* مطلوب{hint?' · ':''}</span>}{hint}</small>}{message&&<small className="field-error" id={id+'-error'}>{message}</small>}</>;
}
export const FormSelect=forwardRef<HTMLSelectElement,SelectHTMLAttributes<HTMLSelectElement>>(function FormSelect(props,forwarded){
 const node=useRef<HTMLSelectElement>(null),{id,message,context,check}=useFeedback(node);
 return <><select {...props} ref={value=>{node.current=value;if(typeof forwarded==='function')forwarded(value);else if(forwarded)forwarded.current=value;}} aria-invalid={message?true:props['aria-invalid']} aria-describedby={[props['aria-describedby'],message?id+'-error':undefined].filter(Boolean).join(' ')||undefined} onBlur={e=>{props.onBlur?.(e);if(!(e.relatedTarget instanceof HTMLButtonElement))context?.report(id,check());}} onChange={e=>{props.onChange?.(e);if(message||context?.submitted)context?.report(id,check());}}/>{props.required&&<small className="field-hint"><span className="field-required">* مطلوب</span></small>}{message&&<small className="field-error" id={id+'-error'}>{message}</small>}</>;
});
function plainText(value:ReactNode):string{return Children.toArray(value).map(child=>isValidElement<{children?:ReactNode}>(child)?plainText(child.props.children):String(child??'')).join(' ');}
export function matchesSearch(value:string,query:string){const clean=(v:string)=>v.normalize('NFKC').replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/[أإآ]/g,'ا').toLocaleLowerCase();return clean(value).includes(clean(query.trim()));}
export const SearchableSelect=forwardRef<HTMLSelectElement,SelectHTMLAttributes<HTMLSelectElement>&{onSearchEnter?:(value?:string)=>void}>(function SearchableSelect({children,onSearchEnter,...props},ref){
 const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(-1),[popup,setPopup]=useState({above:false,height:260}),id=useId(),select=useRef<HTMLSelectElement|null>(null),search=useRef<HTMLInputElement|null>(null),options=Children.toArray(children);
 const visible=options.filter(option=>!isValidElement<{value?:string;children?:ReactNode}>(option)||option.type!=='option'||String(option.props.value??'')===String(props.value??'')||matchesSearch(plainText(option.props.children),query));
 const matches=options.filter((option):option is ReactElement<{value:string;disabled?:boolean;children?:ReactNode}>=>isValidElement<{value?:string;disabled?:boolean;children?:ReactNode}>(option)&&option.type==='option'&&!!option.props.value&&matchesSearch(plainText(option.props.children),query));
 const expanded=open&&!!query.trim()&&!props.disabled;
 function placePopup(){const node=search.current;if(!node)return;const field=node.getBoundingClientRect(),body=node.closest('.workflow-body,.modal-body')?.getBoundingClientRect(),below=Math.min(window.innerHeight,body?.bottom??window.innerHeight)-field.bottom-12,above=field.top-Math.max(0,body?.top??0)-12,useAbove=below<120&&above>below;setPopup({above:useAbove,height:Math.max(80,Math.min(260,useAbove?above:below))});}
 useEffect(()=>{if(expanded&&active>=0)document.getElementById(id+'-option-'+active)?.scrollIntoView({block:'nearest'});},[active,expanded,id]);
 function choose(index:number){const option=matches[index];if(!option||option.props.disabled||!select.current)return;select.current.value=String(option.props.value);select.current.dispatchEvent(new Event('change',{bubbles:true}));setOpen(false);setActive(-1);onSearchEnter?.(String(option.props.value));}
 function move(step:number){const enabled=matches.map((o,i)=>o.props.disabled?-1:i).filter(i=>i>=0);if(!enabled.length)return;const current=enabled.indexOf(active),next=current<0?(step>0?0:enabled.length-1):(current+step+enabled.length)%enabled.length;setOpen(true);setActive(enabled[next]);}
 return <span className="catalog-select"><span className="catalog-search-wrap"><span className="catalog-search"><input ref={search} type="search" role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded?id+'-options':undefined} aria-activedescendant={expanded&&active>=0?id+'-option-'+active:undefined} disabled={props.disabled} aria-label={`بحث ${props['aria-label']??'الصنف'}`} aria-describedby={query?id+'-results':undefined} value={query} placeholder="ابحث بالاسم أو الكود…" onFocus={()=>{placePopup();setOpen(true);}} onBlur={()=>setOpen(false)} onKeyDown={e=>{if(e.nativeEvent.isComposing)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();move(e.key==='ArrowDown'?1:-1);}else if(e.key==='Escape'&&expanded){e.preventDefault();e.stopPropagation();setOpen(false);}else if(e.key==='Enter'&&!(e.ctrlKey||e.metaKey)){e.preventDefault();e.stopPropagation();const index=active>=0?active:matches.findIndex(o=>!o.props.disabled);if(index>=0)choose(index);}}} onChange={e=>{setQuery(e.target.value);placePopup();setOpen(true);setActive(-1);}}/>{query&&<button type="button" disabled={props.disabled} className="clear-search" aria-label={`مسح بحث ${props['aria-label']??'الصنف'}`} onClick={()=>{setQuery('');setActive(-1);setOpen(false);search.current?.focus();}}>×</button>}</span>{expanded&&<span id={id+'-options'} className="catalog-results" style={{maxHeight:popup.height,top:popup.above?'auto':'100%',bottom:popup.above?'100%':undefined,marginTop:popup.above?0:4,marginBottom:popup.above?4:0}} role="listbox" aria-label={`نتائج بحث ${props['aria-label']??'الصنف'}`}>{matches.length?matches.map((option,index)=><button type="button" role="option" id={id+'-option-'+index} key={String(option.props.value)} tabIndex={-1} aria-selected={String(option.props.value)===String(props.value)} aria-disabled={option.props.disabled||undefined} disabled={option.props.disabled} className={index===active?'active':''} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(index)}>{plainText(option.props.children)}</button>):<span role="status" className="catalog-no-results">لا توجد نتائج مطابقة.</span>}</span>}</span><FormSelect {...props} ref={value=>{select.current=value;if(typeof ref==='function')ref(value);else if(ref)ref.current=value;}} onChange={e=>{setOpen(false);props.onChange?.(e);}}>{visible}</FormSelect>{query&&<small className="field-hint" id={id+'-results'}>{matches.length?`${matches.length} نتائج مطابقة؛ استخدم الأسهم وEnter للاختيار.`:'لا توجد نتائج مطابقة؛ الاختيار الحالي محفوظ.'}</small>}</span>;
});

function safeButtons(node:ReactNode,busy:boolean):ReactNode{
 return Children.map(node,child=>{
  if(!isValidElement<{children?:ReactNode;type?:string;disabled?:boolean}>(child))return child;
  // Render-prop collections retain their own children; the enclosing fieldset handles busy state.
  if(typeof child.props.children==='function')return child;
  const children=safeButtons(child.props.children,busy);
  return cloneElement(child,child.type==='button'?{type:child.props.type??'button',disabled:busy||child.props.disabled,children}:{children});
 });
}
export function focusControl(node:Control|null|undefined,form:HTMLFormElement|null){
 if(!node)return;
 if(node.closest('[data-collection-row]')?.hasAttribute('hidden')){
  node.dispatchEvent(new CustomEvent('fodo:reveal-control',{bubbles:true}));
  requestAnimationFrame(()=>focusControl(node,form));
  return;
 }
 node.focus({preventScroll:true});
 const body=form?.querySelector<HTMLElement>('.workflow-body,.modal-body');
 if(body?.contains(node)){
  const field=(node.closest('label,td')??node).getBoundingClientRect(),viewport=body.getBoundingClientRect();
  const top=field.top<viewport.top+12?field.top-viewport.top-12:field.bottom>viewport.bottom-12?field.bottom-viewport.bottom+12:0;
  if(top)body.scrollBy({top,behavior:'instant'});
 }
 const table=node.closest<HTMLElement>('.table-scroll');
 if(table){
  const field=node.getBoundingClientRect(),viewport=table.getBoundingClientRect();
  const left=field.left<viewport.left+12?field.left-viewport.left-12:field.right>viewport.right-12?field.right-viewport.right+12:0;
  if(left)table.scrollBy({left,behavior:'instant'});
 }
}
export function WorkflowForm({children,busy=false,error,onEdit,onInvalid,documentCheck,onSubmit,...props}:Omit<FormHTMLAttributes<HTMLFormElement>,'onSubmit'>&{busy?:boolean;error?:string;onEdit?:()=>void;onInvalid?:()=>void;documentCheck?:()=>{message:string;field?:string}|undefined;onSubmit:NonNullable<FormHTMLAttributes<HTMLFormElement>['onSubmit']>}){
 const fields=useRef(new Map<string,Check>()),form=useRef<HTMLFormElement>(null),trigger=useRef<HTMLElement|null>(null);
 const [errors,setErrors]=useState<Record<string,string>>({}),[submitted,setSubmitted]=useState(false),[documentError,setDocumentError]=useState('');
 const register=useCallback((id:string,check:Check)=>{fields.current.set(id,check);return()=>{fields.current.delete(id);setErrors(previous=>{if(!previous[id])return previous;const next={...previous};delete next[id];return next;});};},[]);
 const report=useCallback((id:string,message:string)=>setErrors(previous=>{if(previous[id]===message||!message&&!previous[id])return previous;const next={...previous};if(message)next[id]=message;else delete next[id];return next;}),[]);
 const feedback=useMemo(()=>({errors,submitted,register,report}),[errors,submitted,register,report]);
 useEffect(()=>{trigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;const first=form.current?.querySelector<HTMLInputElement|HTMLSelectElement>('input:not([type=checkbox]):not([type=file]):not(:disabled),select:not(:disabled)');first?.focus({preventScroll:true});form.current?.closest('.opening-editor')?.scrollIntoView({block:'start'});return()=>{if(trigger.current?.isConnected)trigger.current.focus({preventScroll:true});};},[]);
 let body=Children.toArray(children),fieldset:ReactElement<{children?:ReactNode;disabled?:boolean}>|undefined;
 if(body.length===1&&isValidElement<{children?:ReactNode;disabled?:boolean}>(body[0])&&body[0].type==='fieldset'){fieldset=body[0];body=Children.toArray(fieldset.props.children);}
 const last=body.at(-1);const hasFooter=isValidElement<{className?:string}>(last)&&(last.type==='button'||/heading-actions|modal-actions|workflow-actions/.test(last.props.className??''));
 const footer=hasFooter?body.pop():undefined;
 body=body.filter(child=>!isValidElement<{role?:string;children?:ReactNode}>(child)||child.type!=='p'||child.props.role!=='alert'||child.props.children!==error);
 return <FeedbackContext.Provider value={feedback}><form {...props} ref={form} noValidate aria-busy={busy} className={`workflow-form ${props.className??''}`} onChange={e=>{onEdit?.();setDocumentError('');props.onChange?.(e);}} onSubmit={e=>{
  e.preventDefault();if(busy)return;const found:Record<string,string>={};for(const [id,field] of fields.current){const message=field.check();if(message)found[id]=message;}
  const issue=Object.keys(found).length?undefined:documentCheck?.();setDocumentError('');if(issue){const candidates=[...fields.current];const field=candidates.find(([,entry])=>issue.field&&entry.node()?.getAttribute('aria-label')===issue.field)??candidates.find(([,entry])=>issue.field&&entry.node()?.getAttribute('aria-label')?.startsWith(issue.field+' '));if(field)found[field[0]]=issue.message;else setDocumentError(issue.message);}
  setSubmitted(true);setErrors(found);
  const first=Object.keys(found)[0];if(first){onInvalid?.();requestAnimationFrame(()=>focusControl(fields.current.get(first)?.node(),form.current));return;}
  if(issue){requestAnimationFrame(()=>form.current?.querySelector<HTMLElement>('.workflow-document-error')?.focus());return;}onSubmit(e);
 }}><div className="workflow-body">{fieldset?cloneElement(fieldset,{disabled:busy||fieldset.props.disabled,children:safeButtons(body,busy)}):<fieldset className="form-fields" disabled={busy}>{safeButtons(body,busy)}</fieldset>}</div><div className="workflow-footer">{Object.keys(errors).length>0&&<p className="form-error-summary field-error" role="alert">راجع الحقول المحددة قبل الحفظ. بياناتك المدخلة محفوظة في هذا النموذج.</p>}{documentError&&<p className="form-error-summary field-error workflow-document-error" tabIndex={-1} role="alert">{documentError}</p>}{error&&<p className="form-error-summary error" role="alert" tabIndex={-1}>{error}</p>}{safeButtons(footer,busy)}</div></form></FeedbackContext.Provider>;
}
