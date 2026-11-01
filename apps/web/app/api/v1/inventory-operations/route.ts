import {cookies} from 'next/headers';
import {database,postInventoryControl,generationInput} from '@saas/server';
import {guardOrigin,readSession,errorResponse} from '@saas/session';
export const runtime='nodejs';
export async function POST(request:Request){try{guardOrigin(request);const access=await readSession((await cookies()).get('saas-session')?.value),body=await request.text();if(new TextEncoder().encode(body).length>16384)return Response.json({message:'طلب المراجعة كبير جداً.'},{status:413});return Response.json(await postInventoryControl(await database(),access,generationInput(request,JSON.parse(body))),{headers:{'Cache-Control':'no-store'}});}catch(e){return errorResponse(e);}}
