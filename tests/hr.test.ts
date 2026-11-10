import {afterEach,beforeEach,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createDatabase,seed} from '../packages/server';
import {postHr,ingestAttendance,hrTokenHash} from '../packages/server/hr';
import type {Access} from '../packages/contracts';
import type {AttendanceUpload,HrData,DailyAttendanceData} from '../packages/contracts/hr';
let db:Awaited<ReturnType<typeof createDatabase>>,generation:string,deviceId:string,token:string;
const access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),role:'owner',expiresAt:'2099-01-01T00:00:00Z'};
const base=()=>({organizationId:'grills',generation,operationId:randomUUID()});
const list=async(extra={})=>await postHr(db,access,{...baseWithoutId(),type:'hr.list',from:'2026-11-01',to:'2026-11-02',page:0,...extra}) as HrData;
const baseWithoutId=()=>({organizationId:'grills',generation});
const batch=(extra:Partial<AttendanceUpload>={}):AttendanceUpload=>({schemaVersion:1,batchId:randomUUID(),deviceId,users:[{badge:'101',name:'Device name'}],punches:[{badge:'101',localTime:'2026-11-02T08:00:00',verifyMode:1,inOutMode:0,workCode:0}],...extra});
beforeEach(async()=>{db=await createDatabase();await seed(db,'moving_average',false);generation=(await db.query<{g:string}>("SELECT generation::text AS g FROM organizations WHERE id='grills'")).rows[0].g;deviceId=randomUUID();const r=await postHr(db,access,{...base(),type:'device.create',deviceId,name:'K14'}) as {token:string};token=r.token;});
afterEach(async()=>{await db.close();});
it('groups a calendar day into separate first/last punches without inventing an exit or joining midnight to the previous day',async()=>{
 const punch=(badge:string,localTime:string)=>({badge,localTime,verifyMode:1,inOutMode:0,workCode:0});
 await ingestAttendance(db,'grills',token,batch({users:[{badge:'101',name:'First employee'},{badge:'102',name:'Second employee'}],punches:[punch('101','2026-11-01T01:22:10'),punch('101','2026-11-01T08:00:00'),punch('101','2026-11-01T13:00:52'),punch('102','2026-11-01T12:07:00'),punch('999','2026-11-01T10:00:00'),punch('101','2026-11-02T00:05:00')]}));
 const result=await postHr(db,access,{...baseWithoutId(),type:'attendance.daily',from:'2026-11-01',to:'2026-11-02',page:0}) as DailyAttendanceData;
 expect(result).toMatchObject({total:4,complete:1,missingOut:3});expect(result.days[0]).toMatchObject({badge:'101',date:'2026-11-02',first:'2026-11-02T00:05:00',last:null,punches:1});expect(result.days.find(d=>d.badge==='101'&&d.date==='2026-11-01')).toMatchObject({first:'2026-11-01T01:22:10',last:'2026-11-01T13:00:52',punches:3});expect(result.days.find(d=>d.badge==='102')?.last).toBeNull();expect(result.days.find(d=>d.badge==='999')?.employeeId).toBeNull();
});
it('reclassifies the existing overnight example without changing raw history or the cached-client contract',async()=>{
 const punch=(localTime:string)=>({badge:'108',localTime,verifyMode:1,inOutMode:0,workCode:0});
 await ingestAttendance(db,'grills',token,batch({users:[{badge:'108',name:'Overnight employee'}],punches:[punch('2026-11-03T01:01:38'),punch('2026-11-03T13:18:38'),punch('2026-11-04T01:23:58'),punch('2026-11-04T13:32:10')]}));
 const before=await db.query('SELECT * FROM hr_punches ORDER BY local_time,event_key');
 const query={...baseWithoutId(),type:'attendance.daily',policy:'daytime-12h-v1',from:'2026-11-02',to:'2026-11-04',page:0};
 const result=await postHr(db,access,query) as DailyAttendanceData;
 expect(result).toMatchObject({total:3,complete:1,missingOut:1,missingIn:1});
 expect(result.days.map(d=>({date:d.date,first:d.first,last:d.last,punches:d.punches,unmatched:d.unmatchedPunches}))).toEqual([
  {date:'2026-11-04',first:'2026-11-04T13:32:10',last:null,punches:1,unmatched:0},
  {date:'2026-11-03',first:'2026-11-03T13:18:38',last:'2026-11-04T01:23:58',punches:2,unmatched:0},
  {date:'2026-11-02',first:null,last:null,punches:1,unmatched:1}
 ]);
 expect((await postHr(db,access,{...query,from:'2026-11-04',to:'2026-11-04'}) as DailyAttendanceData).days).toHaveLength(1);
 const {policy,...legacy}=query;
 expect((await postHr(db,access,legacy) as DailyAttendanceData).days.find(d=>d.date==='2026-11-04')).toMatchObject({first:'2026-11-04T01:23:58',last:'2026-11-04T13:32:10',punches:2});
 expect((await db.query('SELECT * FROM hr_punches ORDER BY local_time,event_key')).rows).toEqual(before.rows);
});
it('requires 11 elapsed hours, keeps rolling-hour repeats and never replaces the first entry',async()=>{
 const punch=(badge:string,time:string)=>({badge,localTime:'2026-11-04T'+time,verifyMode:1,inOutMode:0,workCode:0});
 await ingestAttendance(db,'grills',token,batch({users:[],punches:[
  punch('101','07:00:00'),punch('101','07:59:59'),punch('101','14:00:00'),punch('101','17:59:59'),punch('101','18:00:00'),punch('101','19:00:00'),
  punch('102','08:00:00'),punch('102','08:25:00'),punch('102','18:59:59'),
  punch('103','14:50:00'),punch('103','15:10:00'),
  punch('104','14:00:33'),{...punch('104','00:57:54'),localTime:'2026-11-05T00:57:54',inOutMode:1}
 ]}));
 const query={...baseWithoutId(),type:'attendance.daily',policy:'daytime-12h-v1',from:'2026-11-04',to:'2026-11-04',page:0};
 const result=await postHr(db,access,query) as DailyAttendanceData;
 expect(result).toMatchObject({total:4,complete:1,missingOut:3,missingIn:0});
 expect(result.days.find(d=>d.badge==='101')).toMatchObject({first:'2026-11-04T07:00:00',last:'2026-11-04T19:00:00',punches:6,unmatchedPunches:2});
 expect(result.days.find(d=>d.badge==='102')).toMatchObject({first:'2026-11-04T08:00:00',last:null,punches:3,unmatchedPunches:1,provisionalExit:null});
 expect(result.days.find(d=>d.badge==='103')).toMatchObject({first:'2026-11-04T14:50:00',last:null,punches:2,unmatchedPunches:0});
 expect(result.days.find(d=>d.badge==='104')).toMatchObject({
  date:'2026-11-04',first:'2026-11-04T14:00:33',last:null,provisionalExit:'2026-11-05T00:57:54',unmatchedPunches:1,
  reviewPunches:[{localTime:'2026-11-05T00:57:54',reason:'short_shift'}]
 });
});
it('enforces inclusive window edges, keeps out-of-window and missing-entry punches visible and isolates devices',async()=>{
 const punch=(badge:string,localTime:string)=>({badge,localTime,verifyMode:1,inOutMode:0,workCode:0});
 const logs=[punch('101','2026-11-04T06:59:59'),punch('101','2026-11-04T07:00:00'),punch('101','2026-11-04T18:00:00'),
  punch('102','2026-11-04T16:05:00'),punch('102','2026-11-05T01:59:59'),punch('102','2026-11-05T04:59:59'),punch('102','2026-11-05T05:00:00'),punch('102','2026-11-05T05:00:01'),
  punch('103','2026-11-04T16:05:01'),punch('103','2026-11-05T01:30:00'),punch('104','2026-11-04T14:00:00')];
 await ingestAttendance(db,'grills',token,batch({users:[],punches:logs}));
 const otherId=randomUUID(),created=await postHr(db,access,{...base(),type:'device.create',deviceId:otherId,name:'Other K14'}) as {token:string};
 await ingestAttendance(db,'grills',created.token,batch({deviceId:otherId,users:[],punches:[punch('104','2026-11-05T01:00:00')]}));
 const query={...baseWithoutId(),type:'attendance.daily',policy:'daytime-12h-v1',from:'2026-11-04',to:'2026-11-04',page:0,deviceId};
 const result=await postHr(db,access,query) as DailyAttendanceData;
 expect(result).toMatchObject({total:4,complete:2,missingOut:1,missingIn:1});
 expect(result.days.find(d=>d.badge==='101')).toMatchObject({first:'2026-11-04T07:00:00',last:'2026-11-04T18:00:00',punches:3,unmatchedPunches:1});
 expect(result.days.find(d=>d.badge==='102')).toMatchObject({first:'2026-11-04T16:05:00',last:'2026-11-05T05:00:00',punches:4,unmatchedPunches:1});
 expect(result.days.find(d=>d.badge==='103')).toMatchObject({first:null,last:null,punches:2,unmatchedPunches:2});
 expect(result.days.find(d=>d.badge==='104')).toMatchObject({first:'2026-11-04T14:00:00',last:null});
 expect((await postHr(db,access,{...query,from:'2026-11-05',to:'2026-11-05',badge:'102'}) as DailyAttendanceData).days[0]).toMatchObject({first:null,last:null,punches:1,unmatchedPunches:1});
 expect((await postHr(db,access,{...query,deviceId:otherId}) as DailyAttendanceData).days[0]).toMatchObject({badge:'104',first:null,last:null});
 await expect(postHr(db,access,{...query,policy:'unknown'})).rejects.toMatchObject({code:'INVALID_COMMAND'});
});
it('applies a correction to the selected shift without changing the raw events or the preceding shift',async()=>{
 const badge='130';
 const ignored='2026-11-05T08:27:57',entry='2026-11-05T16:00:47',exit='2026-11-06T03:38:32';
 const times=['2026-11-04T08:28:39','2026-11-05T02:49:27',ignored,entry,exit];
 const punches=times.map((localTime,index)=>({badge,localTime,verifyMode:1,inOutMode:index===1||index===4?1:0,workCode:0}));
 await ingestAttendance(db,'grills',token,batch({users:[{badge,name:'Employee'}],punches}));
 const eventKey=(p:typeof punches[number])=>hrTokenHash(JSON.stringify([deviceId,p.badge,p.localTime,p.verifyMode,p.inOutMode,p.workCode]));
 await db.query(
  'INSERT INTO hr_daily_corrections(organization_id,device_id,badge,attendance_day,entry_event_key,exit_event_key,skipped_event_key,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
  ['grills',deviceId,badge,'2026-11-05',eventKey(punches[3]),eventKey(punches[4]),eventKey(punches[2]),'Verified the actual shift'],
 );
 const result=await postHr(db,access,{...baseWithoutId(),type:'attendance.daily',policy:'daytime-12h-v1',from:'2026-11-04',to:'2026-11-05',page:0}) as DailyAttendanceData;
 expect(result).toMatchObject({complete:2,missingIn:0,missingOut:0});
 expect(result.days).toMatchObject([
  {date:'2026-11-05',first:entry,last:exit,punches:2,corrected:true,unmatchedPunches:0},
  {date:'2026-11-04',first:times[0],last:times[1],punches:2,corrected:false},
 ]);
 expect((await list({from:'2026-11-04',to:'2026-11-06'})).punches.map(p=>p.localTime)).toContain(ignored);
});
it('lets a manager classify review punches, preserving the other manual time and raw history',async()=>{
 const entry='2026-11-02T16:30:00',checkout='2026-11-03T00:00:00';
 await ingestAttendance(db,'grills',token,batch({punches:[
  {badge:'101',localTime:entry,verifyMode:1,inOutMode:0,workCode:0},
  {badge:'101',localTime:checkout,verifyMode:1,inOutMode:1,workCode:0},
 ]}));
 const daily=async()=>(await postHr(db,access,{...baseWithoutId(),type:'attendance.daily',policy:'daytime-12h-v1',from:'2026-11-02',to:'2026-11-02',page:0}) as DailyAttendanceData).days[0];
 const row=await daily();
 const entryKey=row.reviewPunches?.find(p=>p.localTime===entry)?.eventKey;
 const exitKey=row.reviewPunches?.find(p=>p.localTime===checkout)?.eventKey;
 expect(entryKey).toBeTruthy();
 expect(exitKey).toBeTruthy();
 const command={...base(),type:'attendance.classify',deviceId,badge:'101',date:'2026-11-02',eventKey:exitKey,direction:'exit',expectedRevision:0};
 await expect(postHr(db,{...access,role:'operator'},command)).rejects.toMatchObject({code:'FORBIDDEN'});
 await expect(postHr(db,access,{...command,date:'2026-11-03'})).rejects.toMatchObject({code:'PUNCH_NOT_FOUND'});
 await expect(postHr(db,access,{...command,direction:'entry'})).rejects.toMatchObject({code:'INVALID_ENTRY_DATE'});
 const result=await postHr(db,access,command);
 expect(await postHr(db,access,command)).toEqual(result);
 expect(await daily()).toMatchObject({first:null,last:checkout,corrected:true,correctionRevision:1,unmatchedPunches:1});
 const enter={...command,operationId:randomUUID(),eventKey:entryKey,direction:'entry'};
 await expect(postHr(db,access,enter)).rejects.toMatchObject({code:'STALE_REVISION'});
 await postHr(db,access,{...enter,expectedRevision:1});
 expect(await daily()).toMatchObject({first:entry,last:checkout,correctionRevision:2,reviewPunches:[]});
 expect((await list({to:'2026-11-03'})).punches.map(p=>p.localTime)).toEqual([checkout,entry]);
});
it('aggregates all raw pages before daily pagination and preserves filters, totals and access checks',async()=>{
 const punches=Array.from({length:130},(_,i)=>({badge:'101',localTime:'2026-11-01T08:'+String(Math.floor(i/60)).padStart(2,'0')+':'+String(i%60).padStart(2,'0'),verifyMode:1,inOutMode:0,workCode:0}));await ingestAttendance(db,'grills',token,batch({punches}));
 const others=Array.from({length:105},(_,i)=>({badge:String(200+i),name:'Employee '+i}));await ingestAttendance(db,'grills',token,batch({users:others,punches:others.map(e=>({badge:e.badge,localTime:'2026-11-01T09:00:00',verifyMode:1,inOutMode:0,workCode:0}))}));
 const query={...baseWithoutId(),type:'attendance.daily',policy:'daytime-12h-v1',from:'2026-11-01',to:'2026-11-01',page:0},result=await postHr(db,access,query) as DailyAttendanceData;expect(result).toMatchObject({total:106,complete:0,missingOut:106,missingIn:0});expect(result.days).toHaveLength(100);expect(result.days[0]).toMatchObject({badge:'101',first:'2026-11-01T08:00:00',last:null,punches:130,unmatchedPunches:0});expect((await postHr(db,access,{...query,page:1}) as DailyAttendanceData).days).toHaveLength(6);expect((await postHr(db,access,{...query,badge:'101'}) as DailyAttendanceData).total).toBe(1);expect((await postHr(db,access,{...query,deviceId:randomUUID()}) as DailyAttendanceData).total).toBe(0);
 await expect(postHr(db,{...access,role:'operator'},query)).rejects.toMatchObject({code:'FORBIDDEN'});await expect(postHr(db,access,{...query,organizationId:'bistro'})).rejects.toMatchObject({code:'FORBIDDEN'});await expect(postHr(db,access,{...query,generation:randomUUID()})).rejects.toMatchObject({code:'STALE_GENERATION'});
});
it('orders employee codes numerically and keeps attendance matched to the same device code',async()=>{
 await ingestAttendance(db,'grills',token,batch({users:[{badge:'165',name:'A'},{badge:'102',name:'B'},{badge:'101',name:'Z'},{badge:'1000',name:'C'}]}));
 const result=await list();expect(result.employees.map(e=>e.badge)).toEqual(['101','102','165','1000']);
 expect(result.punches[0].employeeId).toBe(result.employees[0].employeeId);
});
it('persists custom job options, replays uncertain requests and rejects duplicate or cross-tenant writes',async()=>{
 const job={jobId:randomUUID(),name:'  شيف جديد  '},command={...base(),type:'job.create',job};
 expect(await postHr(db,access,command)).toMatchObject({outcome:'accepted'});expect(await postHr(db,access,command)).toMatchObject({outcome:'accepted'});
 expect((await list()).jobs).toEqual([{jobId:job.jobId,name:'شيف جديد'}]);
 await expect(postHr(db,access,{...base(),type:'job.create',job:{jobId:randomUUID(),name:'شيف جديد'}})).rejects.toMatchObject({code:'DUPLICATE_JOB'});
 await expect(postHr(db,access,{...base(),organizationId:'bistro',type:'job.create',job:{jobId:randomUUID(),name:'وظيفة أخرى'}})).rejects.toMatchObject({code:'FORBIDDEN'});
 await expect(postHr(db,{...access,role:'operator'},{...base(),type:'job.create',job})).rejects.toMatchObject({code:'FORBIDDEN'});
 await expect(postHr(db,access,{...base(),type:'job.create',job:{...job,name:'  '}})).rejects.toMatchObject({code:'INVALID_COMMAND'});
});
it('retains job titles saved by legacy profile clients in the shared dropdown',async()=>{
 await ingestAttendance(db,'grills',token,batch());const {revision,deviceName,...employee}=(await list()).employees[0];
 await postHr(db,access,{...base(),type:'employee.save',expectedRevision:revision,employee:{...employee,jobTitle:'محاسب'}});
 const result=await list();expect(result.jobs.map(j=>j.name)).toContain('محاسب');expect(result.employees[0].jobTitle).toBe('محاسب');
});
it('saves EGP salary details with revision checks and no stock or finance entries',async()=>{
 await ingestAttendance(db,'grills',token,batch());const e=(await list()).employees[0];
 const salary={employeeId:e.employeeId,basePay:'5000',allowances:'500.25',fixedDeductions:'100',currency:'EGP',effectiveFrom:'2026-11-01',notes:'شهري'};
 const command={...base(),type:'salary.save',salary,expectedRevision:0};
 await postHr(db,access,command);await postHr(db,access,command);
 expect((await list()).salaries).toEqual([{...salary,revision:1}]);
 await expect(postHr(db,access,{...command,operationId:randomUUID()})).rejects.toMatchObject({code:'STALE_REVISION'});
 await postHr(db,access,{...command,operationId:randomUUID(),expectedRevision:1,salary:{...salary,basePay:'6000'}});
 expect((await list()).salaries[0]).toMatchObject({basePay:'6000',revision:2});
 for(const basePay of ['-1','1.001','NaN'])await expect(postHr(db,access,{...base(),type:'salary.save',salary:{...salary,basePay},expectedRevision:2})).rejects.toMatchObject({code:'INVALID_COMMAND'});
 expect((await db.query('SELECT * FROM finance_entries')).rows).toHaveLength(0);
});
it('tracks partial advance repayments exactly, deduplicates retries and rejects overpayment and foreign employees',async()=>{
 await ingestAttendance(db,'grills',token,batch());const employeeId=(await list()).employees[0].employeeId;
 const advance={advanceId:randomUUID(),employeeId,amount:'1000.30',issuedOn:'2026-11-01',reference:'ADV-1',notes:''};
 const issue={...base(),type:'advance.issue',advance};await postHr(db,access,issue);await postHr(db,access,issue);
 const repayment={repaymentId:randomUUID(),advanceId:advance.advanceId,amount:'400.10',paidOn:'2026-11-02',notes:'سداد جزئي'},pay={...base(),type:'advance.repay',repayment};
 await postHr(db,access,pay);await postHr(db,access,pay);expect((await list()).advanceRepayments).toEqual([repayment]);
 await expect(postHr(db,access,{...base(),type:'advance.repay',repayment:{...repayment,repaymentId:randomUUID(),amount:'600.21'}})).rejects.toMatchObject({code:'EXCESS_REPAYMENT'});
 await expect(postHr(db,access,{...base(),type:'advance.repay',repayment:{...repayment,repaymentId:randomUUID(),paidOn:'2026-10-31'}})).rejects.toMatchObject({code:'INVALID_DATE'});
 await postHr(db,access,{...base(),type:'advance.repay',repayment:{...repayment,repaymentId:randomUUID(),amount:'600.20'}});
 await expect(postHr(db,access,{...base(),type:'advance.repay',repayment:{...repayment,repaymentId:randomUUID(),amount:'0.01'}})).rejects.toMatchObject({code:'EXCESS_REPAYMENT'});
 expect((await list()).advances).toHaveLength(1);expect((await list()).advanceRepayments).toHaveLength(2);
 await expect(postHr(db,access,{...base(),type:'advance.issue',advance:{...advance,advanceId:randomUUID(),employeeId:randomUUID()}})).rejects.toMatchObject({code:'INVALID_EMPLOYEE'});
 await expect(postHr(db,{...access,organizationId:'bistro'},{...base(),organizationId:'bistro',type:'advance.repay',repayment})).rejects.toMatchObject({code:'STALE_GENERATION'});
});
it('imports the device roster and raw local-time punches without biometrics',async()=>{
 const b=batch();expect(await ingestAttendance(db,'grills',token,b)).toMatchObject({outcome:'accepted',inserted:1,batchId:b.batchId});const result=await list();expect(result.employees[0]).toMatchObject({badge:'101',name:'Device name',revision:1});expect(result.punches[0]).toMatchObject({badge:'101',localTime:'2026-11-02T08:00:00',name:'Device name'});expect(result.total).toBe(1);
 expect((await db.query<{token_hash:string}>('SELECT token_hash FROM hr_devices')).rows[0].token_hash).toBe(hrTokenHash(token));expect(JSON.stringify((await list()).devices)).not.toContain(token);
});
it('records a healthy empty scan without manufacturing punches or upload receipts',async()=>{expect(await ingestAttendance(db,'grills',token,batch({users:[],punches:[]}))).toMatchObject({outcome:'accepted',received:0,inserted:0});const data=await list();expect(data.devices[0].lastSeenAt).toBeTruthy();expect(data.total).toBe(0);expect((await db.query('SELECT * FROM hr_upload_receipts')).rows).toHaveLength(0);});
it('replays identical batches and deduplicates punches across new batches',async()=>{const b=batch(),first=await ingestAttendance(db,'grills',token,b);expect(await ingestAttendance(db,'grills',token,b)).toEqual(first);expect(await ingestAttendance(db,'grills',token,batch())).toMatchObject({inserted:0});expect((await list()).total).toBe(1);await expect(ingestAttendance(db,'grills',token,{...b,users:[]})).rejects.toMatchObject({code:'PAYLOAD_CONFLICT'});});
it('keeps edited profile information when the device name changes',async()=>{await ingestAttendance(db,'grills',token,batch());const e=(await list()).employees[0];const {revision,deviceName,...employee}=e;await postHr(db,access,{...base(),type:'employee.save',expectedRevision:revision,employee:{...employee,name:'الاسم العربي',department:'المطبخ',hireDate:'2026-11-01'}});await ingestAttendance(db,'grills',token,batch({users:[{badge:'101',name:'Changed device name'}]}));expect((await list()).employees[0]).toMatchObject({name:'الاسم العربي',department:'المطبخ',deviceName:'Changed device name',revision:2});});
it('rejects stale profile writes, duplicate badges and reassignment of immutable bindings',async()=>{await ingestAttendance(db,'grills',token,batch());const {revision,deviceName,...employee}=(await list()).employees[0];const c={...base(),type:'employee.save',expectedRevision:revision,employee:{...employee,phone:'01234567890'}};expect(await postHr(db,access,c)).toMatchObject({outcome:'accepted'});expect(await postHr(db,access,c)).toMatchObject({outcome:'accepted'});await expect(postHr(db,access,{...c,operationId:randomUUID()})).rejects.toMatchObject({code:'STALE_REVISION'});await expect(postHr(db,access,{...c,operationId:randomUUID(),expectedRevision:0,employee:{...employee,employeeId:randomUUID()}})).rejects.toMatchObject({code:'DUPLICATE_BADGE'});await expect(postHr(db,access,{...c,operationId:randomUUID(),expectedRevision:2,employee:{...employee,badge:'102'}})).rejects.toMatchObject({code:'STALE_REVISION'});});
it('revokes credentials and rotates on the same device without losing profile links',async()=>{await ingestAttendance(db,'grills',token,batch());const id=(await list()).employees[0].employeeId;await postHr(db,access,{...base(),type:'device.revoke',deviceId,expectedRevision:1});await expect(ingestAttendance(db,'grills',token,batch())).rejects.toMatchObject({code:'AUTH_REQUIRED'});const r=await postHr(db,access,{...base(),type:'device.rotate',deviceId,expectedRevision:2}) as {token:string};await expect(ingestAttendance(db,'grills',token,batch())).rejects.toMatchObject({code:'AUTH_REQUIRED'});await ingestAttendance(db,'grills',r.token,batch());expect((await list()).employees[0].employeeId).toBe(id);});
it('never returns a pairing secret again from stored receipts',async()=>{const c={...base(),type:'device.rotate',deviceId,expectedRevision:1};const first=await postHr(db,access,c);expect(first).toHaveProperty('token');expect(await postHr(db,access,c)).not.toHaveProperty('token');expect(JSON.stringify((await db.query('SELECT result FROM command_receipts')).rows)).not.toContain('fodo_hr_');});
it('keeps unknown badges visible and links late roster imports',async()=>{await ingestAttendance(db,'grills',token,batch({users:[]}));expect((await list()).punches[0].employeeId).toBeNull();await ingestAttendance(db,'grills',token,batch({punches:[]}));expect((await list()).punches[0].employeeId).toBeTruthy();});
it('rejects other organizations, other devices, expired sessions and unauthorized roles',async()=>{for(const role of ['operator','viewer',undefined] as const)await expect(postHr(db,{...access,role},{...baseWithoutId(),type:'hr.list',from:'2026-11-01',to:'2026-11-02',page:0})).rejects.toMatchObject({code:'FORBIDDEN'});await expect(postHr(db,{...access,expiresAt:'2000-01-01'},{})).rejects.toMatchObject({code:'AUTH_REQUIRED'});await expect(ingestAttendance(db,'bistro',token,batch())).rejects.toMatchObject({code:'AUTH_REQUIRED'});await expect(ingestAttendance(db,'grills',token,batch({deviceId:randomUUID()}))).rejects.toMatchObject({code:'AUTH_REQUIRED'});await expect(list({organizationId:'bistro'})).rejects.toMatchObject({code:'FORBIDDEN'});await expect(list({generation:randomUUID()})).rejects.toMatchObject({code:'STALE_GENERATION'});});
it('validates dates, batch limits and unexpected biometric fields before writing',async()=>{await expect(ingestAttendance(db,'grills',token,{...batch(),templates:['secret']})).rejects.toMatchObject({code:'INVALID_UPLOAD'});const p=batch().punches[0];for(const localTime of ['2026-02-30T08:00:00','2026-11-02T25:00:00','2026-11-02T08:00:00Z'])await expect(ingestAttendance(db,'grills',token,batch({punches:[{...p,localTime}]}))).rejects.toMatchObject({code:'INVALID_UPLOAD'});await expect(ingestAttendance(db,'grills',token,batch({punches:Array(201).fill(p)}))).rejects.toMatchObject({code:'INVALID_UPLOAD'});expect((await list()).total).toBe(0);});
it('includes the entire end date, filters by badge and paginates in stable order',async()=>{const punches=Array.from({length:102},(_,i)=>({badge:'101',localTime:`2026-11-02T08:${String(Math.floor(i/60)).padStart(2,'0')}:${String(i%60).padStart(2,'0')}`,verifyMode:1,inOutMode:0,workCode:0}));await ingestAttendance(db,'grills',token,batch({punches}));expect((await list({from:'2026-11-02'})).punches).toHaveLength(100);expect((await list({page:1})).punches).toHaveLength(2);expect((await list({badge:'102'})).total).toBe(0);expect((await list({to:'2026-11-01'})).total).toBe(0);await expect(list({from:'2026-11-03'})).rejects.toMatchObject({code:'INVALID_COMMAND'});});
it('records and audits a dated employee deduction once, independently of salary and advances',async()=>{
 await ingestAttendance(db,'grills',token,batch());
 const {employeeId}=(await list()).employees[0];
 const deduction={employeeId,deductionId:randomUUID(),amount:'25.75',deductedOn:'2026-11-02',reason:'سبب الخصم'};
 const command={...base(),type:'deduction.record',deduction};
 await expect(postHr(db,access,command)).resolves.toMatchObject({outcome:'accepted'});
 await expect(postHr(db,access,command)).resolves.toMatchObject({outcome:'accepted'});
 expect(await list()).toMatchObject({deductions:[deduction],salaries:[],advances:[],advanceRepayments:[]});
 expect((await db.query('SELECT actor,action FROM audit_events WHERE operation_id=$1',[command.operationId])).rows).toEqual([{actor:access.userId,action:'deduction.record'}]);
 await expect(postHr(db,access,{...command,...base()})).rejects.toMatchObject({code:'DUPLICATE_DEDUCTION'});
 await expect(postHr(db,{...access,role:'operator'},{...command,...base()})).rejects.toMatchObject({code:'FORBIDDEN'});
 const save=(change:Partial<typeof deduction>)=>postHr(db,access,{...command,...base(),deduction:{...deduction,deductionId:randomUUID(),...change}});
 await expect(save({amount:'0'})).rejects.toMatchObject({code:'INVALID_COMMAND'});
 await expect(save({amount:'25.751'})).rejects.toMatchObject({code:'INVALID_COMMAND'});
 await expect(save({reason:'  '})).rejects.toMatchObject({code:'INVALID_COMMAND'});
 await expect(save({deductedOn:'2099-11-02'})).rejects.toMatchObject({code:'INVALID_DATE'});
 await expect(save({employeeId:randomUUID()})).rejects.toMatchObject({code:'INVALID_EMPLOYEE'});
 expect((await list()).deductions).toEqual([deduction]);
});
it('applies the actual additive migration and enforces tenant RLS and append-only punches',async()=>{
 await ingestAttendance(db,'grills',token,batch());
 const employeeId=(await list()).employees[0].employeeId;await db.query("UPDATE hr_employees SET job_title='محاسب' WHERE employee_id=$1",[employeeId]);
 await postHr(db,access,{...base(),type:'salary.save',expectedRevision:0,salary:{employeeId,basePay:'5000',allowances:'0',fixedDeductions:'0',currency:'EGP',effectiveFrom:'2026-11-01',notes:''}});
 const advanceId=randomUUID();await postHr(db,access,{...base(),type:'advance.issue',advance:{advanceId,employeeId,amount:'1000',issuedOn:'2026-11-01',reference:'',notes:''}});
 await postHr(db,access,{...base(),type:'advance.repay',repayment:{repaymentId:randomUUID(),advanceId,amount:'100',paidOn:'2026-11-02',notes:''}});
 await postHr(db,access,{...base(),type:'deduction.record',deduction:{deductionId:randomUUID(),employeeId,amount:'25.75',deductedOn:'2026-11-02',reason:'سبب الخصم'}});
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE fodo_api; GRANT USAGE ON SCHEMA public TO fodo_api;');
 const migration=(await readFile('supabase/migrations/20261102172224_hr_employees_attendance.sql','utf8')).replace('SET LOCAL search_path=fodo,pg_catalog;','');await db.exec(migration);
 const profileMigration=(await readFile('supabase/migrations/20261102191916_hr_profiles_salary_advances.sql','utf8')).replace('SET LOCAL search_path=fodo,pg_catalog;','');await db.exec(profileMigration);
 const deductionMigration=(await readFile('supabase/migrations/20261106190000_hr_employee_deductions.sql','utf8')).replace('SET LOCAL search_path=fodo,pg_catalog;','');await db.exec(deductionMigration);
 for(const table of ['hr_job_titles','hr_salaries','hr_advances','hr_advance_repayments','hr_employee_deductions']){
  await db.transaction(async tx=>{await tx.query("SELECT set_config('fodo.tenant','bistro',true)");await tx.query('SET LOCAL ROLE fodo_api');expect((await tx.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);});
  await db.transaction(async tx=>{await tx.query("SELECT set_config('fodo.tenant','grills',true)");await tx.query('SET LOCAL ROLE fodo_api');expect((await tx.query(`SELECT * FROM ${table}`)).rows).toHaveLength(1);});
  await expect(db.transaction(async tx=>{await tx.query('SET LOCAL ROLE authenticated');return tx.query(`SELECT * FROM ${table}`);})).rejects.toThrow(/permission denied/i);
 }
 for(const table of ['hr_advances','hr_advance_repayments'])for(const sql of [`DELETE FROM ${table}`,`UPDATE ${table} SET state='{}'::jsonb`])await expect(db.transaction(async tx=>{await tx.query("SELECT set_config('fodo.tenant','grills',true)");await tx.query('SET LOCAL ROLE fodo_api');return tx.query(sql);})).rejects.toThrow(/permission denied/i);
 await expect(db.transaction(async tx=>{await tx.query("SELECT set_config('fodo.tenant','grills',true)");await tx.query('SET LOCAL ROLE fodo_api');return tx.query('UPDATE hr_employee_deductions SET amount=100');})).rejects.toThrow(/permission denied/i);
 await db.transaction(async tx=>{await tx.query("SELECT set_config('fodo.tenant','bistro',true)");await tx.query('SET LOCAL ROLE fodo_api');expect((await tx.query('SELECT * FROM hr_employees')).rows).toHaveLength(0);expect((await tx.query('SELECT * FROM hr_punches')).rows).toHaveLength(0);});
 await db.transaction(async tx=>{await tx.query("SELECT set_config('fodo.tenant','grills',true)");await tx.query('SET LOCAL ROLE fodo_api');expect((await tx.query('SELECT * FROM hr_employees')).rows).toHaveLength(1);expect((await tx.query('SELECT * FROM hr_punches')).rows).toHaveLength(1);});
 await expect(db.transaction(async tx=>{await tx.query('SET LOCAL ROLE authenticated');return tx.query('SELECT * FROM hr_employees');})).rejects.toThrow(/permission denied/i);
 await expect(db.transaction(async tx=>{await tx.query("SELECT set_config('fodo.tenant','grills',true)");await tx.query('SET LOCAL ROLE fodo_api');return tx.query('DELETE FROM hr_punches');})).rejects.toThrow(/permission denied/i);
 await expect(db.transaction(async tx=>{await tx.query("SELECT set_config('fodo.tenant','grills',true)");await tx.query('SET LOCAL ROLE fodo_api');return tx.query("UPDATE hr_punches SET badge='999'");})).rejects.toThrow(/permission denied/i);
});
