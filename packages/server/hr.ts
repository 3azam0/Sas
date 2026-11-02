import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {BusinessError,type Access} from '@saas/contracts';
import {hrRequestSchema,attendanceUploadSchema,type HrData} from '../contracts/hr';
import type {Database} from './database';
import {attendanceAction} from './hr-shifts';
import {saveEmployeeDetails} from './hr-profile';
import type {Salary,Advance,AdvanceRepayment} from '../contracts/hr-profile';

export const hrTokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
function fail(code:string,message:string,status=409):never{throw new BusinessError(code,message,status);}
function manager(access:Access){if(!['owner','manager'].includes(access.role??''))fail('FORBIDDEN','ملفات الموظفين والحضور متاحة للمالك والمدير فقط.',403);if(!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())fail('AUTH_REQUIRED','جدد جلسة الدخول.',401);}
const employeesSql=`SELECT employee_id::text AS "employeeId",device_id::text AS "deviceId",badge,name,device_name AS "deviceName",phone,department,job_title AS "jobTitle",hire_date::text AS "hireDate",active,notes,revision FROM hr_employees WHERE organization_id=$1 ORDER BY CASE WHEN badge ~ '^[0-9]+$' THEN badge::numeric END NULLS LAST,badge,name,device_id`;
const devicesSql=`SELECT device_id::text AS "deviceId",name,active,revision,last_seen_at::text AS "lastSeenAt" FROM hr_devices WHERE organization_id=$1 ORDER BY name`;
export async function postHr(db:Database,access:Access,input:unknown){
 manager(access);const parsed=hrRequestSchema.safeParse(input);if(!parsed.success)fail('INVALID_COMMAND','راجع بيانات الموظف أو فترة الحضور.',400);const c=parsed.data;
 if(c.organizationId!==access.organizationId)fail('FORBIDDEN','نطاق المؤسسة غير صالح.',403);
 return db.transaction(async tx=>{
  const org=(await tx.query<{generation:string}>('SELECT generation::text FROM organizations WHERE id=$1 FOR UPDATE',[access.organizationId])).rows[0];
  if(org?.generation!==c.generation)fail('STALE_GENERATION','زامن مساحة العمل أولاً.');
  if(c.type==='attendance.summary')return attendanceAction(tx,access,c);
  if(c.type==='hr.list'){
   if(c.from>c.to)fail('INVALID_COMMAND','بداية الفترة بعد نهايتها.',400);
   const params:unknown[]=[c.organizationId,c.from,c.to],filters=['p.organization_id=$1','p.local_time >= $2::date','p.local_time < $3::date + interval \'1 day\''];
   if(c.deviceId){params.push(c.deviceId);filters.push(`p.device_id=$${params.length}::uuid`);}if(c.badge){params.push(c.badge);filters.push(`p.badge=$${params.length}`);}
   const where=filters.join(' AND '),total=Number((await tx.query<{n:string}>(`SELECT count(*)::text AS n FROM hr_punches p WHERE ${where}`,params)).rows[0].n);
   const punches=(await tx.query(`SELECT p.event_key AS "eventKey",p.device_id::text AS "deviceId",p.badge,to_char(p.local_time,'YYYY-MM-DD"T"HH24:MI:SS') AS "localTime",p.verify_mode AS "verifyMode",p.in_out_mode AS "inOutMode",p.work_code AS "workCode",p.received_at::text AS "receivedAt",e.employee_id::text AS "employeeId",e.name FROM hr_punches p LEFT JOIN hr_employees e ON e.organization_id=p.organization_id AND e.device_id=p.device_id AND e.badge=p.badge WHERE ${where} ORDER BY p.local_time DESC,p.device_id,p.event_key LIMIT 100 OFFSET $${params.length+1}`, [...params,c.page*100])).rows;
   const salaries=(await tx.query<{state:Salary;revision:number}>('SELECT state,revision FROM hr_salaries WHERE organization_id=$1',[c.organizationId])).rows.map(r=>({...r.state,revision:r.revision}));
   const advances=(await tx.query<{state:Advance}>("SELECT state FROM hr_advances WHERE organization_id=$1 ORDER BY state->>'issuedOn' DESC,advance_id",[c.organizationId])).rows.map(r=>r.state);
   const advanceRepayments=(await tx.query<{state:AdvanceRepayment}>("SELECT state FROM hr_advance_repayments WHERE organization_id=$1 ORDER BY state->>'paidOn',repayment_id",[c.organizationId])).rows.map(r=>r.state);
   return {employees:(await tx.query(employeesSql,[c.organizationId])).rows,devices:(await tx.query(devicesSql,[c.organizationId])).rows,jobs:(await tx.query('SELECT job_id::text AS "jobId",name FROM hr_job_titles WHERE organization_id=$1 ORDER BY name,job_id',[c.organizationId])).rows,salaries,advances,advanceRepayments,punches,total} as HrData;
  }
  const hash=hrTokenHash(JSON.stringify(c));const previous=(await tx.query<{payload_hash:string;result:unknown}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[c.organizationId,c.operationId])).rows[0];
  if(previous){if(previous.payload_hash!==hash)fail('PAYLOAD_CONFLICT','معرف الطلب مستخدم لبيانات مختلفة.');return previous.result;}
  if(c.type==='shift.create'||c.type==='roster.save'){
   await attendanceAction(tx,access,c);const result={operationId:c.operationId,outcome:'accepted'};
   await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[c.organizationId,c.operationId,hash,JSON.stringify(result)]);
   await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[c.organizationId,access.userId,c.operationId,c.type]);return result;
  }
  let token:string|undefined;
  if(c.type==='salary.save'||c.type==='advance.issue'||c.type==='advance.repay'){
   await saveEmployeeDetails(tx,c);
  }else if(c.type==='job.create'){
   const j=c.job;
   if((await tx.query('SELECT 1 FROM hr_job_titles WHERE organization_id=$1 AND (lower(btrim(name))=lower(btrim($2)) OR job_id=$3)',[c.organizationId,j.name,j.jobId])).rows.length)fail('DUPLICATE_JOB','المسمى الوظيفي موجود بالفعل؛ اختره من القائمة.');
   await tx.query('INSERT INTO hr_job_titles(organization_id,job_id,name) VALUES($1,$2,$3)',[c.organizationId,j.jobId,j.name]);
  }else if(c.type==='device.create'){
   if((await tx.query('SELECT 1 FROM hr_devices WHERE organization_id=$1 AND device_id=$2',[c.organizationId,c.deviceId])).rows.length)fail('DUPLICATE_DEVICE','الجهاز مسجل بالفعل.');
   token='fodo_hr_'+randomBytes(32).toString('hex');await tx.query('INSERT INTO hr_devices(organization_id,device_id,name,token_hash) VALUES($1,$2,$3,$4)',[c.organizationId,c.deviceId,c.name,hrTokenHash(token)]);
  }else if(c.type==='device.rotate'){
   token='fodo_hr_'+randomBytes(32).toString('hex');
   if(!(await tx.query('UPDATE hr_devices SET token_hash=$4,active=true,revision=revision+1 WHERE organization_id=$1 AND device_id=$2 AND revision=$3 RETURNING device_id',[c.organizationId,c.deviceId,c.expectedRevision,hrTokenHash(token)])).rows.length)fail('STALE_REVISION','تغير الجهاز؛ حدث القائمة.');
  }else if(c.type==='device.revoke'){
   if(!(await tx.query('UPDATE hr_devices SET active=false,revision=revision+1 WHERE organization_id=$1 AND device_id=$2 AND revision=$3 RETURNING device_id',[c.organizationId,c.deviceId,c.expectedRevision])).rows.length)fail('STALE_REVISION','تغير الجهاز؛ حدث القائمة.');
  }else{
   const e=c.employee;
   // Legacy clients can still submit a title; retain it in the shared dropdown.
   if(e.jobTitle)await tx.query('INSERT INTO hr_job_titles(organization_id,job_id,name) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[c.organizationId,randomUUID(),e.jobTitle]);
   if(!(await tx.query('SELECT 1 FROM hr_devices WHERE organization_id=$1 AND device_id=$2',[c.organizationId,e.deviceId])).rows.length)fail('INVALID_DEVICE','سجل جهاز البصمة أولاً.');
   if((await tx.query('SELECT 1 FROM hr_employees WHERE organization_id=$1 AND device_id=$2 AND badge=$3 AND employee_id<>$4',[c.organizationId,e.deviceId,e.badge,e.employeeId])).rows.length)fail('DUPLICATE_BADGE','كود البصمة مرتبط بموظف آخر.');
   if(c.expectedRevision===0){
    await tx.query('INSERT INTO hr_employees(organization_id,employee_id,device_id,badge,name,phone,department,job_title,hire_date,active,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[c.organizationId,e.employeeId,e.deviceId,e.badge,e.name,e.phone,e.department,e.jobTitle,e.hireDate,e.active,e.notes]);
   }else if(!(await tx.query('UPDATE hr_employees SET name=$5,phone=$6,department=$7,job_title=$8,hire_date=$9,active=$10,notes=$11,revision=revision+1 WHERE organization_id=$1 AND employee_id=$2 AND device_id=$3 AND badge=$4 AND revision=$12 RETURNING employee_id',[c.organizationId,e.employeeId,e.deviceId,e.badge,e.name,e.phone,e.department,e.jobTitle,e.hireDate,e.active,e.notes,c.expectedRevision])).rows.length)fail('STALE_REVISION','تغير ملف الموظف أو كود البصمة؛ حدث القائمة.');
  }
  const result={operationId:c.operationId,outcome:'accepted'};
  // Pairing secrets are returned once, never stored in command receipts or browser preferences.
  await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[c.organizationId,c.operationId,hash,JSON.stringify(result)]);
  await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[c.organizationId,access.userId,c.operationId,c.type]);
  return {...result,...(token?{token,deviceId:c.type==='device.create'||c.type==='device.rotate'?c.deviceId:undefined}:{})};
 });
}

