'use client';
import {useState} from 'react';
import CollapsibleSection from './CollapsibleSection';
import {helperDownload,pairPrintHelper,forgetHelper,type HelperPrinter} from './print-bridge';
export default function PrinterSetup({organizationId,connected,printers,refresh,disconnected,disabled=false}:{organizationId:string;connected:boolean;printers:HelperPrinter[];refresh:()=>Promise<void>;disconnected:()=>void;disabled?:boolean}){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function pair(){setBusy(true);setError('');setMessage('');try{await pairPrintHelper(organizationId,code);setCode('');await refresh();setMessage('تم ربط هذا المتصفح بالمساعد لهذه المؤسسة.');}catch(e){setError(e instanceof Error?e.message:'تعذر ربط المساعد.');}finally{setBusy(false);}}
 return <CollapsibleSection className="print-helper-setup" title="إعداد الطابعة · ويندوز" defaultOpen={!connected}>
  <p>نزّل المساعد، فك ضغط الملف ثم افتح <bdi>Start-FooDo-Print.cmd</bdi>. اختر طابعة A4 و/أو رول 80 مم في نافذته واتركه يعمل.</p>
  <a className="secondary print-helper-download" href={helperDownload} download>تنزيل مساعد ويندوز</a><small>ويندوز 10/11 · نسخة 1.0.0 · تحتاج تعريف الطابعة. تطبيق محلي غير موقّع رقمياً.</small>
  <div className="print-helper-pair"><label>رمز الربط الظاهر في المساعد<input aria-label="رمز ربط مساعد الطباعة" autoComplete="off" spellCheck={false} dir="ltr" maxLength={8} value={code} disabled={busy||disabled} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,''))}/></label><button type="button" className="secondary" disabled={busy||disabled||code.length!==8} onClick={()=>void pair()}>{busy?'جارٍ الربط…':'ربط المتصفح'}</button><button type="button" className="text-button" disabled={busy||disabled} onClick={()=>{setError('');void refresh().catch(e=>setError(e.message));}}>تحديث الطابعات</button>{connected&&<button type="button" className="text-button" disabled={busy||disabled} onClick={()=>{forgetHelper(organizationId);disconnected();setMessage('أُلغي الربط في هذا المتصفح. لإلغاء كل المتصفحات استخدم نافذة المساعد.');}}>فصل هذا المتصفح</button>}</div>
  <p className="print-helper-connection">{connected?'المساعد متصل · '+printers.length+' طابعة مهيأة':'المساعد غير متصل. اسمح باتصال FooDo بالجهاز المحلي إذا طلب المتصفح ذلك عند الربط.'}</p>
  {connected&&printers.length===0&&<p>اختر الطابعات في نافذة المساعد واضغط «حفظ الطابعات»، ثم حدّث القائمة هنا.</p>}
  {message&&<p role="status">{message}</p>}{error&&<p className="error" role="alert">{error}</p>}
 </CollapsibleSection>;
}
