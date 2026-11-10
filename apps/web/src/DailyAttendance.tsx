'use client';
import {useEffect,useRef,useState} from 'react';
import type {AttendanceClassifyCommand,AttendanceDevice,AttendanceReviewPunch,DailyAttendanceData,DailyAttendanceRow} from '../../../packages/contracts/hr';
import {DAILY_CHECKIN_END,DAILY_CHECKOUT_END,wallMinute} from '../../../packages/domain/attendance';
import {attendanceTime} from './attendance-time';
import {DocumentEditor} from './DocumentForm';

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo'}).format(new Date());
const checkInEnd=attendanceTime('T'+DAILY_CHECKIN_END);
const shiftMinutes=12*60;
const duration=(minutes:number)=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
type Direction=AttendanceClassifyCommand['direction'];
const reviewReasons:Record<AttendanceReviewPunch['reason'],string>={
 no_entry:'لا توجد بصمة دخول مطابقة في يوم الحضور.',
 before_entry:'البصمة تسبق وقت الدخول.',
 short_shift:'البصمة قبل مرور ١١ ساعة من الدخول.',
 outside_checkout_window:'البصمة خارج فترة الخروج.',
};

function PunchTime({value}:{value:string}){
 return <time dir="ltr" dateTime={value} title={value.replace('T',' ')}>{attendanceTime(value)}</time>;
}

