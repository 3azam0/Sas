import {expect,it} from 'vitest';
import {salaryAdjustments,salaryAmounts,salaryPeriods} from '../packages/domain/hr-salary';

it('sets consecutive cutoffs, caps the pay month at day 30 and rolls the closing payday into the next month',()=>{
 expect(salaryPeriods('2026-12')).toEqual([
  {from:'2026-12-01',to:'2026-12-14',payOn:'2026-12-15'},
  {from:'2026-12-15',to:'2026-12-24',payOn:'2026-12-25'},
  {from:'2026-12-25',to:'2026-12-30',payOn:'2027-01-05'},
 ]);
 expect(salaryPeriods('2026-02')[2].to).toBe('2026-02-28');
 expect(salaryPeriods('2028-02')[2].to).toBe('2028-02-29');
});

it('takes month deductions and the advance balance as of closing',()=>{
 const advance=(advanceId:string,employeeId:string,issuedOn:string,amount:string)=>({advanceId,employeeId,issuedOn,amount,reference:'',notes:''});
 const deduction=(deductionId:string,employeeId:string,deductedOn:string,amount:string)=>({deductionId,employeeId,deductedOn,amount,reason:'test'});
 const data={
  advances:[advance('a','e','2026-10-15','125.75'),advance('b','e','2026-12-01','500'),advance('c','other','2026-11-15','300')],
  advanceRepayments:[{repaymentId:'r1',advanceId:'a',paidOn:'2026-11-06',amount:'25.25',notes:''},{repaymentId:'r2',advanceId:'a',paidOn:'2026-12-03',amount:'50',notes:''}],
  deductions:[deduction('1','e','2026-10-15','30'),deduction('2','e','2026-11-06','25.75'),deduction('3','other','2026-11-06','100')],
 };
 expect(salaryAdjustments(data,'e','2026-11','2026-12-05')).toEqual({advances:'100.50',deductions:'25.75'});
 expect(salaryAdjustments(data,'e','2026-11','2026-11-05')).toEqual({advances:'125.75',deductions:'0.00'});
});

it('retains rounding cents for closing and deducts only from the final installment',()=>{
 expect(salaryAmounts('5000',[2,2,2],{deductions:'25.75',advances:'100.50'})).toEqual({
  daily:'166.67',gross:'1000.00',closing:'466.66',payments:['266.67','266.67','340.41'],outstanding:'0.00',
 });
 expect(salaryAmounts('3000',[10,8,2],{deductions:'125',advances:'500'})).toMatchObject({
  payments:['800.00','640.00','0.00'],outstanding:'65.00',
 });
});
