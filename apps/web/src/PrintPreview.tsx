'use client';
import {useCallback,useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import type {Snapshot} from '@saas/contracts';
import {HelpButton} from './ClientGuide';
import PrinterSetup from './PrinterSetup';
import {capturePrintSheet} from './print-capture';
import {helperToken,helperPrinters,printRecordKey,readPrintReceipt,savePrintReceipt,sendPrintPacket,printJobStatus,printSubmissionFailure,type HelperPrinter,type PrintReceipt,type PrintPage} from './print-bridge';
import {printPreferenceKey,validPrintPaper,type PrintPaper,type PrintOrientation} from './printing';
export default function PrintPreview({organizationId,documentId,title,close,children,orientation:initialOrientation='portrait'}:{organizationId:string;documentId:string;title:string;close:()=>void;children:ReactNode|((paper:PrintPaper)=>ReactNode);orientation?:PrintOrientation}){
 const dialog=useRef<HTMLDialogElement>(null),sheet=useRef<HTMLElement>(null),trigger=useRef<HTMLElement|null>(null),id=useId();
 const [mounted,setMounted]=useState(false),[paper,setPaper]=useState<PrintPaper>('a4'),[orientation,setOrientation]=useState(initialOrientation),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [connected,setConnected]=useState(false),[printers,setPrinters]=useState<HelperPrinter[]>([]),[last,setLast]=useState<PrintReceipt|null>(null),[copy,setCopy]=useState(false),[proof,setProof]=useState<PrintPage[]>([]),[proofPage,setProofPage]=useState(0);
 const recordKey=printRecordKey(organizationId,documentId,paper),printer=printers.find(p=>p.paper===paper),needsCopy=!!last&&last.status!=='failed';
 const refresh=useCallback(async()=>{try{const list=await helperPrinters(organizationId);setPrinters(list);setConnected(true);}catch(e){setConnected(false);setPrinters([]);throw e;}},[organizationId]);
 useEffect(()=>{trigger.current=document.activeElement as HTMLElement;try{setPaper(validPrintPaper(localStorage.getItem(printPreferenceKey)));}catch{}setMounted(true);if(helperToken(organizationId))void refresh().catch(e=>setError(e.message));return()=>{trigger.current?.focus({preventScroll:true});};},[organizationId,refresh]);
 useEffect(()=>{if(mounted)dialog.current?.showModal();},[mounted]);
 useEffect(()=>{setLast(readPrintReceipt(recordKey));setCopy(false);setProof([]);setProofPage(0);},[recordKey,orientation]);
 function remember(value:PrintReceipt){savePrintReceipt(recordKey,value);setLast(value);}
 function choose(value:string){const next=validPrintPaper(value);setPaper(next);setError('');try{localStorage.setItem(printPreferenceKey,next);}catch{}}
 async function check(){if(!last||busy)return;setBusy(true);setError('');try{remember(await printJobStatus(organizationId,last.id));}catch(e){setError(e instanceof Error?e.message:'تعذر تأكيد الحالة.');}finally{setBusy(false);}}
 async function prepareOnly(){if(busy||!sheet.current)return;setBusy(true);setError('');try{setProof(await capturePrintSheet(sheet.current,paper,orientation,printer?.widthDots||576));setProofPage(0);}catch(e){setError(e instanceof Error?e.message:'تعذر تجهيز المستند.');}finally{setBusy(false);}}
 async function print(){if(busy||!sheet.current||!connected||!printer||needsCopy&&!copy)return;setBusy(true);setError('');let pending:PrintReceipt|null=null,accepted=false;try{
  const pages=await capturePrintSheet(sheet.current,paper,orientation,printer.widthDots||576),jobId=crypto.randomUUID(),createdAt=new Date().toISOString();
  pending={id:jobId,organizationId,status:'unknown',message:'جارٍ إرسال الطلب؛ لا تعاود الطباعة حتى تأكيد حالته.',title,createdAt};remember(pending);setCopy(false);
  let result=await sendPrintPacket({version:1,id:jobId,organizationId,title:title.slice(0,160),paper,orientation,printerId:printer.id,createdAt,pages});accepted=true;remember(result);
  for(let attempt=0;attempt<8&&['queued','sending'].includes(result.status);attempt++){await new Promise(resolve=>setTimeout(resolve,500));result=await printJobStatus(organizationId,jobId);remember(result);}
 }catch(e){if(pending)remember(printSubmissionFailure(pending,accepted,e));setError(e instanceof Error?e.message:'تعذر تأكيد إرسال الطباعة.');}finally{setBusy(false);}}
 if(!mounted)return null;
 return createPortal(<dialog ref={dialog} className="modal foodo-print-modal" aria-labelledby={id} data-paper={paper} data-orientation={orientation} aria-busy={busy} onCancel={event=>{event.preventDefault();if(!busy)close();}}>
  <div className="print-preview-toolbar"><div><h2 id={id}>{title}</h2><p>راجع المستند واختر الورق، ثم اطبع مباشرة إلى طابعة ويندوز المحفوظة.</p></div><button type="button" className="icon-button" aria-label="إغلاق معاينة الطباعة" disabled={busy} onClick={close}>×</button>
   <div className="print-preview-controls"><HelpButton topic="printing"/><label>حجم الورق<select aria-label="حجم ورق الطباعة" value={paper} disabled={busy} onChange={e=>choose(e.target.value)}><option value="a4">A4</option><option value="roll80">رول 80 مم (8 سم)</option></select></label>{paper==='a4'&&<label>الاتجاه<select aria-label="اتجاه الطباعة" value={orientation} disabled={busy} onChange={e=>setOrientation(e.target.value as PrintOrientation)}><option value="portrait">طولي</option><option value="landscape">عرضي</option></select></label>}<label>طابعة المقاس<output>{printer?.name??'لم تُهيّأ بعد'}</output></label><button type="button" className="secondary" disabled={busy} onClick={()=>void prepareOnly()}>معاينة نسخة الطابعة</button><button type="button" className="primary" disabled={busy||!connected||!printer||needsCopy&&!copy} onClick={()=>void print()}>{busy?'جارٍ التجهيز / التحقق…':needsCopy?'إعادة طباعة نسخة':'طباعة مباشرة'}</button></div>
   <div className="print-helper-area"><PrinterSetup organizationId={organizationId} connected={connected} printers={printers} refresh={refresh} disconnected={()=>{setConnected(false);setPrinters([]);}} disabled={busy}/></div>
   {last&&<div className="print-job-status" role="status"><strong>{last.title}</strong><span>{last.message}</span><small><bdi>{last.id}</bdi></small><button type="button" className="text-button" disabled={busy||!connected} onClick={()=>void check()}>تحقق من حالة الطلب</button>{needsCopy&&<label><input type="checkbox" checked={copy} disabled={busy} onChange={e=>setCopy(e.target.checked)}/>راجعت الطابعة وأريد نسخة أخرى من هذا المستند.</label>}</div>}
   {proof.length>0&&<details open className="print-raster-proof"><summary>نسخة الطابعة · صفحة {proofPage+1} من {proof.length}</summary>{proof.length>1&&<div><button type="button" className="text-button" disabled={proofPage===0} onClick={()=>setProofPage(p=>p-1)}>السابق</button><button type="button" className="text-button" disabled={proofPage===proof.length-1} onClick={()=>setProofPage(p=>p+1)}>التالي</button></div>}<div className="print-raster-image"><img alt={'نسخة الطابعة المجهزة — صفحة '+(proofPage+1)} src={'data:image/png;base64,'+proof[proofPage].png}/></div></details>}
   <small>الطباعة لا تعدّل المخزون. «تم التسليم» يعني قبول طابور الطابعة؛ تحقق من خروج الورق. عند غياب تأكيد الإرسال، راجع الحالة والطابعة قبل طلب نسخة أخرى.</small>{error&&<p className="error" role="alert">{error}</p>}
  </div>
  <div className="print-preview-viewport" tabIndex={0} aria-label="معاينة المستند"><article ref={sheet} className="print-preview-sheet" dir="rtl">{typeof children==='function'?children(paper):children}</article></div>
 </dialog>,document.body);
}
export function PrintHeader({snapshot,title,number}:{snapshot:Snapshot;title:string;number?:string}){return <header className="document-print-header">{snapshot.organizationProfile?.logoPath&&<img src={snapshot.organizationProfile.logoPath} alt=""/>}<div><h2>{snapshot.organizationName}</h2><h1>{title}</h1>{number&&<p><bdi>{number}</bdi></p>}</div></header>;}
export function PrintTable({columns,rows}:{columns:string[];rows:{id:string;cells:ReactNode[]}[]}){return <table className="document-print-table"><thead><tr>{columns.map((label,index)=><th key={index}>{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}>{row.cells.map((value,index)=><td key={index} data-label={columns[index]}><div className="document-print-value">{value??'—'}</div></td>)}</tr>)}</tbody></table>;}
