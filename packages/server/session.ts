import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {BusinessError,type Access} from '@saas/contracts';
const state=globalThis as typeof globalThis & {saasSecret?:Promise<Buffer>};
function secret() {return state.saasSecret ??= (async()=>{const dir=process.env.SAAS_DATA_DIR || resolve('.data');await mkdir(dir,{recursive:true});const path=join(dir,'session.key');try{return await readFile(path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;const key=randomBytes(32);await writeFile(path,key,{flag:'wx'});return key;}})();}
export async function signSession(access:Access) {const payload=Buffer.from(JSON.stringify(access)).toString('base64url');return `${payload}.${createHmac('sha256',await secret()).update(payload).digest('base64url')}`;}
export async function readSession(token?:string):Promise<Access> {
  if(!token) throw new BusinessError('AUTH_REQUIRED','تحتاج إلى جلسة تجريبية',401);
  const [payload,signature,extra]=token.split('.');if(!payload||!signature||extra)throw new BusinessError('AUTH_REQUIRED','الجلسة غير صالحة',401);
  const expected=createHmac('sha256',await secret()).update(payload).digest();const supplied=Buffer.from(signature,'base64url');
  if(expected.length!==supplied.length||!timingSafeEqual(expected,supplied))throw new BusinessError('AUTH_REQUIRED','الجلسة غير صالحة',401);
  try{const access=JSON.parse(Buffer.from(payload,'base64url').toString()) as Access;if(!['grills','bistro'].includes(access.organizationId)||Date.parse(access.expiresAt)<=Date.now())throw new Error();return access;}catch{throw new BusinessError('AUTH_REQUIRED','انتهت الجلسة',401);}
}
export function guardOrigin(request:Request) {const origin=request.headers.get('origin');const expected=new URL(process.env.SAAS_APP_ORIGIN || request.url);if(origin!==expected.origin || request.headers.get('host')!==expected.host)throw new BusinessError('FORBIDDEN','مصدر الطلب غير مسموح',403);}
export function errorResponse(error:unknown) {if(error instanceof BusinessError)return Response.json({code:error.code,message:error.message},{status:error.status});console.error('API failure',error instanceof Error?error.message:'unknown');return Response.json({code:'SERVER_ERROR',message:'تعذر إتمام الطلب. حاول المزامنة لاحقاً.'},{status:500});}
