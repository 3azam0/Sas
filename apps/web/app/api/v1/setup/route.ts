import {cookies} from 'next/headers';
import {database,postSetupCommand} from '@saas/server';
import {guardOrigin,readSession,errorResponse} from '@saas/session';
export const runtime='nodejs';
export async function POST(request:Request){try{guardOrigin(request);const access=await readSession((await cookies()).get('saas-session')?.value);return Response.json(await postSetupCommand(await database(),access,await request.json()));}catch(error){return errorResponse(error);}}
