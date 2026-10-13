'use client';
import {Children,cloneElement,createContext,isValidElement,useCallback,useContext,useEffect,useId,useMemo,useRef,useState,forwardRef,type FormHTMLAttributes,type InputHTMLAttributes,type SelectHTMLAttributes,type ReactNode,type ReactElement} from 'react';
import {createPortal} from 'react-dom';
import {normalizeNumber} from '../../../packages/domain/opening-import';
import {focusControl,focusNextField,useFormKeyboard} from './form-keyboard';
export {focusControl} from './form-keyboard';

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
function useFeedback(node:React.RefObject<Control|null>,kind?:NumericKind,focusNode?:React.RefObject<Control|null>){
 const context=useContext(FeedbackContext),id=useId(),kindRef=useRef(kind);kindRef.current=kind;
 const check=useCallback(()=>node.current?inputError(node.current,kindRef.current):'',[node]);
 const register=context?.register;
 useEffect(()=>register?.(id,{check,node:()=>focusNode?.current??node.current}),[register,id,check,node,focusNode]);
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
function plainText(value:ReactNode):string{return Children.toArray(value).map(child=>isValidElement<{children?:ReactNode}>(child)?plainText(child.props.children):String(child??'')).join('');}
export function matchesSearch(value:string,query:string){const clean=(v:string)=>v.normalize('NFKC').replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/[أإآ]/g,'ا').replace(/\s+/g,' ').toLocaleLowerCase();return clean(value).includes(clean(query.trim()));}
export const SearchableSelect=forwardRef<HTMLSelectElement,SelectHTMLAttributes<HTMLSelectElement>&{onSearchEnter?:(value?:string)=>void;onCreate?:(query:string)=>void;createLabel?:string;openOnFocus?:boolean}>(function SearchableSelect({children,onSearchEnter,onCreate,createLabel='إضافة مادة جديدة',openOnFocus=true,...props},ref){
 const select=useRef<HTMLSelectElement>(null),search=useRef<HTMLInputElement>(null),list=useRef<HTMLDivElement>(null);
 const {id,message,context,check}=useFeedback(select,undefined,search),inputId=props.id??id+'-input';
 const [query,setQuery]=useState<string|null>(null),[open,setOpen]=useState(false),[active,setActive]=useState(-1),[uncontrolled,setUncontrolled]=useState(String(props.defaultValue??''));
 const [popup,setPopup]=useState({left:0,top:0,width:0,height:260,above:false}),[portal,setPortal]=useState<HTMLElement|null>(null);
 type Option={value:string;label:string;disabled:boolean};
 function collect(nodes:ReactNode,disabled=false):Option[]{return Children.toArray(nodes).flatMap(child=>{
  if(!isValidElement<{value?:string|number;children?:ReactNode;disabled?:boolean}>(child))return [];
  if(child.type==='option')return [{value:String(child.props.value??plainText(child.props.children)),label:plainText(child.props.children),disabled:disabled||!!child.props.disabled}];
  return collect(child.props.children,disabled||!!child.props.disabled);
 });}
 const options=collect(children),value=String(props.value??uncontrolled),selected=options.find(option=>option.value===value);
 const matches=options.filter(option=>option.value&&matchesSearch(option.label,query??''));
 const expanded=open&&!props.disabled,invalid=message?true:props['aria-invalid'];
 const described=[props['aria-describedby'],message?id+'-error':undefined,props.required?id+'-required':undefined,expanded?id+'-results':undefined].filter(Boolean).join(' ')||undefined;
 function placePopup(){
  const node=search.current;if(!node)return;const field=node.getBoundingClientRect(),viewport=window.visualViewport;
  const top=viewport?.offsetTop??0,bottom=top+(viewport?.height??window.innerHeight),below=bottom-field.bottom-12,above=field.top-top-12,useAbove=below<160&&above>below;
  setPopup({left:Math.max(8,Math.min(field.left,window.innerWidth-field.width-8)),top:useAbove?field.top-4:field.bottom+4,width:Math.min(field.width,window.innerWidth-16),height:Math.max(48,Math.min(260,useAbove?above:below)),above:useAbove});
  // Keep results in the dialog's top layer and outside scrolling tables/form bodies.
  setPortal(node.closest('dialog')??document.body);
 }
 function dismiss(){setOpen(false);setQuery(null);setActive(-1);}
 function advance(nextValue=value){if(onSearchEnter)onSearchEnter(nextValue||undefined);else requestAnimationFrame(()=>{if(search.current)focusNextField(search.current);});}
 function choose(index:number,continueForm=false){
  if(onCreate&&index===matches.length&&select.current&&!select.current.matches(':disabled')){const name=query?.trim()??'';dismiss();onCreate(name);return;}
  const option=matches[index],node=select.current;if(!option||option.disabled||!node||node.matches(':disabled'))return;
  node.value=option.value;setUncontrolled(option.value);node.dispatchEvent(new Event('change',{bubbles:true}));dismiss();
  if(continueForm)advance(option.value);
 }
 function move(step:number){
  const enabled=matches.map((option,index)=>option.disabled?-1:index).filter(index=>index>=0);if(onCreate)enabled.push(matches.length);if(!enabled.length)return;
  const current=enabled.indexOf(active),next=current<0?(step>0?0:enabled.length-1):(current+step+enabled.length)%enabled.length;
  placePopup();setOpen(true);setActive(enabled[next]);
 }
 useEffect(()=>{
  if(!expanded)return;placePopup();const reposition=()=>placePopup();
  window.addEventListener('resize',reposition);document.addEventListener('scroll',reposition,true);window.visualViewport?.addEventListener('resize',reposition);window.visualViewport?.addEventListener('scroll',reposition);
  return()=>{window.removeEventListener('resize',reposition);document.removeEventListener('scroll',reposition,true);window.visualViewport?.removeEventListener('resize',reposition);window.visualViewport?.removeEventListener('scroll',reposition);};
 },[expanded]);
 useEffect(()=>{
  const option=list.current?.querySelector<HTMLElement>(`[data-option-index="${active}"]`);if(!option||!list.current)return;
  const box=option.getBoundingClientRect(),viewport=list.current.getBoundingClientRect();if(box.top<viewport.top)list.current.scrollTop-=viewport.top-box.top;else if(box.bottom>viewport.bottom)list.current.scrollTop+=box.bottom-viewport.bottom;
 },[active,expanded]);
 useEffect(()=>{dismiss();},[value]);
 const {value:ignoredValue,defaultValue:ignoredDefault,name:ignoredName,id:ignoredId,onChange:ignoredChange,onBlur:ignoredBlur,onFocus:ignoredFocus,onKeyDown:ignoredKey,onInvalid:ignoredInvalid,required:ignoredRequired,multiple:ignoredMultiple,size:ignoredSize,...inputProps}=props;
 const results=expanded&&portal?createPortal(<div ref={list} id={id+'-options'} className="catalog-results" dir="rtl" style={{position:'fixed',left:popup.left,top:popup.top,width:popup.width,maxHeight:popup.height,transform:popup.above?'translateY(-100%)':undefined}} role="listbox" aria-label={`خيارات ${props['aria-label']??'الصنف'}`}>
  {matches.length?matches.map((option,index)=><div role="option" id={id+'-option-'+index} data-option-index={index} key={option.value} aria-selected={option.value===value} aria-disabled={option.disabled||undefined} className={(index===active?'active ':'')+(option.disabled?'disabled':'')} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(index)}>{option.label}{option.value===value&&<span aria-hidden="true" className="catalog-check">✓</span>}</div>):<span className="catalog-no-results">لا توجد نتائج مطابقة. الاختيار الحالي محفوظ.</span>}
  {onCreate&&<div role="option" id={id+'-option-'+matches.length} data-option-index={matches.length} aria-selected="false" className={'catalog-create '+(active===matches.length?'active':'')} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(matches.length)}><span><b aria-hidden="true">＋</b> {createLabel}</span><kbd aria-hidden="true">F2</kbd></div>}
 </div>,portal):null;
 return <span className="catalog-select">
  <span className="catalog-search"><input {...inputProps as InputHTMLAttributes<HTMLInputElement>} ref={search} id={inputId} type="search" role="combobox" autoComplete="off" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded?id+'-options':undefined} aria-activedescendant={expanded&&active>=0&&(matches[active]||onCreate&&active===matches.length)?id+'-option-'+active:undefined} aria-required={props.required||undefined} aria-invalid={invalid} aria-describedby={described} value={query??(selected?.value?selected.label:'')} placeholder={selected?.value?'ابحث بالاسم أو الكود…':selected?.label??'اختر أو ابحث بالاسم أو الكود…'}
   onFocus={event=>{props.onFocus?.(event as unknown as React.FocusEvent<HTMLSelectElement>);if(openOnFocus){placePopup();setOpen(true);setActive(matches.findIndex(option=>option.value===value));}event.currentTarget.select();}}
   onClick={()=>{if(!open){placePopup();setOpen(true);setActive(matches.findIndex(option=>option.value===value));}}}
   onBlur={event=>{if(event.relatedTarget instanceof Node&&list.current?.contains(event.relatedTarget))return;dismiss();if(select.current)props.onBlur?.({...event,target:select.current,currentTarget:select.current} as React.FocusEvent<HTMLSelectElement>);if(!(event.relatedTarget instanceof HTMLButtonElement))context?.report(id,check());}}
   onChange={event=>{setQuery(event.target.value);placePopup();setOpen(true);setActive(-1);}}
   onKeyDown={event=>{
    props.onKeyDown?.(event as unknown as React.KeyboardEvent<HTMLSelectElement>);if(event.defaultPrevented||event.nativeEvent.isComposing)return;
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();event.stopPropagation();move(event.key==='ArrowDown'?1:-1);}
    else if(event.key==='F2'&&onCreate){event.preventDefault();event.stopPropagation();if(!event.repeat)choose(matches.length);}
    else if(event.key==='Escape'&&(expanded||query!==null)){event.preventDefault();event.stopPropagation();dismiss();}
    else if(event.key==='Enter'&&!(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)){
     event.preventDefault();event.stopPropagation();if(event.repeat)return;
     if(expanded&&(query!==null||active>=0&&matches[active]?.value!==value)){const first=matches.findIndex(option=>!option.disabled),index=active>=0?active:first>=0?first:onCreate?matches.length:-1;if(index>=0)choose(index,true);return;}
     if(value){dismiss();advance();}else{placePopup();setOpen(true);setActive(matches.findIndex(option=>!option.disabled));}
    }
   }}/><span className="catalog-chevron" aria-hidden="true">⌄</span></span>
  <select ref={node=>{select.current=node;if(typeof ref==='function')ref(node);else if(ref)ref.current=node;}} hidden tabIndex={-1} aria-hidden="true" name={props.name} form={props.form} disabled={props.disabled} required={props.required} value={value} onChange={event=>{setUncontrolled(event.target.value);props.onChange?.(event);if(message||context?.submitted)context?.report(id,check());}} onInvalid={event=>{event.preventDefault();context?.report(id,check());props.onInvalid?.(event);focusControl(search.current,search.current?.closest('form')??null);}}>
   {!options.some(option=>option.value==='')&&<option value=""/>}{children}
  </select>
  {props.required&&<small className="field-hint" id={id+'-required'}><span className="field-required">* مطلوب</span></small>}
  <small className="field-hint catalog-result-count" id={id+'-results'} role="status" aria-live="polite">{expanded&&<>{matches.length?`${matches.length} نتيجة · الأسهم ثم Enter للاختيار`:'لا توجد نتائج مطابقة؛ الاختيار الحالي محفوظ.'}{onCreate&&` · F2: ${createLabel}`}</>}</small>
  {message&&<small className="field-error" id={id+'-error'}>{message}</small>}{results}
 </span>;
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
export function FormKeyboardHelp(){return <small className="form-keyboard-help"><kbd>Enter</kbd> التالي · <kbd>Shift + Enter</kbd> السابق · <kbd>Ctrl / ⌘ + Enter</kbd> تأكيد · <kbd>Alt + Insert</kbd> إضافة سطر عند توفره</small>;}
export const KeyboardForm=forwardRef<HTMLFormElement,FormHTMLAttributes<HTMLFormElement>&{busy?:boolean}>(function KeyboardForm({busy=false,children,...props},ref){
 const form=useRef<HTMLFormElement>(null),keyboard=useFormKeyboard(form,busy);
 return <form {...props} ref={node=>{form.current=node;if(typeof ref==='function')ref(node);else if(ref)ref.current=node;}} aria-busy={busy||props['aria-busy']} onKeyDown={event=>{props.onKeyDown?.(event);keyboard(event);}}>{children}</form>;
});
export function WorkflowForm({children,busy=false,error,summary,onEdit,onInvalid,documentCheck,onSubmit,...props}:Omit<FormHTMLAttributes<HTMLFormElement>,'onSubmit'>&{busy?:boolean;error?:string;summary?:ReactNode;onEdit?:()=>void;onInvalid?:()=>void;documentCheck?:()=>{message:string;field?:string}|undefined;onSubmit:NonNullable<FormHTMLAttributes<HTMLFormElement>['onSubmit']>}){
 const fields=useRef(new Map<string,Check>()),form=useRef<HTMLFormElement>(null),keyboard=useFormKeyboard(form,busy);
 const [errors,setErrors]=useState<Record<string,string>>({}),[submitted,setSubmitted]=useState(false),[documentError,setDocumentError]=useState('');
 const register=useCallback((id:string,check:Check)=>{fields.current.set(id,check);return()=>{fields.current.delete(id);setErrors(previous=>{if(!previous[id])return previous;const next={...previous};delete next[id];return next;});};},[]);
 const report=useCallback((id:string,message:string)=>setErrors(previous=>{if(previous[id]===message||!message&&!previous[id])return previous;const next={...previous};if(message)next[id]=message;else delete next[id];return next;}),[]);
 const feedback=useMemo(()=>({errors,submitted,register,report}),[errors,submitted,register,report]);
 let body=Children.toArray(children),fieldset:ReactElement<{children?:ReactNode;disabled?:boolean}>|undefined;
 if(body.length===1&&isValidElement<{children?:ReactNode;disabled?:boolean}>(body[0])&&body[0].type==='fieldset'){fieldset=body[0];body=Children.toArray(fieldset.props.children);}
 const last=body.at(-1);const hasFooter=isValidElement<{className?:string}>(last)&&(last.type==='button'||/heading-actions|modal-actions|workflow-actions/.test(last.props.className??''));
 const footer=hasFooter?body.pop():undefined;
 body=body.filter(child=>!isValidElement<{role?:string;children?:ReactNode}>(child)||child.type!=='p'||child.props.role!=='alert'||child.props.children!==error);
 return <FeedbackContext.Provider value={feedback}><form {...props} ref={form} noValidate aria-busy={busy} className={`workflow-form ${props.className??''}`} onKeyDown={event=>{props.onKeyDown?.(event);keyboard(event);}} onChange={e=>{onEdit?.();setDocumentError('');props.onChange?.(e);}} onSubmit={e=>{
  e.preventDefault();if(busy)return;const found:Record<string,string>={};for(const [id,field] of fields.current){const message=field.check();if(message)found[id]=message;}
  const issue=Object.keys(found).length?undefined:documentCheck?.();setDocumentError('');if(issue){const candidates=[...fields.current];const field=candidates.find(([,entry])=>issue.field&&entry.node()?.getAttribute('aria-label')===issue.field)??candidates.find(([,entry])=>issue.field&&entry.node()?.getAttribute('aria-label')?.startsWith(issue.field+' '));if(field)found[field[0]]=issue.message;else setDocumentError(issue.message);}
  setSubmitted(true);setErrors(found);
  const first=Object.keys(found)[0];if(first){onInvalid?.();requestAnimationFrame(()=>focusControl(fields.current.get(first)?.node(),form.current));return;}
  if(issue){requestAnimationFrame(()=>form.current?.querySelector<HTMLElement>('.workflow-document-error')?.focus());return;}onSubmit(e);
 }}><div className="workflow-body"><FormKeyboardHelp/>{fieldset?cloneElement(fieldset,{disabled:busy||fieldset.props.disabled,children:safeButtons(body,busy)}):<fieldset className="form-fields" disabled={busy}>{safeButtons(body,busy)}</fieldset>}</div><div className="workflow-footer">{Object.keys(errors).length>0&&<p className="form-error-summary field-error" role="alert">راجع الحقول المحددة قبل الحفظ. بياناتك المدخلة محفوظة في هذا النموذج.</p>}{documentError&&<p className="form-error-summary field-error workflow-document-error" tabIndex={-1} role="alert">{documentError}</p>}{error&&<p className="form-error-summary error" role="alert" tabIndex={-1}>{error}</p>}{summary?<div className="document-actions">{summary}<div className="document-buttons">{safeButtons(footer,busy)}</div></div>:safeButtons(footer,busy)}</div></form></FeedbackContext.Provider>;
}
