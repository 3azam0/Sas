import {cookies} from 'next/headers';
import {database,getReport,generationInput} from '@saas/server';
import {guardOrigin,readSession,errorResponse} from '@saas/session';
export const runtime='nodejs';
export async function POST(request:Request){try{
 guardOrigin(request);const access=await readSession((await cookies()).get('saas-session')?.value);
 const body=await request.text();if(new TextEncoder().encode(body).length>4096)return Response.json({message:'فلاتر التقرير تتجاوز الحد المسموح.'},{status:413});
 return Response.json(await getReport(await database(),access,generationInput(request,JSON.parse(body))),{headers:{'Cache-Control':'no-store'}});
}catch(error){return errorResponse(error);}}