export async function ingestAttendance(db:Database,organizationId:string,token:string,input:unknown){
 const parsed=attendanceUploadSchema.safeParse(input);if(!parsed.success)fail('INVALID_UPLOAD','Invalid attendance batch.',400);const c=parsed.data,hash=hrTokenHash(JSON.stringify(c));
 return db.transaction(async tx=>{
  const device=(await tx.query('SELECT 1 FROM hr_devices WHERE organization_id=$1 AND device_id=$2 AND token_hash=$3 AND active FOR UPDATE',[organizationId,c.deviceId,hrTokenHash(token)])).rows[0];if(!device)fail('AUTH_REQUIRED','Device credential revoked or invalid.',401);
  if(!c.users.length&&!c.punches.length){await tx.query('UPDATE hr_devices SET last_seen_at=now() WHERE organization_id=$1 AND device_id=$2',[organizationId,c.deviceId]);return {batchId:c.batchId,deviceId:c.deviceId,outcome:'accepted',received:0,inserted:0};}
  const prior=(await tx.query<{payload_hash:string;result:unknown}>('SELECT payload_hash,result FROM hr_upload_receipts WHERE organization_id=$1 AND device_id=$2 AND batch_id=$3',[organizationId,c.deviceId,c.batchId])).rows[0];
  if(prior){if(prior.payload_hash!==hash)fail('PAYLOAD_CONFLICT','Batch ID has different contents.');return prior.result;}
  const badges=new Set<string>();for(const u of c.users){if(badges.has(u.badge))fail('INVALID_UPLOAD','Duplicate roster badge.',400);badges.add(u.badge);
   await tx.query(`INSERT INTO hr_employees(organization_id,employee_id,device_id,badge,name,device_name) VALUES($1,$2,$3,$4,$5,$5) ON CONFLICT(organization_id,device_id,badge) DO UPDATE SET device_name=excluded.device_name`,[organizationId,randomUUID(),c.deviceId,u.badge,u.name||'موظف '+u.badge]);
  }
  let inserted=0;for(const p of c.punches){const key=hrTokenHash(JSON.stringify([c.deviceId,p.badge,p.localTime,p.verifyMode,p.inOutMode,p.workCode]));inserted+=(await tx.query('INSERT INTO hr_punches(organization_id,device_id,event_key,badge,local_time,verify_mode,in_out_mode,work_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING event_key',[organizationId,c.deviceId,key,p.badge,p.localTime,p.verifyMode,p.inOutMode,p.workCode])).rows.length;}
  const result={batchId:c.batchId,deviceId:c.deviceId,outcome:'accepted',received:c.punches.length,inserted};
  await tx.query('INSERT INTO hr_upload_receipts VALUES($1,$2,$3,$4,$5)',[organizationId,c.deviceId,c.batchId,hash,JSON.stringify(result)]);
  await tx.query('UPDATE hr_devices SET last_seen_at=now() WHERE organization_id=$1 AND device_id=$2',[organizationId,c.deviceId]);return result;
 });
}
