import {z} from 'zod';
const text=(n:number)=>z.string().trim().max(n);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
const money=z.string().regex(/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/);
const currency=z.literal('EGP');
export const salarySchema=z.object({employeeId:z.uuid(),basePay:money,allowances:money,fixedDeductions:money,currency,effectiveFrom:date,notes:text(1000)}).strict();
export type Salary=z.infer<typeof salarySchema>&{revision:number};
const positiveMoney=money.refine(v=>Number(v)>0);
export const advanceSchema=z.object({advanceId:z.uuid(),employeeId:z.uuid(),amount:positiveMoney,issuedOn:date,reference:text(100),notes:text(1000)}).strict();
export type Advance=z.infer<typeof advanceSchema>;
export const repaymentSchema=z.object({repaymentId:z.uuid(),advanceId:z.uuid(),amount:positiveMoney,paidOn:date,notes:text(1000)}).strict();
export type AdvanceRepayment=z.infer<typeof repaymentSchema>;
export const deductionSchema=z.object({
 deductionId:z.uuid(),
 employeeId:z.uuid(),
 amount:positiveMoney,
 deductedOn:date,
 reason:text(500).min(2),
}).strict();
export type EmployeeDeduction=z.infer<typeof deductionSchema>;
export function profileRequests(scope:{organizationId:z.ZodString;generation:z.ZodUUID;operationId:z.ZodUUID}){return [
 z.object({...scope,type:z.literal('salary.save'),salary:salarySchema,expectedRevision:z.number().int().min(0)}).strict(),
 z.object({...scope,type:z.literal('advance.issue'),advance:advanceSchema}).strict(),
 z.object({...scope,type:z.literal('advance.repay'),repayment:repaymentSchema}).strict(),
 z.object({...scope,type:z.literal('deduction.record'),deduction:deductionSchema}).strict()
] as const;}
