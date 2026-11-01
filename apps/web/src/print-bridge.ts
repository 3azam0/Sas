import type {PrintPaper,PrintOrientation} from './printing';
export const helperOrigin='http://127.0.0.1:17856';
export const helperDownload='/downloads/foodo-print-windows-1.0.0.zip';
export type HelperPrinter={id:string;name:string;paper:PrintPaper;widthDots:number};
export type PrintPage={width:number;height:number;png:string};
export type PrintPacket={version:1;id:string;organizationId:string;title:string;paper:PrintPaper;orientation:PrintOrientation;printerId:string;createdAt:string;pages:PrintPage[]};
export type PrintReceipt={id:string;organizationId:string;status:'queued'|'sending'|'submitted'|'failed'|'unknown';message:string;title:string;createdAt:string};
export class PrintBridgeError extends Error {constructor(message:string,public status=0,public code='CONNECTION'){super(message);}}
const authKey=(organizationId:string)=>'foodo.print.helper.v1:'+organizationId;
export const printRecordKey=(organizationId:string,documentId:string,paper:PrintPaper)=>'foodo.print.job.v1:'+JSON.stringify([organizationId,documentId,paper]);
export function helperToken(organizationId:string){try{return localStorage.getItem(authKey(organizationId))??'';}catch{return '';}}
export function forgetHelper(organizationId:string){localStorage.removeItem(authKey(organizationId));}
async function call(organizationId:string,path:string,body?:unknown,authenticated=true):Promise<unknown>{
 const token=authenticated?helperToken(organizationId):'';if(authenticated&&!token)throw new PrintBridgeError('اربط هذا المتصفح بالمساعد أولاً.',401,'PAIR_REQUIRED');
 let response:Response;try{response=await fetch(helperOrigin+'/v1/'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(authenticated?{'X-FooDo-Token':token,'X-FooDo-Organization':organizationId}:{})},body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(body===undefined?5000:30000)});}catch{throw new PrintBridgeError('تعذر الاتصال بمساعد ويندوز. شغّله واسمح باتصال FooDo بالجهاز المحلي عند طلب المتصفح.');}
 let data:unknown;try{data=await response.json();}catch{throw new PrintBridgeError('استجابة غير صالحة من مساعد الطباعة.');}
 if(!response.ok){const error=data as {message?:string;code?:string};throw new PrintBridgeError(error.message??'تعذر تنفيذ طلب الطباعة.',response.status,error.code??'HELPER_ERROR');}return data;
}
export async function pairPrintHelper(organizationId:string,code:string){
 const data=await call(organizationId,'pair',{organizationId,code:code.trim().toUpperCase()},false) as {service:string;protocol:number;platform:string;organizationId:string;token:string};
 if(data.service!=='foodo-print'||data.protocol!==1||data.platform!=='windows'||data.organizationId!==organizationId||!/^[A-Za-z0-9_-]{43}$/.test(data.token??''))throw new PrintBridgeError('إصدار مساعد الطباعة غير متوافق.');
 try{localStorage.setItem(authKey(organizationId),data.token);}catch{throw new PrintBridgeError('تعذر حفظ الربط على هذا المتصفح. اسمح بالتخزين المحلي.');}
}
export async function helperPrinters(organizationId:string){
 const data=await call(organizationId,'printers') as {protocol:number;printers:HelperPrinter[]};
 if(data.protocol!==1||!Array.isArray(data.printers)||data.printers.some(p=>!['a4','roll80'].includes(p.paper)||p.id!==p.paper||typeof p.name!=='string'||(p.paper==='roll80'&&![512,576,640].includes(p.widthDots))))throw new PrintBridgeError('قائمة طابعات غير صالحة.');return data.printers;
}
function receipt(value:unknown,organizationId:string,id:string){const r=value as PrintReceipt;if(!r||r.id!==id||r.organizationId!==organizationId||!['queued','sending','submitted','failed','unknown'].includes(r.status))throw new PrintBridgeError('تعذر تأكيد حالة الطباعة.');return r;}
export async function sendPrintPacket(packet:PrintPacket){if(new TextEncoder().encode(JSON.stringify(packet)).length>16000000)throw new PrintBridgeError('المستند كبير جداً. اطبع نطاقاً أصغر.');return receipt(await call(packet.organizationId,'jobs',packet),packet.organizationId,packet.id);}
export async function printJobStatus(organizationId:string,id:string){if(!/^[a-f\d-]{36}$/i.test(id))throw new PrintBridgeError('معرّف الطلب غير صالح.');return receipt(await call(organizationId,'jobs/'+id),organizationId,id);}
export function readPrintReceipt(key:string):PrintReceipt|null{try{const r=JSON.parse(localStorage.getItem(key)??'null') as PrintReceipt|null;return r&&typeof r.id==='string'&&typeof r.title==='string'&&['queued','sending','submitted','failed','unknown'].includes(r.status)?r:null;}catch{return null;}}
export function savePrintReceipt(key:string,value:PrintReceipt){localStorage.setItem(key,JSON.stringify(value));}
export function printSubmissionFailure(pending:PrintReceipt,accepted:boolean,error:unknown):PrintReceipt {
 const rejected=!accepted&&error instanceof PrintBridgeError&&['JOB_SCOPE','JOB_EXPIRED','JOB_INVALID','IMAGE_LIMIT','IMAGE_INVALID','PRINTER_MISSING','PAIR_REQUIRED','QUEUE_FULL','JOB_LIMIT','ORIGIN','HOST'].includes(error.code);
 return {...pending,status:rejected?'failed':'unknown',message:rejected?(error as Error).message:'تعذر تأكيد الإرسال؛ افحص الطابعة وتحقق من حالة الطلب قبل طلب نسخة أخرى.'};
}
