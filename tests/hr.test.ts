import {afterEach,beforeEach,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createDatabase,seed} from '../packages/server';
import {postHr,ingestAttendance,hrTokenHash} from '../packages/server/hr';
import type {Access} from '../packages/contracts';
import type {AttendanceUpload,HrData} from '../packages/contracts/hr';
let db:Awaited<ReturnType<typeof createDatabase>>,generation:string,deviceId:string,token:string;
const access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),role:'owner',expiresAt:'2099-01-01T00:00:00Z'};
const base=()=>({organizationId:'grills',generation,operationId:randomUUID()});
const list=async(extra={})=>await postHr(db,access,{...baseWithoutId(),type:'hr.list',from:'2026-11-01',to:'2026-11-02',page:0,...extra}) as HrData;
const baseWithoutId=()=>({organizationId:'grills',generation});
const batch=(extra:Partial<AttendanceUpload>={}):AttendanceUpload=>({schemaVersion:1,batchId:randomUUID(),deviceId,users:[{badge:'101',name:'Device name'}],punches:[{badge:'101',localTime:'2026-11-02T08:00:00',verifyMode:1,inOutMode:0,workCode:0}],...extra});
beforeEach(async()=>{db=await createDatabase();await seed(db,'moving_average',false);generation=(await db.query<{g:string}>("SELECT generation::text AS g FROM organizations WHERE id='grills'")).rows[0].g;deviceId=randomUUID();const r=await postHr(db,access,{...base(),type:'device.create',deviceId,name:'K14'}) as {token:string};token=r.token;});
afterEach(async()=>{await db.close();});
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
it('applies the actual additive migration and enforces tenant RLS and append-only punches',async()=>{
 await ingestAttendance(db,'grills',token,batch());
 const employeeId=(await list()).employees[0].employeeId;await db.query("UPDATE hr_employees SET job_title='محاسب' WHERE employee_id=$1",[employeeId]);
 await postHr(db,access,{...base(),type:'salary.save',expectedRevision:0,salary:{employeeId,basePay:'5000',allowances:'0',fixedDeductions:'0',currency:'EGP',effectiveFrom:'2026-11-01',notes:''}});
 const advanceId=randomUUID();await postHr(db,access,{...base(),type:'advance.issue',advance:{advanceId,employeeId,amount:'1000',issuedOn:'2026-11-01',reference:'',notes:''}});
 await postHr(db,access,{...base(),type:'advance.repay',repayment:{repaymentId:randomUUID(),advanceId,amount:'100',paidOn:'2026-11-02',notes:''}});
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE fodo_api; GRANT USAGE ON SCHEMA public TO fodo_api;');
 const migration=(await readFile('supabase/migrations/20261102172224_hr_employees_attendance.sql','utf8')).replace('SET LOCAL search_path=fodo,pg_catalog;','');await db.exec(migration);
 const profileMigration=(await readFile('supabase/migrations/20261102191916_hr_profiles_salary_advances.sql','utf8')).replace('SET LOCAL search_path=fodo,pg_catalog;','');await db.exec(profileMigration);
 for(const table of ['hr_job_titles','hr_salaries','hr_advances','hr_advance_repayments']){
  await db.transaction(async tx=>{await tx.query("SELECT set_config('fodo.tenant','bistro',true)");await tx.query('SET LOCAL ROLE fodo_api');expect((await tx.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);});
  await db.transaction(async tx=>{await tx.query("SELECT set_config('fodo.tenant','grills',true)");await tx.query('SET LOCAL ROLE fodo_api');expect((await tx.query(`SELECT * FROM ${table}`)).rows).toHaveLength(1);});
  await expect(db.transaction(async tx=>{await tx.query('SET LOCAL ROLE authenticated');return tx.query(`SELECT * FROM ${table}`);})).rejects.toThrow(/permission denied/i);
 }
 for(const table of ['hr_advances','hr_advance_repayments'])for(const sql of [`DELETE FROM ${table}`,`UPDATE ${table} SET state='{}'::jsonb`])await expect(db.transaction(async tx=>{await tx.query("SELECT set_config('fodo.tenant','grills',true)");await tx.query('SET LOCAL ROLE fodo_api');return tx.query(sql);})).rejects.toThrow(/permission denied/i);
 await db.transaction(async tx=>{await tx.query("SELECT set_config('fodo.tenant','bistro',true)");await tx.query('SET LOCAL ROLE fodo_api');expect((await tx.query('SELECT * FROM hr_employees')).rows).toHaveLength(0);expect((await tx.query('SELECT * FROM hr_punches')).rows).toHaveLength(0);});
 await db.transaction(async tx=>{await tx.query("SELECT set_config('fodo.tenant','grills',true)");await tx.query('SET LOCAL ROLE fodo_api');expect((await tx.query('SELECT * FROM hr_employees')).rows).toHaveLength(1);expect((await tx.query('SELECT * FROM hr_punches')).rows).toHaveLength(1);});
 await expect(db.transaction(async tx=>{await tx.query('SET LOCAL ROLE authenticated');return tx.query('SELECT * FROM hr_employees');})).rejects.toThrow(/permission denied/i);
 await expect(db.transaction(async tx=>{await tx.query("SELECT set_config('fodo.tenant','grills',true)");await tx.query('SET LOCAL ROLE fodo_api');return tx.query('DELETE FROM hr_punches');})).rejects.toThrow(/permission denied/i);
 await expect(db.transaction(async tx=>{await tx.query("SELECT set_config('fodo.tenant','grills',true)");await tx.query('SET LOCAL ROLE fodo_api');return tx.query("UPDATE hr_punches SET badge='999'");})).rejects.toThrow(/permission denied/i);
});
