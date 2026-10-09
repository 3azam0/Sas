import {cookies} from 'next/headers';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {signSession,guardOrigin,errorResponse} from '@saas/session';
import {BusinessError} from '@saas/contracts';
export const runtime='nodejs';
export async function POST(request:Request){try{
  guardOrigin(request);
  if(process.env.SAAS_DEMO_MODE!=='1' || !['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.SAAS_APP_ORIGIN || request.url).hostname))throw new BusinessError('FORBIDDEN','الدخول التجريبي متاح محلياً فقط',403);
  const parsed=z.object({organizationId:z.enum(['grills','bistro']),deviceId:z.uuid()}).safeParse(await request.json());
  if(!parsed.success)throw new BusinessError('INVALID_COMMAND','بيانات غير صالحة',400);
  const access={...parsed.data,userId:`demo-owner-${parsed.data.organizationId}`,expiresAt:new Date(Date.now()+24*60*60*1000).toISOString()};
  const jar=await cookies();jar.set('saas-session',await signSession(access),{httpOnly:true,sameSite:'strict',secure:new URL(request.url).protocol==='https:',path:'/',maxAge:86400});
  return Response.json({access,sessionId:randomUUID()});
}catch(error){return errorResponse(error);}}
