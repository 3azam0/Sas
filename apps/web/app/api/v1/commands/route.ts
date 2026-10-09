import {cookies} from 'next/headers';
import {database,postCommand} from '@saas/server';
import {guardOrigin,readSession,errorResponse} from '@saas/session';
export const runtime='nodejs';
export async function POST(request:Request){try{guardOrigin(request);const access=await readSession((await cookies()).get('saas-session')?.value);return Response.json(await postCommand(await database(),access,await request.json()));}catch(error){return errorResponse(error);}}
