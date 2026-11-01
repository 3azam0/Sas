'use client';
import {useEffect,type RefObject} from 'react';

/** Expand the existing report without remounting its filters, tables or request state. */
export function useReportFullscreen(root:RefObject<HTMLDivElement|null>,expanded:boolean,close:()=>void){
 useEffect(()=>{
  const node=root.current;if(!expanded||!node)return;
  const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const previousOverflow=document.body.style.overflow;
  const siblings:{element:HTMLElement;inert:boolean}[]=[];
  let branch:HTMLElement=node;
  while(branch.parentElement){
   for(const sibling of branch.parentElement.children)if(sibling!==branch&&sibling instanceof HTMLElement){siblings.push({element:sibling,inert:sibling.inert});sibling.inert=true;}
   branch=branch.parentElement;if(branch===document.body)break;
  }
  document.body.style.overflow='hidden';
  const frame=requestAnimationFrame(()=>node.querySelector<HTMLButtonElement>('[data-report-restore]')?.focus());
  const keydown=(event:KeyboardEvent)=>{
   if(event.defaultPrevented||(event.target instanceof Element&&event.target.closest('dialog[open]')))return;
   if(event.key==='Escape'){event.preventDefault();close();return;}
   if(event.key!=='Tab')return;
   const controls=[...node.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(element=>element.getClientRects().length&&!element.closest('[hidden],[inert]'));
   const first=controls[0],last=controls.at(-1);if(!first){event.preventDefault();node.focus();return;}
   if(event.shiftKey&&(document.activeElement===first||document.activeElement===node)){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  node.addEventListener('keydown',keydown);
  return()=>{cancelAnimationFrame(frame);node.removeEventListener('keydown',keydown);for(const saved of siblings)saved.element.inert=saved.inert;document.body.style.overflow=previousOverflow;if(opener?.isConnected)opener.focus();};
 },[root,expanded,close]);
}
