import {it,expect,vi,afterEach} from 'vitest';
import {handle,createWorker} from '../cloud/worker';
const env={SUPABASE_URL:'https://bkkxrptgwbrwredauopq.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test-key'} as Env;
const origin='https://fodo.example',tokens={access_token:'jwt.token.signature',refresh_token:'refresh-token',expires_in:3600},cookie='__Host-fodo-session='+btoa(JSON.stringify(tokens))+'; __Host-fodo-device=00000000-0000-4000-8000-000000000000';
afterEach(()=>vi.unstubAllGlobals());
it('rejects unauthenticated access, wrong origins and all development/reset routes before fetching',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 expect((await handle(new Request(origin+'/api/v1/bootstrap'),env,{},'test')).status).toBe(401);
 expect((await handle(new Request(origin+'/api/v1/receipts',{method:'POST',headers:{Origin:'https://evil.example',Cookie:cookie}}),env,{},'test')).status).toBe(403);
 for(const route of ['demo-session','costing','provision'])expect((await handle(new Request(origin+'/api/v1/'+route,{method:'POST',headers:{Origin:origin,Cookie:cookie}}),env,{},'test')).status).toBe(404);
 expect(fetcher).not.toHaveBeenCalled();
});
it('keeps login tokens HTTP-only and refuses an unassigned Auth user',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json(tokens)).mockResolvedValueOnce(Response.json({organizationId:'tenant'}));vi.stubGlobal('fetch',fetcher);
 const request=()=>new Request(origin+'/api/v1/auth/login',{method:'POST',headers:{Origin:origin},body:JSON.stringify({email:'test@fodo.com',password:'some-password',deviceId:'00000000-0000-4000-8000-000000000000'})});
 const r=await handle(request(),env,{},'test');expect(await r.json()).toEqual({ok:true});expect(r.headers.get('Set-Cookie')).toContain('Secure; HttpOnly; SameSite=Strict');expect(fetcher.mock.calls[1][1].headers.Authorization).toBe('Bearer '+tokens.access_token);
 fetcher.mockResolvedValueOnce(Response.json(tokens)).mockResolvedValueOnce(Response.json({}, {status:403}));expect((await handle(request(),env,{},'test')).headers.has('Set-Cookie')).toBe(false);
});
it('refreshes expired tokens once, preserves generation/body and avoids exposing tokens in the response',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({}, {status:401})).mockResolvedValueOnce(Response.json({...tokens,access_token:'new.jwt.token'})).mockResolvedValueOnce(Response.json({outcome:'accepted'}));vi.stubGlobal('fetch',fetcher);
 const r=await handle(new Request(origin+'/api/v1/sales',{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Fodo-Generation':'generation'},body:'{"operation":"sale"}'}),env,{},'test');
 expect(await r.json()).toEqual({outcome:'accepted'});expect(fetcher).toHaveBeenCalledTimes(3);expect(fetcher.mock.calls[2][1]).toMatchObject({body:'{"operation":"sale"}',headers:{'X-Fodo-Generation':'generation',Authorization:'Bearer new.jwt.token'}});expect(r.headers.has('Set-Cookie')).toBe(true);
});
it('does not misreport authentication or workspace service outages as bad credentials or inactive access',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 const request=()=>new Request(origin+'/api/v1/auth/login',{method:'POST',headers:{Origin:origin},body:JSON.stringify({email:'owner@example.com',password:'test-password',deviceId:'00000000-0000-4000-8000-000000000000'})});
 for(const [upstream,expected] of [[400,401],[429,429],[500,503],[503,503]]){
  fetcher.mockResolvedValueOnce(Response.json({message:'Private upstream detail'},{status:upstream}));
  const response=await handle(request(),env,{},'test');expect(response.status).toBe(expected);expect(await response.text()).not.toContain('Private upstream');expect(response.headers.has('Set-Cookie')).toBe(false);
 }
 for(const [upstream,expected] of [[403,403],[401,401],[429,503],[503,503]]){
  fetcher.mockResolvedValueOnce(Response.json(tokens)).mockResolvedValueOnce(Response.json({},{status:upstream}));
  const response=await handle(request(),env,{},'test');expect(response.status).toBe(expected);expect(response.headers.has('Set-Cookie')).toBe(false);
 }
});
it('expires both cookies on logout and adds security headers',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(null,{status:204})));const worker=createWorker({},'test');
 const r=await worker.fetch(new Request(origin+'/api/v1/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:cookie}}),env);expect(r.headers.get('Set-Cookie')).toContain('Max-Age=0');expect(r.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");expect(r.headers.get('Cache-Control')).toBe('no-store');
});
it('allows only the fixed loopback helper connection while retaining other policy boundaries',async()=>{
 const r=await createWorker({},'test').fetch(new Request(origin+'/missing'),env),policy=r.headers.get('Content-Security-Policy')!;
 expect(policy).toContain("connect-src 'self' http://127.0.0.1:17856;");expect(policy).toContain("script-src 'self';");expect(policy).toContain("frame-ancestors 'none'");expect(policy).not.toContain('connect-src *');expect(policy).not.toContain('http://192.168.');
});

it('requires authenticated same-origin POST for reports and forwards its exact filters and generation',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({schemaVersion:1,rows:[],total:0}));vi.stubGlobal('fetch',fetcher);
 expect((await handle(new Request(origin+'/api/v1/reports',{method:'POST',headers:{Origin:origin},body:'{}'}),env,{},'test')).status).toBe(401);
 expect((await handle(new Request(origin+'/api/v1/reports',{headers:{Cookie:cookie}}),env,{},'test')).status).toBe(404);
 expect((await handle(new Request(origin+'/api/v1/reports',{method:'POST',headers:{Origin:'https://evil.example',Cookie:cookie},body:'{}'}),env,{},'test')).status).toBe(403);
 expect(fetcher).not.toHaveBeenCalled();
 const body=JSON.stringify({kind:'inventory',from:'2026-10-01',to:'2026-10-12',page:2});
 const r=await handle(new Request(origin+'/api/v1/reports',{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-Fodo-Generation':'generation'},body}),env,{},'test');
 expect(r.status).toBe(200);expect(r.headers.get('Cache-Control')).toBe('no-store');expect(fetcher.mock.calls[0][0]).toContain('/functions/v1/fodo-api/reports');expect(fetcher.mock.calls[0][1]).toMatchObject({method:'POST',body,headers:{'X-Fodo-Generation':'generation',Authorization:'Bearer '+tokens.access_token}});
});
