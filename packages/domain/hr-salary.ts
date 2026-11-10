import {decimal} from './index';
import type {HrData} from '../contracts/hr';

export function salaryPeriods(month:string){
 const monthNumber=Number(month.slice(5,7));
 const next=new Date(`${month}-01T00:00:00Z`);
 next.setUTCMonth(monthNumber);
 const nextMonth=next.toISOString().slice(0,7);
 const lastDay=new Date(next.getTime()-86400000).getUTCDate();
 const end=month+'-'+Math.min(30,lastDay);
 return [
  {from:month+'-01',to:month+'-14',payOn:month+'-15'},
  {from:month+'-15',to:month+'-24',payOn:month+'-25'},
  {from:month+'-25',to:end,payOn:nextMonth+'-05'},
 ] as const;
}

export function salaryAmounts(monthlySalary:string,workedDays:readonly [number,number,number],adjustments:{deductions:string;advances:string}){
 const daily=decimal(monthlySalary).div(30);
 const first=daily.mul(workedDays[0]).mul('0.8').toDecimalPlaces(2,4);
 const second=daily.mul(workedDays[1]).mul('0.8').toDecimalPlaces(2,4);
 const gross=daily.mul(workedDays[0]+workedDays[1]+workedDays[2]).toDecimalPlaces(2,4);
 const closing=gross.minus(first).minus(second);
 const net=closing.minus(adjustments.deductions).minus(adjustments.advances);
 return {
  daily:daily.toFixed(2),gross:gross.toFixed(2),closing:closing.toFixed(2),
  payments:[first.toFixed(2),second.toFixed(2),net.gt(0)?net.toFixed(2):'0.00'] as const,
  outstanding:net.lt(0)?net.negated().toFixed(2):'0.00',
 };
}

export function salaryAdjustments(data:Pick<HrData,'deductions'|'advances'|'advanceRepayments'>,employeeId:string,month:string,today:string){
 const cutoff=month===today.slice(0,7)?today:month+'-31';
 const deductions=data.deductions.filter(row=>row.employeeId===employeeId&&row.deductedOn.startsWith(month+'-')&&row.deductedOn<=cutoff)
  .reduce((sum,row)=>sum.plus(row.amount),decimal('0'));
 const repayments=new Map<string,ReturnType<typeof decimal>>();
 for(const row of data.advanceRepayments){
  if(row.paidOn<=cutoff)repayments.set(row.advanceId,(repayments.get(row.advanceId)??decimal('0')).plus(row.amount));
 }
 const advances=data.advances.filter(row=>row.employeeId===employeeId&&row.issuedOn<=cutoff)
  .reduce((sum,row)=>sum.plus(decimal(row.amount).minus(repayments.get(row.advanceId)??0)),decimal('0'));
 return {deductions:deductions.toFixed(2),advances:advances.toFixed(2)};
}
