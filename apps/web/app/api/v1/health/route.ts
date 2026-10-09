export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){return Response.json({service:'fodo',instanceId:process.env.FODO_INSTANCE_ID||null,buildVersion:process.env.NEXT_PUBLIC_FODO_BUILD},{headers:{'Cache-Control':'no-store'}});}
