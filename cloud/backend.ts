// Supabase Edge entry point. Auth is verified here before any tenant database access.
import postgres from 'npm:postgres@3.4.9';
import {BusinessError,type Access} from '../packages/contracts/index';
import type {Database,QueryDatabase} from '../packages/server/database';
import {getSnapshot,postCommand} from '../packages/server/services';
import {postSetupCommand} from '../packages/server/setup';
import {postOpening} from '../packages/server/opening';
import {postReceiptDocument} from '../packages/server/receipts';
import {postPurchase} from '../packages/server/purchasing';
import {postTransfer} from '../packages/server/transfers';
import {postCount} from '../packages/server/counts';
import {postRecipe} from '../packages/server/recipes';
import {postProduction} from '../packages/server/production';
import {postMenuItem,postSalesImport} from '../packages/server/sales';
import {generationInput} from '../packages/server/request-generation';

declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):void};
const required=(key:string)=>{const value=Deno.env.get(key);if(!value)throw new Error(`Missing ${key}`);return value;};
const sql=postgres(required('SUPABASE_DB_URL'),{prepare:false,max:1,idle_timeout:20,connect_timeout:10,ssl:'require'});
const base=required('SUPABASE_URL');
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??JSON.parse(required('SUPABASE_SECRET_KEYS')).default;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
function queryAdapter(connection:typeof sql):QueryDatabase{return {async query<T>(text:string,params:unknown[]=[]){return {rows:await connection.unsafe(text,params as never[]) as unknown as T[]};}};}
function tenantDatabase(org:string):Database{
 return {...queryAdapter(sql),async transaction<T>(run:(tx:QueryDatabase)=>Promise<T>){
  return await sql.begin(async connection=>{
   await connection.unsafe("SET LOCAL search_path = fodo, pg_catalog");
   await connection.unsafe("SELECT set_config('fodo.tenant',$1,true)",[org]);
   // A non-owner role makes RLS enforce scope even if a query misses its filter.
   await connection.unsafe('SET LOCAL ROLE fodo_api');
   return await run(queryAdapter(connection as unknown as typeof sql));
  }) as T;
 }};
}
async function accessFor(request:Request):Promise<Access>{
 const auth=request.headers.get('Authorization')??'';if(!/^Bearer [A-Za-z0-9_.-]+$/.test(auth))throw new BusinessError('AUTH_REQUIRED','سجّل الدخول للمزامنة.',401);
 const response=await fetch(base+'/auth/v1/user',{headers:{apikey:secret,Authorization:auth},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new BusinessError('AUTH_REQUIRED','انتهت الجلسة. سجّل الدخول مجدداً.',401);
 const user=await response.json() as {id?:string};if(!user.id)throw new BusinessError('AUTH_REQUIRED','الجلسة غير صالحة.',401);
 const rows=await sql.unsafe('SELECT organization_id FROM fodo.user_access WHERE user_id=$1 AND active',[user.id]);
 if(rows.length!==1)throw new BusinessError('FORBIDDEN','الحساب غير مفعّل لهذه المؤسسة.',403);
 const device=request.headers.get('X-Fodo-Device')??'';if(!/^[a-f0-9-]{36}$/i.test(device))throw new BusinessError('INVALID_DEVICE','أعد تسجيل الدخول على هذا الجهاز.',400);
 return {organizationId:rows[0].organization_id,userId:user.id,deviceId:device,expiresAt:new Date(Date.now()+86400000).toISOString()};
}
const handlers:Record<string,(db:Database,access:Access,input:unknown)=>Promise<unknown>>={commands:postCommand,setup:postSetupCommand,openings:postOpening,receipts:postReceiptDocument,purchases:postPurchase,transfers:postTransfer,counts:postCount,recipes:postRecipe,production:postProduction,menu:postMenuItem,sales:postSalesImport};
Deno.serve(async request=>{
 try{
  const route=new URL(request.url).pathname.split('/').filter(Boolean).at(-1)!;
  const access=await accessFor(request),db=tenantDatabase(access.organizationId);
  if(route==='bootstrap'&&request.method==='GET')return json(await getSnapshot(db,access));
  if(request.method!=='POST'||!handlers[route])return json({code:'NOT_FOUND',message:'المسار غير متاح.'},404);
  const text=await request.text();if(new TextEncoder().encode(text).length>1024*1024)return json({code:'TOO_LARGE'},413);
  return json(await handlers[route](db,access,generationInput(request,JSON.parse(text))));
 }catch(error){
  if(error instanceof BusinessError)return json({code:error.code,message:error.message},error.status);
  if(error instanceof SyntaxError)return json({code:'INVALID_JSON',message:'بيانات الطلب غير صالحة.'},400);
  console.error('Fodo request failed',error instanceof Error?error.name:'unknown');
  return json({code:'SERVER_ERROR',message:'تعذر إتمام الطلب. العملية محفوظة؛ حاول المزامنة لاحقاً.'},500);
 }
});
