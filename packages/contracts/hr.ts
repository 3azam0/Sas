import {z} from 'zod';
import {shiftRequests} from './hr-shifts';
import {profileRequests,type Salary,type Advance,type AdvanceRepayment} from './hr-profile';

export const badgeSchema=z.string().regex(/^[A-Za-z0-9_-]{1,24}$/);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
const wallTime=z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/).refine(v=>Number.isFinite(Date.parse(v+'Z'))&&new Date(v+'Z').toISOString().slice(0,19)===v);
const field=(n:number)=>z.string().trim().max(n);
export const employeeSchema=z.object({employeeId:z.uuid(),deviceId:z.uuid(),badge:badgeSchema,name:field(160).min(1),phone:field(40),department:field(100),jobTitle:field(100),hireDate:date.nullable(),active:z.boolean(),notes:field(1000)}).strict();
export type Employee=z.infer<typeof employeeSchema>&{revision:number;deviceName:string};
export type AttendanceDevice={deviceId:string;name:string;active:boolean;lastSeenAt:string|null;revision:number};
export const jobTitleSchema=z.object({jobId:z.uuid(),name:field(100).min(1)}).strict();
export type JobTitle=z.infer<typeof jobTitleSchema>;
export type AttendancePunch={eventKey:string;deviceId:string;badge:string;localTime:string;verifyMode:number;inOutMode:number;workCode:number;receivedAt:string;employeeId:string|null;name:string|null};
export type DailyAttendanceRow={deviceId:string;deviceName:string;badge:string;employeeId:string|null;name:string|null;date:string;first:string;last:string|null;punches:number};
export type DailyAttendanceData={days:DailyAttendanceRow[];total:number;complete:number;missingOut:number};
const scope={organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),generation:z.uuid()};
const write={...scope,operationId:z.uuid()};
export const hrRequestSchema=z.discriminatedUnion('type',[
 ...shiftRequests,
 ...profileRequests(write),
 z.object({...scope,type:z.literal('hr.list'),from:date,to:date,page:z.number().int().min(0).max(100000),deviceId:z.uuid().optional(),badge:badgeSchema.optional()}).strict(),
 z.object({...scope,type:z.literal('attendance.daily'),from:date,to:date,page:z.number().int().min(0).max(100000),deviceId:z.uuid().optional(),badge:badgeSchema.optional()}).strict(),
 z.object({...write,type:z.literal('employee.save'),employee:employeeSchema,expectedRevision:z.number().int().min(0)}).strict(),
 z.object({...write,type:z.literal('job.create'),job:jobTitleSchema}).strict(),
 z.object({...write,type:z.literal('device.create'),deviceId:z.uuid(),name:field(100).min(1)}).strict(),
 z.object({...write,type:z.literal('device.revoke'),deviceId:z.uuid(),expectedRevision:z.number().int().min(1)}).strict(),
 z.object({...write,type:z.literal('device.rotate'),deviceId:z.uuid(),expectedRevision:z.number().int().min(1)}).strict()
]);
export const attendanceUploadSchema=z.object({schemaVersion:z.literal(1),batchId:z.uuid(),deviceId:z.uuid(),users:z.array(z.object({badge:badgeSchema,name:field(160)}).strict()).max(200),punches:z.array(z.object({badge:badgeSchema,localTime:wallTime,verifyMode:z.number().int().min(0).max(65535),inOutMode:z.number().int().min(0).max(65535),workCode:z.number().int().min(0).max(2147483647)}).strict()).max(200)}).strict();
export type AttendanceUpload=z.infer<typeof attendanceUploadSchema>;
export type HrData={employees:Employee[];devices:AttendanceDevice[];punches:AttendancePunch[];total:number;jobs:JobTitle[];salaries:Salary[];advances:Advance[];advanceRepayments:AdvanceRepayment[]};
