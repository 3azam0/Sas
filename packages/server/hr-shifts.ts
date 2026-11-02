import {BusinessError,type Access} from '../contracts';
import type {ShiftRequest,Shift,RosterDay} from '../contracts/hr-shifts';
import type {QueryDatabase} from './database';
import {calculateAttendance,cairoWall,wallMinute,shiftBounds} from '../domain/attendance';
export async function attendanceAction(tx:QueryDatabase,access:Access,c:ShiftRequest){
 const org=access.organizationId;
 const shifts=(await tx.query<{state:Shift}>('SELECT state FROM hr_shifts WHERE organization_id=$1 ORDER BY shift_id',[org])).rows.map(r=>r.state);
 const roster=(await tx.query<{state:RosterDay}>(`SELECT DISTINCT ON(employee_id,business_date) state FROM hr_roster_events WHERE organization_id=$1 ORDER BY employee_id,business_date,revision DESC`,[org])).rows.map(r=>r.state);
 if(c.type==='shift.create'){
  if(shifts.some(s=>s.shiftId===c.shift.shiftId))throw new BusinessError('DUPLICATE_SHIFT','Shift already exists.',409);
  await tx.query('INSERT INTO hr_shifts VALUES($1,$2,$3)',[org,c.shift.shiftId,JSON.stringify(c.shift)]);return;
 }
 if(c.type==='roster.save'){
  const employee=(await tx.query<{hire_date:string|null}>('SELECT hire_date::text FROM hr_employees WHERE organization_id=$1 AND employee_id=$2',[org,c.employeeId])).rows[0];if(!employee)throw new BusinessError('INVALID_EMPLOYEE','Employee not found.',400);
  if(employee.hire_date&&c.date<employee.hire_date)throw new BusinessError('INVALID_DATE','Date precedes hiring.',400);
  if(c.kind==='work'&&(!c.shiftId||!shifts.some(s=>s.shiftId===c.shiftId&&s.effectiveFrom<=c.date)))throw new BusinessError('INVALID_SHIFT','Select an effective shift.',400);
  if(c.kind!=='work'&&c.shiftId)throw new BusinessError('INVALID_SHIFT','Only work days have an assigned shift.',400);
  if(c.kind==='work'){
   const b=shiftBounds(c.date,shifts.find(s=>s.shiftId===c.shiftId)!);
   for(const p of roster.filter(r=>r.employeeId===c.employeeId&&r.date!==c.date&&r.kind==='work')){const s=shifts.find(s=>s.shiftId===p.shiftId);if(s){const other=shiftBounds(p.date,s);if(b.start<other.end&&other.start<b.end)throw new BusinessError('OVERLAPPING_SHIFT','Assigned shifts overlap, including overnight work.',409);}}
  }
  const prior=roster.find(r=>r.employeeId===c.employeeId&&r.date===c.date);if((prior?.revision??0)!==c.expectedRevision)throw new BusinessError('STALE_REVISION','Schedule changed. Refresh first.',409);
  if(c.kind==='off'&&roster.filter(r=>r.employeeId===c.employeeId&&r.date!==c.date&&r.date.slice(0,7)===c.date.slice(0,7)&&r.kind==='off').length>=4)throw new BusinessError('DAYS_OFF_LIMIT','Four regular days off are already scheduled this month.',409);
  const state:RosterDay={employeeId:c.employeeId,date:c.date,kind:c.kind,shiftId:c.shiftId,revision:c.expectedRevision+1,reason:c.reason};
  await tx.query('INSERT INTO hr_roster_events(organization_id,employee_id,business_date,revision,state,actor) VALUES($1,$2,$3,$4,$5,$6)',[org,c.employeeId,c.date,state.revision,JSON.stringify(state),access.userId]);return;
 }
 if(c.from>c.to||wallMinute(c.to)-wallMinute(c.from)>30*1440)throw new BusinessError('INVALID_RANGE','Choose up to 31 days.',400);
 const people=(await tx.query<{employeeId:string;name:string;hireDate:string|null;active:boolean;deviceId:string;badge:string}>('SELECT employee_id::text AS "employeeId",name,hire_date::text AS "hireDate",active,device_id::text AS "deviceId",badge FROM hr_employees WHERE organization_id=$1',[org])).rows;
 const punches=(await tx.query<{deviceId:string;badge:string;localTime:string}>(`SELECT device_id::text AS "deviceId",badge,to_char(local_time,'YYYY-MM-DD"T"HH24:MI:SS') AS "localTime" FROM hr_punches WHERE organization_id=$1 AND local_time >= $2::date-interval '1 day' AND local_time < $3::date+interval '2 days' ORDER BY local_time LIMIT 50001`,[org,c.from,c.to])).rows;if(punches.length>50000)throw new BusinessError('RANGE_TOO_LARGE','Choose a shorter period.',400);
 const devices=(await tx.query<{device_id:string;last_seen_at:string|null}>('SELECT device_id::text,last_seen_at::text FROM hr_devices WHERE organization_id=$1',[org])).rows,seen:Record<string,string>={};for(const d of devices)if(d.last_seen_at)seen[d.device_id]=cairoWall(new Date(d.last_seen_at));
 const now=cairoWall(new Date()),months=new Set<string>();for(let n=wallMinute(c.from);n<=wallMinute(c.to);n+=1440)months.add(new Date(n*60000).toISOString().slice(0,7));
 const history=(await tx.query<{state:RosterDay;actor:string;postedAt:string}>(`SELECT state,actor,posted_at::text AS "postedAt" FROM hr_roster_events WHERE organization_id=$1 AND business_date BETWEEN $2::date AND $3::date ORDER BY posted_at DESC,revision DESC LIMIT 200`,[org,c.from,c.to])).rows;
 return {shifts,roster,history,days:calculateAttendance(people,shifts,roster,punches,c.from,c.to,now,seen),daysOff:people.flatMap(e=>[...months].map(month=>{const off=roster.filter(r=>r.employeeId===e.employeeId&&r.kind==='off'&&r.date.startsWith(month));return {employeeId:e.employeeId,name:e.name,month,scheduled:off.length,taken:off.filter(r=>r.date<now.slice(0,10)).length,remaining:Math.max(0,4-off.length)};}))};
}
