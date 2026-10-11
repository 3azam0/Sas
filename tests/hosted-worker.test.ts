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
it('expires both cookies on logout and adds security headers',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(null,{status:204})));const worker=createWorker({},'test');
 const r=await worker.fetch(new Request(origin+'/api/v1/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:cookie}}),env);expect(r.headers.get('Set-Cookie')).toContain('Max-Age=0');expect(r.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");expect(r.headers.get('Cache-Control')).toBe('no-store');
});
