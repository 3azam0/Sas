import {cookies} from 'next/headers';
import {database,generationInput} from '@saas/server';
import {postDocumentCorrection} from '../../../../../../packages/server/document-corrections';
import {limitedText} from '../../../../../../cloud/request-body';
import {guardOrigin,readSession,errorResponse} from '@saas/session';
export const runtime='nodejs';
export async function POST(request:Request){try{guardOrigin(request);const access=await readSession((await cookies()).get('saas-session')?.value);const text=await limitedText(request,1024*1024);if(text===null)return Response.json({message:'المستند كبير.'},{status:413});return Response.json(await postDocumentCorrection(await database(),access,generationInput(request,JSON.parse(text))));}catch(e){return errorResponse(e);}}