function PunchReview({row,close,save}:{row:DailyAttendanceRow;close:()=>void;save:(eventKey:string,direction:Direction)=>Promise<void>}){
 const [selected,setSelected]=useState<{punch:AttendanceReviewPunch;direction:Direction}|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const canClassify=!!row.employeeId&&row.correctionRevision!==undefined;
 function choose(punch:AttendanceReviewPunch,direction:Direction){setSelected({punch,direction});setError('');}
 async function confirm(){
  if(!selected?.punch.eventKey||busy)return;
  setBusy(true);setError('');
  try{await save(selected.punch.eventKey,selected.direction);}
  catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 return <DocumentEditor title="مراجعة البصمات" eyebrow="الملخص اليومي" close={close} busy={busy}>
  <div className="modal-body">
   <p><strong>{row.name??'غير مرتبط بملف'}</strong> · كود <bdi>{row.badge}</bdi> · يوم الحضور <bdi>{row.date}</bdi></p>
   {row.first&&<p>وقت الدخول <PunchTime value={row.first}/></p>}
   {!!row.reviewPunches?.length&&<div className="hr-table hr-review-table" tabIndex={0} role="region" aria-label="تفاصيل البصمات للمراجعة">
    <table><thead><tr><th>تاريخ البصمة</th><th>التوقيت</th><th>سبب المراجعة</th>{canClassify&&<th>الإجراء</th>}</tr></thead>
     <tbody>{row.reviewPunches.map((punch,index)=><tr key={punch.eventKey??punch.localTime+'-'+index}>
      <td><bdi>{punch.localTime.slice(0,10)}</bdi></td>
      <td><PunchTime value={punch.localTime}/>{punch.localTime===row.provisionalExit&&<small>خروج محتمل</small>}</td>
      <td>{reviewReasons[punch.reason]}</td>
      {canClassify&&<td><div className="hr-review-actions">
       <button type="button" className="secondary" disabled={busy||!punch.eventKey||punch.localTime.slice(0,10)!==row.date} onClick={()=>choose(punch,'entry')}>تسجيل كدخول</button>
       <button type="button" className="secondary" disabled={busy||!punch.eventKey} onClick={()=>choose(punch,'exit')}>تسجيل كخروج</button>
      </div></td>}
     </tr>)}</tbody>
    </table>
   </div>}
   {!row.reviewPunches?.length&&<p>حدّث الملخص اليومي لتحميل تفاصيل المراجعة.</p>}
   {selected&&<div className="notice">
    <p>اعتماد بصمة <PunchTime value={selected.punch.localTime}/> بتاريخ <bdi>{selected.punch.localTime.slice(0,10)}</bdi> {selected.direction==='entry'?'كدخول':'كخروج'} لوردية <bdi>{row.date}</bdi>.</p>
    <button type="button" className="primary" disabled={busy} onClick={()=>void confirm()}>{busy?'جارٍ الحفظ…':'تأكيد التسجيل'}</button>{' '}
    <button type="button" className="secondary" disabled={busy} onClick={()=>{setSelected(null);setError('');}}>إلغاء الاختيار</button>
   </div>}
   {error&&<p className="alert error" role="alert">{error}</p>}
  </div>
 </DocumentEditor>;
}

export default function DailyAttendance({request,write,devices}:{request:(body:Record<string,unknown>)=>Promise<unknown>;write:(body:Record<string,unknown>)=>Promise<unknown>;devices:AttendanceDevice[]}){
 const [from,setFrom]=useState(today),[to,setTo]=useState(today),[device,setDevice]=useState(''),[badge,setBadge]=useState(''),[page,setPage]=useState(0),[data,setData]=useState<DailyAttendanceData>({days:[],total:0,complete:0,missingOut:0}),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const serial=useRef(0);
 const [review,setReview]=useState<DailyAttendanceRow|null>(null);
 const [notice,setNotice]=useState('');
 async function load(){const id=++serial.current;setLoading(true);setError('');try{if(!from||!to||from>to)throw Error('حدد فترة صحيحة؛ البداية لا تتجاوز النهاية.');const result=await request({type:'attendance.daily',policy:'daytime-12h-v1',from,to,page,...(device?{deviceId:device}:{}),...(badge?{badge}:{})}) as DailyAttendanceData;if(id===serial.current)setData(result);}catch(e){if(id===serial.current){setError((e as Error).message);setData({days:[],total:0,complete:0,missingOut:0});}}finally{if(id===serial.current)setLoading(false);}}
 useEffect(()=>{void load();return()=>{serial.current++;};},[from,to,device,badge,page]);
 function quick(day:string){setFrom(day);setTo(day);setPage(0);}
 async function saveClassification(row:DailyAttendanceRow,eventKey:string,direction:Direction){
  await write({type:'attendance.classify',deviceId:row.deviceId,badge:row.badge,date:row.date,eventKey,direction,expectedRevision:row.correctionRevision});
  setReview(null);
  setNotice(direction==='entry'?'تم تسجيل البصمة كدخول.':'تم تسجيل البصمة كخروج.');
  await load();
 }
 return <div className="hr-daily" aria-busy={loading}>
  <div className="hr-toolbar hr-daily-filters"><label>من تاريخ<input aria-label="من تاريخ — الملخص اليومي" type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(0);}}/></label><label>إلى تاريخ<input aria-label="إلى تاريخ — الملخص اليومي" type="date" value={to} onChange={e=>{setTo(e.target.value);setPage(0);}}/></label><label>الجهاز<select aria-label="الجهاز — الملخص اليومي" value={device} onChange={e=>{setDevice(e.target.value);setPage(0);}}><option value="">كل الأجهزة</option>{devices.map(d=><option key={d.deviceId} value={d.deviceId}>{d.name}</option>)}</select></label><label>كود الموظف<input aria-label="كود الموظف — الملخص اليومي" value={badge} placeholder="مثل 101" maxLength={24} onChange={e=>{setBadge(e.target.value);setPage(0);}}/></label><button type="button" disabled={loading} onClick={()=>void load()}>تحديث اليوم</button></div>
  <div className="hr-toolbar hr-quick-dates"><button type="button" onClick={()=>quick(today())}>اليوم</button><button type="button" onClick={()=>quick(new Date(Date.parse(today()+'T12:00:00Z')-86400000).toISOString().slice(0,10))}>أمس</button><span>توقيت الجهاز المحلي · القاهرة</span></div>
  {error&&<p role="alert" className="alert error">{error}</p>}
  {notice&&<p role="status" className="notice">{notice}</p>}
  <div className="hr-metrics hr-daily-metrics"><div><span>سجلات يومية</span><strong>{loading?'—':data.total}</strong></div><div><span>دخول وخروج</span><strong>{loading?'—':data.complete}</strong></div><div><span>دون خروج مطابق</span><strong>{loading?'—':data.missingOut}</strong></div><div><span>دون بصمة دخول</span><strong>{loading?'—':data.missingIn??0}</strong></div></div>
  <p className="hr-daily-note">الدخول: أول بصمة من 7:00 صباحًا حتى <bdi>{checkInEnd}</bdi>. الخروج: آخر بصمة من 2:00 مساءً حتى {DAILY_CHECKOUT_END.slice(0,5)} صباح اليوم التالي، بشرط وجود دخول قبله بـ11 ساعة على الأقل. البصمات المتكررة خلال ساعة لا تغيّر الدخول ولا تُحسب خروجًا. زر المراجعة يعرض توقيت البصمات غير المطابقة وسبب المراجعة.</p>
  <div className="hr-list-caption" role="status">{loading?'جارٍ تحميل الحضور اليومي…':`${data.total} سجل يومي · صفحة ${page+1}`}</div>
  <div className="hr-table hr-daily-table" tabIndex={0} role="region" aria-label="جدول الحضور اليومي">
   <table aria-label="الحضور اليومي">
    <thead><tr><th>الموظف</th><th>الكود</th><th>يوم الحضور</th><th>وقت الدخول<small>7 صباحًا – <bdi>{checkInEnd}</bdi></small></th><th>وقت الخروج<small>بعد الدخول بـ11 ساعة على الأقل تلقائيًا</small></th><th>وقت العجز<small>وردية ١٢ ساعة</small></th><th>الوقت الإضافي<small>وردية ١٢ ساعة</small></th><th>عدد البصمات</th><th>الجهاز</th></tr></thead>
    <tbody>{!loading&&data.days.map(d=>{
     const checkout=d.last??d.provisionalExit;
     const worked=d.first&&d.last?Math.floor(wallMinute(d.last)-wallMinute(d.first)):null;
     return <tr key={d.deviceId+d.badge+d.date}>
      <td className="hr-name" data-label="الموظف"><strong>{d.name??'غير مرتبط بملف'}</strong></td>
      <td data-label="الكود"><bdi>{d.badge}</bdi></td>
      <td data-label="يوم الحضور"><bdi>{d.date}</bdi></td>
      <td className="hr-punch-time" data-label="وقت الدخول">{d.first?<PunchTime value={d.first}/>:<span className="hr-missing-out">— <small>لا يوجد دخول مطابق</small></span>}{d.corrected&&<small className="setup-subline">تم تصحيح الوردية</small>}</td>
      <td className="hr-punch-time" data-label="وقت الخروج">{checkout?<>
       <PunchTime value={checkout}/>
       {!d.last&&<small className="hr-unmatched">خروج محتمل · للمراجعة</small>}
       {checkout.slice(0,10)!==d.date&&<small className="setup-subline">اليوم التالي · <bdi>{checkout.slice(0,10)}</bdi></small>}
      </>:<span className="hr-missing-out">— <small>لا يوجد خروج مطابق</small></span>}</td>
      <td data-label="وقت العجز"><bdi>{worked===null?'—':duration(Math.max(0,shiftMinutes-worked))}</bdi></td>
      <td data-label="الوقت الإضافي"><bdi>{worked===null?'—':duration(Math.max(0,worked-shiftMinutes))}</bdi></td>
      <td data-label="البصمات">{d.punches}{!!d.unmatchedPunches&&<button type="button" className="secondary" onClick={()=>{setNotice('');setReview(d);}}>مراجعة البصمات ({d.unmatchedPunches})</button>}</td>
      <td data-label="الجهاز">{d.deviceName}</td>
     </tr>;
    })}</tbody>
   </table>
  </div>
  {review&&<PunchReview row={review} close={()=>setReview(null)} save={(eventKey,direction)=>saveClassification(review,eventKey,direction)}/>}
  {!loading&&!error&&!data.days.length&&<div className="hr-empty"><h3>لا توجد بصمات في هذه الفترة</h3><p>اختر تاريخًا آخر أو حدّث مزامنة جهاز البصمة.</p></div>}
  <div className="hr-toolbar hr-pagination"><button type="button" disabled={loading||page===0} onClick={()=>setPage(page-1)}>السابق</button><span>صفحة {page+1}</span><button type="button" disabled={loading||(page+1)*100>=data.total} onClick={()=>setPage(page+1)}>التالي</button></div>
 </div>;
}
