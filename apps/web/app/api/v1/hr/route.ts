import {cookies} from 'next/headers';
import {database,generationInput} from '@saas/server';
import {postHr} from '../../../../../../packages/server/hr';
import {guardOrigin,readSession,errorResponse} from '@saas/session';
export const runtime='nodejs';
export async function POST(request:Request){try{
 guardOrigin(request);const access=await readSession((await cookies()).get('saas-session')?.value);
 const text=await request.text();if(new TextEncoder().encode(text).length>64*1024)return Response.json({message:'الطلب كبير.'},{status:413});
 return Response.json(await postHr(await database(),access,generationInput(request,JSON.parse(text))));
}catch(error){return errorResponse(error);}}
