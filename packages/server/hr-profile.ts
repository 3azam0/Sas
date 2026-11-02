import {BusinessError} from '@saas/contracts';
import {decimal} from '@saas/domain';
import type {QueryDatabase} from './database';
import {hrRequestSchema} from '../contracts/hr';
import type {z} from 'zod';
import type {Advance} from '../contracts/hr-profile';
type Command=Extract<z.infer<typeof hrRequestSchema>,{type:'salary.save'|'advance.issue'|'advance.repay'}>;
function fail(code:string,message:string):never{throw new BusinessError(code,message,409);}
export async function saveEmployeeDetails(tx:QueryDatabase,c:Command){
 const org=c.organizationId;
 if(c.type==='advance.repay'){
  const p=c.repayment,row=(await tx.query<{state:Advance}>('SELECT state FROM hr_advances WHERE organization_id=$1 AND advance_id=$2 FOR UPDATE',[org,p.advanceId])).rows[0];
  if(!row)fail('INVALID_ADVANCE','السلفة غير موجودة.');
  if(p.paidOn<row.state.issuedOn)fail('INVALID_DATE','تاريخ السداد يجب ألا يسبق تاريخ السلفة.');
  const paid=(await tx.query<{amount:string}>("SELECT coalesce(sum((state->>'amount')::numeric),0)::text AS amount FROM hr_advance_repayments WHERE organization_id=$1 AND advance_id=$2",[org,p.advanceId])).rows[0].amount;
  if(decimal(paid).plus(p.amount).gt(row.state.amount))fail('EXCESS_REPAYMENT','قيمة السداد أكبر من المتبقي من السلفة.');
  if((await tx.query('SELECT 1 FROM hr_advance_repayments WHERE organization_id=$1 AND repayment_id=$2',[org,p.repaymentId])).rows.length)fail('DUPLICATE_REPAYMENT','السداد مسجل بالفعل.');
  await tx.query('INSERT INTO hr_advance_repayments(organization_id,repayment_id,advance_id,state) VALUES($1,$2,$3,$4)',[org,p.repaymentId,p.advanceId,JSON.stringify(p)]);return;
 }
 const employeeId=c.type==='salary.save'?c.salary.employeeId:c.advance.employeeId;
 if(!(await tx.query('SELECT 1 FROM hr_employees WHERE organization_id=$1 AND employee_id=$2',[org,employeeId])).rows.length)fail('INVALID_EMPLOYEE','احفظ ملف الموظف أولاً.');
 if(c.type==='advance.issue'){
  if((await tx.query('SELECT 1 FROM hr_advances WHERE organization_id=$1 AND advance_id=$2',[org,c.advance.advanceId])).rows.length)fail('DUPLICATE_ADVANCE','السلفة مسجلة بالفعل.');
  await tx.query('INSERT INTO hr_advances(organization_id,advance_id,employee_id,state) VALUES($1,$2,$3,$4)',[org,c.advance.advanceId,employeeId,JSON.stringify(c.advance)]);return;
 }
 if(c.expectedRevision===0){
  if((await tx.query('SELECT 1 FROM hr_salaries WHERE organization_id=$1 AND employee_id=$2',[org,employeeId])).rows.length)fail('STALE_REVISION','تغيرت بيانات الراتب؛ حدث الملف.');
  await tx.query('INSERT INTO hr_salaries(organization_id,employee_id,state) VALUES($1,$2,$3)',[org,employeeId,JSON.stringify(c.salary)]);
 }else if(!(await tx.query('UPDATE hr_salaries SET state=$3,revision=revision+1 WHERE organization_id=$1 AND employee_id=$2 AND revision=$4 RETURNING employee_id',[org,employeeId,JSON.stringify(c.salary),c.expectedRevision])).rows.length)fail('STALE_REVISION','تغيرت بيانات الراتب؛ حدث الملف.');
}
