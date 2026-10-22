'use client';
import {Children,Fragment,cloneElement,createContext,forwardRef,isValidElement,useContext,useId,useLayoutEffect,useRef,useState,type HTMLAttributes,type ReactElement,type ReactNode} from 'react';

type HeaderProps={children?:ReactNode;className?:string};
const SectionExpansion=createContext(true);
/** Hidden responsive charts have no measurable canvas; remount only their drawing. */
export function CollapsibleChart({children,...props}:HTMLAttributes<HTMLDivElement>){
 const expanded=useContext(SectionExpansion);return <div {...props}>{expanded?children:null}</div>;
}
function flatten(node:ReactNode):ReactNode[]{
 return Children.toArray(node).flatMap(child=>isValidElement<HeaderProps>(child)&&child.type===Fragment?flatten(child.props.children):[child]);
}
function heading(node:ReactNode):ReactElement<HeaderProps>|undefined{
 for(const child of Children.toArray(node)){
  if(!isValidElement<HeaderProps>(child))continue;
  if(child.type==='h2'||child.type==='h3'||child.type==='legend')return child;
  const nested=heading(child.props.children);if(nested)return nested;
 }
}
function text(node:ReactNode):string{
 return Children.toArray(node).map(child=>isValidElement<HeaderProps>(child)?text(child.props.children):typeof child==='string'||typeof child==='number'?String(child):'').join('');
}

/** Keep children mounted so collapsing never discards a draft, filter or page. */
const CollapsibleSection=forwardRef<HTMLElement,Omit<HTMLAttributes<HTMLElement>,'title'>&{title?:ReactNode;as?:'section'|'div'|'fieldset';defaultOpen?:boolean}>(function CollapsibleSection({children,title,as:Tag='section',defaultOpen=true,className='',onFocusCapture,...props},forwardedRef){
 const [open,setOpen]=useState(defaultOpen),id=useId(),root=useRef<HTMLElement|null>(null);
 const nodes=flatten(children),first=nodes[0],existing=heading(first);
 const header=title!==undefined?<h3>{title}</h3>:existing?nodes.shift():<h3>تفاصيل القسم</h3>;
 const label=text(title??existing?.props.children??'تفاصيل القسم');
 const toggle=<button type="button" className="section-toggle" aria-expanded={open} aria-controls={id} aria-label={(open?'طي قسم ':'توسيع قسم ')+label} onClick={()=>setOpen(value=>!value)}><span>{open?'طي':'توسيع'}</span><svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d={open?'m5 12 5-5 5 5':'m5 8 5 5 5-5'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></button>;
 const inline=isValidElement<HeaderProps>(header)&&(header.type==='div'||header.type==='legend');
 const renderedHeader=inline?cloneElement(header as ReactElement<HeaderProps>,{className:((header as ReactElement<HeaderProps>).props.className??'')+' collapsible-heading'},<>{(header as ReactElement<HeaderProps>).props.children}{toggle}</>):<div className="collapsible-heading">{header}{toggle}</div>;
 useLayoutEffect(()=>{
  const node=root.current;if(!node)return;
  const reveal=()=>setOpen(true);node.addEventListener('fodo:reveal-control',reveal);
  return()=>node.removeEventListener('fodo:reveal-control',reveal);
 },[]);
 return <Tag {...props} ref={(node:HTMLElement|null)=>{root.current=node;if(typeof forwardedRef==='function')forwardedRef(node);else if(forwardedRef)forwardedRef.current=node;}} className={className+' collapsible-section'} data-section-open={open} onFocusCapture={event=>{if(event.target===event.currentTarget)setOpen(true);onFocusCapture?.(event);}} onInvalidCapture={event=>{props.onInvalidCapture?.(event);setOpen(true);const target=event.target as HTMLElement;requestAnimationFrame(()=>target.focus());}}>
  {renderedHeader}<div id={id} className="collapsible-body" data-collapsible-body hidden={!open}><SectionExpansion.Provider value={open}>{nodes}</SectionExpansion.Provider></div>
 </Tag>;
});
export default CollapsibleSection;
