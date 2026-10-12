import {useEffect,useRef,type KeyboardEvent,type RefObject} from 'react';

export type FormControl=HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
type Key={key:string;ctrlKey?:boolean;metaKey?:boolean;altKey?:boolean;shiftKey?:boolean;repeat?:boolean;isComposing?:boolean};
export function formKeyIntent(key:Key,kind:string,busy=false){
 if(key.isComposing)return 'native';
 if(key.key==='Enter'&&(key.ctrlKey||key.metaKey))return busy||key.repeat?'ignore':'submit';
 if(key.key==='Insert'&&key.altKey)return busy||key.repeat?'ignore':'add';
 if(key.key!=='Enter'||key.altKey||key.ctrlKey||key.metaKey)return 'native';
 if(['button','textarea','file'].includes(kind))return 'native';
 if(busy||key.repeat)return 'ignore';
 return key.shiftKey?'previous':'next';
}
export function formFields(form:HTMLFormElement){
 return Array.from(form.querySelectorAll<FormControl>('input,select,textarea')).filter(node=>{
  if(node.matches(':disabled,[readonly],[type=hidden],[tabindex="-1"]')||node.closest('.collection-top,[data-keyboard-excluded=true]'))return false;
  if(node instanceof HTMLInputElement&&['button','submit','reset','image'].includes(node.type))return false;
  if(node.getClientRects().length)return true;
  // Paged document rows retain their controls; reveal their page before focusing.
  const row=node.closest('[data-collection-row]');return !!row?.hasAttribute('hidden')&&!row.parentElement?.closest('[hidden],dialog:not([open])');
 });
}
export function focusControl(node:FormControl|null|undefined,form:HTMLFormElement|null,revealAttempts=0){
 if(!node)return;
 if(node.closest('[data-collection-row]')?.hasAttribute('hidden')){if(revealAttempts>=3)return;node.dispatchEvent(new CustomEvent('fodo:reveal-control',{bubbles:true}));requestAnimationFrame(()=>focusControl(node,form,revealAttempts+1));return;}
 node.focus({preventScroll:true});
 const body=form?.querySelector<HTMLElement>('.workflow-body,.modal-body');
 if(body?.contains(node)){const field=(node.closest('label,td')??node).getBoundingClientRect(),viewport=body.getBoundingClientRect(),top=field.top<viewport.top+12?field.top-viewport.top-12:field.bottom>viewport.bottom-12?field.bottom-viewport.bottom+12:0;if(top)body.scrollBy({top,behavior:'instant'});}
 const table=node.closest<HTMLElement>('.table-scroll');if(table){const field=node.getBoundingClientRect(),viewport=table.getBoundingClientRect(),left=field.left<viewport.left+12?field.left-viewport.left-12:field.right>viewport.right-12?field.right-viewport.right+12:0;if(left)table.scrollBy({left,behavior:'instant'});}
}
function submitButton(form:HTMLFormElement){return Array.from(form.querySelectorAll<HTMLButtonElement>('button')).find(button=>button.type==='submit'&&!button.matches(':disabled')&&button.getClientRects().length>0);}
export function focusNextField(node:FormControl,direction=1){
 const form=node.closest('form');if(!form)return;const fields=formFields(form),index=fields.indexOf(node);if(index<0)return;const next=fields[index+direction];if(next)focusControl(next,form);else if(direction>0)submitButton(form)?.focus({preventScroll:true});
}
export function useFormKeyboard(form:RefObject<HTMLFormElement|null>,busy:boolean){
 const trigger=useRef<HTMLElement|null>(typeof document!=='undefined'&&document.activeElement instanceof HTMLElement?document.activeElement:null),busyRef=useRef(busy);busyRef.current=busy;
 useEffect(()=>{
  const element=form.current;if(!element)return;const dialog=element.closest('dialog');let frame=0;
  const initialFocus=()=>{frame=requestAnimationFrame(()=>{if(busyRef.current||dialog&&!dialog.open||element.contains(document.activeElement))return;focusControl(formFields(element)[0],element);element.closest('.opening-editor')?.scrollIntoView({block:'start'});});};
  initialFocus();const observer=dialog?new MutationObserver(()=>{if(dialog.open)initialFocus();}):null;observer?.observe(dialog!,{attributes:true,attributeFilter:['open']});
  return()=>{cancelAnimationFrame(frame);observer?.disconnect();const previous=trigger.current;if(previous?.isConnected&&!previous.closest('[hidden],[inert]'))previous.focus({preventScroll:true});};
 },[form]);
 return (event:KeyboardEvent<HTMLFormElement>)=>{
  if(event.defaultPrevented)return;const element=event.currentTarget,target=event.target;if(!(target instanceof HTMLElement))return;
  const kind=target instanceof HTMLTextAreaElement?'textarea':target instanceof HTMLButtonElement?'button':target instanceof HTMLInputElement?target.type:'select';
  const intent=formKeyIntent({key:event.key,ctrlKey:event.ctrlKey,metaKey:event.metaKey,altKey:event.altKey,shiftKey:event.shiftKey,repeat:event.repeat,isComposing:event.nativeEvent.isComposing},kind,busy);
  if(intent==='native'){
   if(event.key==='Escape'&&!busy&&!element.closest('dialog')&&!['select','file'].includes(kind)){
    const cancel=Array.from((element.closest('.opening-editor')??element).querySelectorAll<HTMLButtonElement>('button')).find(button=>!button.matches(':disabled')&&/^(إلغاء|إلغاء التعديل|إغلاق)(\s|$)/.test(button.textContent?.trim()??'')&&!/^إلغاء (المتبقي|التحويل|الاستلام|استيراد)/.test(button.textContent?.trim()??''));
    if(cancel){event.preventDefault();cancel.click();}
   }return;
  }
  event.preventDefault();
  if(intent==='submit'){const submit=submitButton(element);if(submit)element.requestSubmit(submit);return;}
  if(intent==='add'){
   const add=element.querySelector<HTMLButtonElement>('button[data-keyboard-add]:not(:disabled)');if(!add)return;const before=new Set(formFields(element));add.click();requestAnimationFrame(()=>focusControl(formFields(element).find(node=>!before.has(node)),element));return;
  }
  if(intent!=='ignore'&&(target instanceof HTMLInputElement||target instanceof HTMLSelectElement))focusNextField(target,intent==='previous'?-1:1);
 };
}
