import {cookies} from 'next/headers';
import {database,postCosting} from '@saas/server';
import {guardOrigin,readSession,errorResponse} from '@saas/session';
export const runtime='nodejs';
export async function POST(request:Request){try{guardOrigin(request);const access=await readSession((await cookies()).get('saas-session')?.value);const body=await request.text();if(body.length>4096)return Response.json({message:'الإعداد يتجاوز الحد المسموح.'},{status:413});return Response.json(await postCosting(await database(),access,JSON.parse(body)));}catch(error){return errorResponse(error);}}
