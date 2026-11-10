import {BusinessError} from '@saas/contracts';
import type {AttendanceClassifyCommand,DailyAttendanceData} from '../contracts/hr';
import {DAILY_CHECKIN_END,DAILY_CHECKOUT_END} from '../domain/attendance';
import type {QueryDatabase} from './database';

type DailyQuery={organizationId:string;from:string;to:string;page:number;deviceId?:string;badge?:string};

export async function classifyAttendancePunch(tx:QueryDatabase,c:AttendanceClassifyCommand){
 const scope=[c.organizationId,c.deviceId,c.badge,c.date];
 const {rows:[punch]}=await tx.query<{localTime:string;revision:number;oppositeTime:string|null}>(`
  SELECT to_char(p.local_time,'YYYY-MM-DD"T"HH24:MI:SS') AS "localTime",
   COALESCE(c.revision,0) AS revision,to_char(other.local_time,'YYYY-MM-DD"T"HH24:MI:SS') AS "oppositeTime"
  FROM hr_punches p JOIN hr_employees e USING(organization_id,device_id,badge)
  LEFT JOIN hr_daily_corrections c ON (c.organization_id,c.device_id,c.badge,c.attendance_day)=($1,$2::uuid,$3,$4::date)
  LEFT JOIN hr_punches other ON (other.organization_id,other.device_id,other.badge,other.event_key)=
   (p.organization_id,p.device_id,p.badge,CASE WHEN $6='entry' THEN c.exit_event_key ELSE c.entry_event_key END)
  WHERE (p.organization_id,p.device_id,p.badge,p.event_key)=($1,$2::uuid,$3,$5)
   AND p.local_time > $4::date + time '${DAILY_CHECKOUT_END}'
   AND p.local_time <= ($4::date + 1) + time '${DAILY_CHECKOUT_END}'`,[...scope,c.eventKey,c.direction]);
 if(!punch)throw new BusinessError('PUNCH_NOT_FOUND','البصمة غير متاحة لهذا الموظف في يوم الحضور المحدد.',404);
 if(punch.revision!==c.expectedRevision)throw new BusinessError('STALE_REVISION','تغيرت الوردية. حدّث الملخص اليومي ثم أعد المحاولة.',409);
 const entry=c.direction==='entry';
 if(entry&&punch.localTime.slice(0,10)!==c.date)
  throw new BusinessError('INVALID_ENTRY_DATE','اختر بصمة دخول من نفس يوم الحضور.',400);
 if(punch.oppositeTime&&(entry?punch.localTime>=punch.oppositeTime:punch.localTime<=punch.oppositeTime))
  throw new BusinessError('INVALID_PUNCH_ORDER','وقت الخروج يجب أن يكون بعد وقت الدخول المسجّل يدويًا.',400);
 await tx.query(`
  INSERT INTO hr_daily_corrections(organization_id,device_id,badge,attendance_day,entry_event_key,exit_event_key,reason)
  VALUES($1,$2,$3,$4,CASE WHEN $6='entry' THEN $5 END,CASE WHEN $6='exit' THEN $5 END,$7)
  ON CONFLICT (organization_id,device_id,badge,attendance_day) DO UPDATE SET
   entry_event_key=COALESCE(excluded.entry_event_key,hr_daily_corrections.entry_event_key),
   exit_event_key=COALESCE(excluded.exit_event_key,hr_daily_corrections.exit_event_key),
   skipped_event_key=NULLIF(hr_daily_corrections.skipped_event_key,$5),
   revision=hr_daily_corrections.revision+1,reason=excluded.reason,recorded_at=now()
 `,[...scope,c.eventKey,c.direction,entry?'تسجيل البصمة كدخول من المراجعة':'تسجيل البصمة كخروج من المراجعة']);
}

/** Device wall times: entry 07:00–16:05, checkout 14:00–05:00 after at least 11 hours.
 * Raw events are never modified. An unmatched overnight scan stays visible on the preceding day.
 * Aggregate the entire date range before pagination so a later page cannot change a day's result.
 */
