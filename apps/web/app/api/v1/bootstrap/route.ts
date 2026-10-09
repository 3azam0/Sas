import {cookies} from 'next/headers';
import {database,getSnapshot} from '@saas/server';
import {readSession,errorResponse} from '@saas/session';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{const access=await readSession((await cookies()).get('saas-session')?.value);return Response.json(await getSnapshot(await database(),access));}catch(error){return errorResponse(error);}}
