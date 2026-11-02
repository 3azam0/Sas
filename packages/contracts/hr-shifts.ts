import {z} from 'zod';
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
const clock=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const shiftSchema=z.object({shiftId:z.uuid(),name:z.string().trim().min(1).max(100),start:clock,end:clock,breakMinutes:z.number().int().min(0).max(240),graceMinutes:z.number().int().min(0).max(120),earlyWindow:z.number().int().min(0).max(360),lateWindow:z.number().int().min(0).max(360),effectiveFrom:day}).strict().refine(s=>{const m=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3));const duration=(m(s.end)-m(s.start)+1440)%1440;return duration>0&&duration<=960&&s.breakMinutes<duration;},'Shift must be 1–960 minutes, with a shorter break.');
export type Shift=z.infer<typeof shiftSchema>;
const scope={organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),generation:z.uuid()};
export const shiftRequests=[
 z.object({...scope,type:z.literal('attendance.summary'),from:day,to:day}).strict(),
 z.object({...scope,type:z.literal('shift.create'),operationId:z.uuid(),shift:shiftSchema}).strict(),
 z.object({...scope,type:z.literal('roster.save'),operationId:z.uuid(),employeeId:z.uuid(),date:day,kind:z.enum(['work','off','leave','auto']),shiftId:z.uuid().nullable(),expectedRevision:z.number().int().min(0),reason:z.string().trim().min(1).max(300)}).strict()
] as const;
export type ShiftRequest=z.infer<typeof shiftRequests[number]>;
export type RosterDay={employeeId:string;date:string;kind:'work'|'off'|'leave'|'auto';shiftId:string|null;revision:number;reason:string};
export type DailyAttendance={employeeId:string;name:string;date:string;shiftId:string|null;shiftName:string;source:'assigned'|'detected'|'none';status:string;first:string|null;last:string|null;lateMinutes:number|null;earlyMinutes:number|null;workedMinutes:number|null;overtimeMinutes:number|null;reason:string;revision:number};
export type ShiftData={shifts:Shift[];roster:RosterDay[];history?:{state:RosterDay;actor:string;postedAt:string}[];days:DailyAttendance[];daysOff:{employeeId:string;name:string;month:string;scheduled:number;taken:number;remaining:number}[]};