export async function daytimeAttendance(tx:QueryDatabase,c:DailyQuery){
 const params:unknown[]=[c.organizationId,c.from,c.to];
 const overnight=`interval '${DAILY_CHECKOUT_END}'`;
 const filters=['p.organization_id=$1',`p.local_time > $2::date + ${overnight}`,`p.local_time <= $3::date + interval '1 day' + ${overnight}`];
 if(c.deviceId){params.push(c.deviceId);filters.push(`p.device_id=$${params.length}::uuid`);}
 if(c.badge){params.push(c.badge);filters.push(`p.badge=$${params.length}`);}
 params.push(c.page*100);
 // Resolve the overlap by choosing the first eligible arrival before looking for checkout.
 const exitWindow=`s.local_time >= e.day + interval '14 hours' AND s.local_time <= e.day + interval '1 day' + ${overnight}`;
 return (await tx.query<DailyAttendanceData>(`WITH source AS (
  SELECT p.device_id,p.badge,p.event_key,p.local_time,p.in_out_mode,
   CASE WHEN p.local_time::time <= time '${DAILY_CHECKOUT_END}' THEN p.local_time::date-1 ELSE p.local_time::date END AS day
  FROM hr_punches p WHERE ${filters.join(' AND ')}
 ), corrections AS (
  SELECT c.device_id,c.badge,c.attendance_day AS day,i.local_time AS first,o.local_time AS last,
   c.entry_event_key,c.exit_event_key,c.skipped_event_key,c.revision
  FROM hr_daily_corrections c
  LEFT JOIN source i ON (i.device_id,i.badge,i.day,i.event_key)=(c.device_id,c.badge,c.attendance_day,c.entry_event_key)
  LEFT JOIN source o ON (o.device_id,o.badge,o.day,o.event_key)=(c.device_id,c.badge,c.attendance_day,c.exit_event_key)
  WHERE c.organization_id=$1
    AND (c.entry_event_key IS NULL OR i.local_time::date=c.attendance_day)
    AND (c.exit_event_key IS NULL OR o.local_time IS NOT NULL)
    AND (i.local_time IS NULL OR o.local_time IS NULL OR o.local_time>i.local_time)
 ), entries AS (
  SELECT s.device_id,s.badge,s.day,
   COALESCE(c.first,min(s.local_time) FILTER (
    WHERE s.local_time::time BETWEEN time '07:00:00' AND time '${DAILY_CHECKIN_END}'
     AND s.event_key IS DISTINCT FROM c.skipped_event_key AND (c.last IS NULL OR s.local_time<c.last)
   )) AS first,
   c.entry_event_key,c.exit_event_key,c.skipped_event_key,COALESCE(c.revision,0) AS correction_revision
  FROM source s LEFT JOIN corrections c USING(device_id,badge,day)
  GROUP BY s.device_id,s.badge,s.day,c.first,c.last,c.entry_event_key,c.exit_event_key,c.skipped_event_key,c.revision
 ), classified AS (
  SELECT e.*,s.event_key,s.local_time,s.in_out_mode,
   CASE WHEN e.exit_event_key IS NOT NULL THEN s.event_key=e.exit_event_key
        ELSE (${exitWindow}) AND s.local_time >= e.first + interval '11 hours' END AS valid_exit,
   CASE
    WHEN s.event_key IN (e.entry_event_key,e.exit_event_key) THEN NULL
    WHEN e.first IS NULL THEN 'no_entry'
    WHEN s.local_time < e.first THEN 'before_entry'
    WHEN s.local_time >= e.first + interval '1 hour' AND NOT (${exitWindow}) THEN 'outside_checkout_window'
    WHEN s.local_time >= e.first + interval '1 hour' AND s.local_time < e.first + interval '11 hours' THEN 'short_shift'
   END AS review_reason
  FROM entries e JOIN source s USING(device_id,badge,day)
  WHERE s.event_key IS DISTINCT FROM e.skipped_event_key
 ), days AS (
  SELECT device_id,badge,day,first,correction_revision,max(local_time) FILTER (WHERE valid_exit) AS last,
   max(local_time) FILTER (WHERE in_out_mode=1 AND review_reason='short_shift') AS provisional_exit,
   count(*)::int AS punches,count(review_reason)::int AS unmatched,
   jsonb_agg(jsonb_build_object('eventKey',event_key,'localTime',to_char(local_time,'YYYY-MM-DD"T"HH24:MI:SS'),'reason',review_reason)
    ORDER BY local_time,event_key) FILTER (WHERE review_reason IS NOT NULL) AS review_punches
  FROM classified GROUP BY device_id,badge,day,first,correction_revision
 ) SELECT (SELECT count(*)::int FROM days) AS total,
  (SELECT count(*)::int FROM days WHERE first IS NOT NULL AND last IS NOT NULL) AS complete,
  (SELECT count(*)::int FROM days WHERE first IS NOT NULL AND last IS NULL) AS "missingOut",
  (SELECT count(*)::int FROM days WHERE first IS NULL) AS "missingIn",
  COALESCE((SELECT jsonb_agg(r) FROM (
   SELECT g.device_id::text AS "deviceId",d.name AS "deviceName",g.badge,e.employee_id::text AS "employeeId",e.name,g.day::text AS date,
    to_char(g.first,'YYYY-MM-DD"T"HH24:MI:SS') AS first,to_char(g.last,'YYYY-MM-DD"T"HH24:MI:SS') AS last,
    to_char(CASE WHEN g.last IS NULL THEN g.provisional_exit END,'YYYY-MM-DD"T"HH24:MI:SS') AS "provisionalExit",
    g.punches,(g.correction_revision>0) AS corrected,g.correction_revision AS "correctionRevision",
    g.unmatched AS "unmatchedPunches",COALESCE(g.review_punches,'[]'::jsonb) AS "reviewPunches"
   FROM days g JOIN hr_devices d ON d.organization_id=$1 AND d.device_id=g.device_id
   LEFT JOIN hr_employees e ON e.organization_id=$1 AND e.device_id=g.device_id AND e.badge=g.badge
   ORDER BY g.day DESC,CASE WHEN g.badge ~ '^[0-9]+$' THEN g.badge::numeric END NULLS LAST,g.badge,g.device_id
   LIMIT 100 OFFSET $${params.length}
  ) r),'[]'::jsonb) AS days`,params)).rows[0];
}
