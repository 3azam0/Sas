import {afterEach,expect,it,vi} from 'vitest';
import {handle} from '../cloud/worker';
import {limitedText} from '../cloud/request-body';
const env={SUPABASE_URL:'https://backend.example',SUPABASE_PUBLISHABLE_KEY:'public-key'} as Env;
afterEach(()=>vi.unstubAllGlobals());
it('forwards a machine token only on the dedicated attendance route without browser cookies',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({outcome:'accepted'}));vi.stubGlobal('fetch',fetcher);const token='fodo_hr_'+'a'.repeat(64);
 const r=await handle(new Request('https://fodo.example/api/v1/attendance-sync',{method:'POST',headers:{Authorization:'Bearer '+token},body:'{}'}),env,{},'test');expect(r.status).toBe(200);expect(fetcher.mock.calls[0][0]).toBe('https://backend.example/functions/v1/fodo-api/attendance-sync');expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer '+token);
 expect((await handle(new Request('https://fodo.example/api/v1/hr',{method:'POST',headers:{Origin:'https://fodo.example',Authorization:'Bearer '+token},body:'{}'}),env,{},'test')).status).toBe(401);
 expect((await handle(new Request('https://fodo.example/api/v1/attendance-sync',{method:'POST',body:'{}'}),env,{},'test')).status).toBe(401);
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it('rejects oversized machine uploads before contacting the backend',async()=>{const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const r=await handle(new Request('https://fodo.example/api/v1/attendance-sync',{method:'POST',headers:{Authorization:'Bearer fodo_hr_'+'a'.repeat(64)},body:'x'.repeat(256*1024+1)}),env,{},'test');expect(r.status).toBe(413);expect(fetcher).not.toHaveBeenCalled();});
it('bounds a streamed body without Content-Length and preserves split UTF-8 characters',async()=>{
 const bytes=new TextEncoder().encode('موظف');const stream=new ReadableStream({start(c){c.enqueue(bytes.slice(0,1));c.enqueue(bytes.slice(1));c.close();}});
 expect(await limitedText(new Request('https://example.test',{method:'POST',body:stream,duplex:'half'} as RequestInit),16)).toBe('موظف');
 expect(await limitedText(new Request('https://example.test',{method:'POST',body:'too large'}),3)).toBeNull();
});
