'use client';
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal,flushSync} from 'react-dom';
import type {Snapshot} from '@saas/contracts';
import {HelpButton} from './ClientGuide';
import {printPageRule,printPreferenceKey,rollPageHeight,validPrintPaper,type PrintPaper,type PrintOrientation} from './printing';

export default function PrintPreview({title,close,children,orientation:initialOrientation='portrait'}:{title:string;close:()=>void;children:ReactNode|((paper:PrintPaper)=>ReactNode);orientation?:PrintOrientation}){
 const dialog=useRef<HTMLDialogElement>(null),sheet=useRef<HTMLElement>(null),trigger=useRef<HTMLElement|null>(null),id=useId();
 const [mounted,setMounted]=useState(false),[paper,setPaper]=useState<PrintPaper>('a4'),[orientation,setOrientation]=useState(initialOrientation),[height,setHeight]=useState(297),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{trigger.current=document.activeElement as HTMLElement;try{setPaper(validPrintPaper(localStorage.getItem(printPreferenceKey)));}catch{}setMounted(true);return()=>{trigger.current?.focus({preventScroll:true});};},[]);
 useEffect(()=>{if(mounted)dialog.current?.showModal();},[mounted]);
 function choose(value:string){const next=validPrintPaper(value);setPaper(next);setError('');try{localStorage.setItem(printPreferenceKey,next);}catch{}}
 async function print(){if(busy)return;setBusy(true);setError('');try{
  await document.fonts?.ready;
  const images=[...sheet.current?.querySelectorAll('img')??[]];await Promise.all(images.map(img=>img.complete?Promise.resolve():img.decode().catch(()=>{})));
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  flushSync(()=>setHeight(rollPageHeight(sheet.current?.scrollHeight??0)));
  window.print();
 }catch{setError('تعذر فتح الطباعة. حاول مرة أخرى من المتصفح.');}finally{setBusy(false);}}
 if(!mounted)return null;
 return createPortal(<dialog ref={dialog} className="modal foodo-print-modal" aria-labelledby={id} data-paper={paper} data-orientation={orientation} onCancel={event=>{event.preventDefault();if(!busy)close();}}>
  <style media="print">{printPageRule(paper,orientation,height)}</style>
  <div className="print-preview-toolbar"><div><h2 id={id}>{title}</h2><p>اختر مقاس الورق وراجع المستند قبل الطباعة.</p></div><button type="button" className="icon-button" aria-label="إغلاق معاينة الطباعة" disabled={busy} onClick={close}>×</button>
   <div className="print-preview-controls"><HelpButton topic="printing"/><label>حجم الورق<select aria-label="حجم ورق الطباعة" value={paper} disabled={busy} onChange={e=>choose(e.target.value)}><option value="a4">A4</option><option value="roll80">رول 80 مم (8 سم)</option></select></label>{paper==='a4'&&<label>الاتجاه<select aria-label="اتجاه الطباعة" value={orientation} disabled={busy} onChange={e=>setOrientation(e.target.value as PrintOrientation)}><option value="portrait">طولي</option><option value="landscape">عرضي</option></select></label>}<button type="button" className="primary" disabled={busy} onClick={()=>void print()}>{busy?'تجهيز الطباعة…':'طباعة / حفظ PDF'}</button></div>
   <small>اختر نفس مقاس الورق في نافذة الطابعة، والمقياس 100%، وأوقف رؤوس وتذييلات المتصفح. معاينة A4 قابلة للتمرير على الهاتف؛ الرول يعرض التفاصيل دون رسوم.</small>{error&&<p className="error" role="alert">{error}</p>}
  </div>
  <div className="print-preview-viewport" tabIndex={0} aria-label="معاينة المستند"><article ref={sheet} className="print-preview-sheet" dir="rtl">{typeof children==='function'?children(paper):children}</article></div>
 </dialog>,document.body);
}
export function PrintHeader({snapshot,title,number}:{snapshot:Snapshot;title:string;number?:string}){return <header className="document-print-header">{snapshot.organizationProfile?.logoPath&&<img src={snapshot.organizationProfile.logoPath} alt=""/>}<div><h2>{snapshot.organizationName}</h2><h1>{title}</h1>{number&&<p><bdi>{number}</bdi></p>}</div></header>;}
export function PrintTable({columns,rows}:{columns:string[];rows:{id:string;cells:ReactNode[]}[]}){return <table className="document-print-table"><thead><tr>{columns.map((label,index)=><th key={index}>{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}>{row.cells.map((value,index)=><td key={index} data-label={columns[index]}><div className="document-print-value">{value??'—'}</div></td>)}</tr>)}</tbody></table>;}
