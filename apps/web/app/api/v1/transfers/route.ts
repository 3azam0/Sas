import {generationInput} from '@saas/server';
import {cookies} from 'next/headers';
import {database,postTransfer} from '@saas/server';
import {guardOrigin,readSession,errorResponse} from '@saas/session';
export const runtime='nodejs';
export async function POST(request:Request){try{
 guardOrigin(request);const access=await readSession((await cookies()).get('saas-session')?.value);
 const body=await request.text();if(new TextEncoder().encode(body).length>1024*1024)return Response.json({message:'المستند يتجاوز ١ ميجابايت.'},{status:413});
 return Response.json(await postTransfer(await database(),access,generationInput(request,JSON.parse(body))));
}catch(error){return errorResponse(error);}}
