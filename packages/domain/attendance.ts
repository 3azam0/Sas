import type {Shift,RosterDay,DailyAttendance} from '../contracts/hr-shifts';
export const wallMinute=(s:string)=>Date.parse(s+(s.length===10?'T00:00:00':'')+'Z')/60000;
export const dayAt=(n:number)=>new Date(n*60000).toISOString().slice(0,10);
export function cairoWall(now:Date){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now);const v=(k:string)=>parts.find(p=>p.type===k)!.value;return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}:${v('second')}`;}
export function shiftBounds(date:string,s:Shift){const start=wallMinute(date+'T'+s.start+':00');let end=wallMinute(date+'T'+s.end+':00');if(end<=start)end+=1440;return {start,end};}
type Person={employeeId:string;name:string;hireDate:string|null;active:boolean;deviceId:string;badge:string};
type Punch={deviceId:string;badge:string;localTime:string};
export function calculateAttendance(people:Person[],shifts:Shift[],roster:RosterDay[],punches:Punch[],from:string,to:string,nowWall:string,seen:Record<string,string>){
 const result:DailyAttendance[]=[],now=wallMinute(nowWall);
 for(const e of people){
  const logs=[...new Set(punches.filter(p=>p.deviceId===e.deviceId&&p.badge===e.badge).map(p=>p.localTime))].sort();const used=new Set<string>();
  const plans=roster.filter(r=>r.employeeId===e.employeeId);
  // Process the preceding day first so an overnight checkout is never reused as a new arrival.
  for(let d=wallMinute(from)-1440;d<=wallMinute(to);d+=1440){const date=dayAt(d),plan=plans.find(r=>r.date===date),base:DailyAttendance={employeeId:e.employeeId,name:e.name,date,shiftId:null,shiftName:'',source:'none',status:'unscheduled',first:null,last:null,lateMinutes:null,earlyMinutes:null,workedMinutes:null,overtimeMinutes:null,reason:'',revision:plan?.revision??0};
   if(e.hireDate&&date<e.hireDate)continue;if(!e.active&&!plan)continue;
   const available=logs.filter(t=>!used.has(t));
   if(plan?.kind==='off'||plan?.kind==='leave'){base.status=plan.kind;const actual=available.filter(t=>t.slice(0,10)===date);if(actual.length){base.status='review';base.reason='Attendance on a day off or leave';base.first=actual[0];base.last=actual.length>1?actual.at(-1)!:null;}if(date>=from)result.push(base);continue;}
   let chosen=plan?.kind==='work'?shifts.find(s=>s.shiftId===plan.shiftId):undefined;
   let first:string|undefined;let ambiguous=false;
   if(chosen){base.source='assigned';const b=shiftBounds(date,chosen);first=available.find(t=>wallMinute(t)>=b.start-chosen!.earlyWindow&&wallMinute(t)<=b.end);}
   else{
    const candidates=shifts.filter(s=>s.effectiveFrom<=date).flatMap(s=>{const b=shiftBounds(date,s),t=available.find(t=>wallMinute(t)>=b.start-s.earlyWindow&&wallMinute(t)<=b.start+s.lateWindow);return t?[{shift:s,time:t,distance:Math.abs(wallMinute(t)-b.start)}]:[];}).sort((a,b)=>a.time.localeCompare(b.time)||a.distance-b.distance);
    if(candidates.length){const earliest=candidates[0].time,options=candidates.filter(c=>c.time===earliest).sort((a,b)=>a.distance-b.distance);ambiguous=options.length>1&&Math.abs(options[0].distance-options[1].distance)<15;chosen=options[0].shift;first=earliest;base.source='detected';}
   }
   if(!chosen){const actual=available.filter(t=>t.slice(0,10)===date);base.first=actual[0]??null;base.reason=actual.length?'No shift matches arrival':'No expected shift assigned';if(date>=from)result.push(base);continue;}
   const b=shiftBounds(date,chosen);base.shiftId=chosen.shiftId;base.shiftName=chosen.name;
   if(ambiguous){base.status='review';base.first=first!;base.reason='More than one shift matches; assign the correct shift';if(date>=from)result.push(base);continue;}
   // Bound checkout before the following assigned shift, avoiding shared punches.
   const next=plans.filter(p=>p.kind==='work'&&p.date>date).map(p=>{const s=shifts.find(s=>s.shiftId===p.shiftId);return s?shiftBounds(p.date,s).start-1/60000:Infinity;});
   const cutoff=Math.min(b.end+chosen.lateWindow,...next);
   const actual=first?available.filter(t=>wallMinute(t)>=wallMinute(first!)&&wallMinute(t)<=cutoff):[];
   const closed=now>b.end+chosen.lateWindow;
   const synced=!!seen[e.deviceId]&&wallMinute(seen[e.deviceId])>=b.end+chosen.lateWindow;
   if(!first){base.status=now<b.start?'upcoming':!closed?'in_progress':!synced?'sync_pending':'absent';const outside=available.find(t=>t.slice(0,10)===date);if(outside){base.status='review';base.first=outside;base.reason='Attendance outside assigned shift; verify schedule';}}
   else{actual.forEach(t=>used.add(t));base.first=first;base.last=actual.length>1?actual.at(-1)!:null;base.lateMinutes=Math.max(0,Math.floor(wallMinute(first)-b.start)-chosen.graceMinutes);base.status=!closed?'in_progress':!base.last?'missing_punch':!synced?'sync_pending':'present';
    if(base.last){base.workedMinutes=Math.max(0,Math.floor(wallMinute(base.last)-wallMinute(first))-chosen.breakMinutes);base.earlyMinutes=Math.max(0,Math.floor(b.end-wallMinute(base.last)));base.overtimeMinutes=Math.max(0,Math.floor(wallMinute(base.last)-b.end));}
    if(closed&&base.last&&wallMinute(base.last)-wallMinute(first)<5){base.status='review';base.reason='Punches less than five minutes apart; verify checkout';base.workedMinutes=null;base.overtimeMinutes=null;}
    // The device supplies wall times only; DST transition days require human review.
    const zone=(n:number)=>new Intl.DateTimeFormat('en',{timeZone:'Africa/Cairo',timeZoneName:'shortOffset'}).formatToParts(new Date(n*60000)).find(p=>p.type==='timeZoneName')?.value;
    if(zone(b.start-720)!==zone(b.end+720)){base.status='review';base.reason='Clock/DST transition: verify actual duration';base.workedMinutes=null;base.overtimeMinutes=null;}
    if(wallMinute(first)>now){base.status='review';base.reason='Punch timestamp is in the future; verify device clock';base.workedMinutes=null;base.overtimeMinutes=null;}
   }
   if(date>=from)result.push(base);
  }
 }
 return result.sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name));
}
