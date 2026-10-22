import {it,expect} from 'vitest';
import {runInNewContext} from 'node:vm';
import {hostedServiceWorker} from '../scripts/hosted-service-worker.mjs';
it('installs the new complete shell despite an older cached root and uses only its own cache offline',async()=>{
 const version='0123456789abcdef',handlers:Record<string,(event:unknown)=>void>={},saved=new Map<string,Response>(),requests:{path:string;cache:string}[]=[],cache={put:async(path:string,response:Response)=>{saved.set(path,response);},match:async()=>saved.get('/')?.clone()};
 const fetcher=async(path:string|{url:string},options:{cache:string})=>{const url=typeof path==='string'?path:path.url;requests.push({path:url,cache:options.cache});if(url.includes('fodo-precache='+version))return new Response(url.startsWith('/?')?'latest-html':'latest-asset');throw new Error('Offline');};
 runInNewContext(hostedServiceWorker(version,['/','/assets/latest.js']),{self:{location:{origin:'https://fodo.example'},addEventListener:(type:string,handler:(event:unknown)=>void)=>{handlers[type]=handler;},skipWaiting:async()=>{},clients:{claim:async()=>{}}},fetch:fetcher,caches:{open:async()=>cache,keys:async()=>[],delete:async()=>true},URL});
 let work:Promise<unknown>=Promise.resolve();handlers.install({waitUntil:(p:Promise<unknown>)=>{work=p;}});await work;
 expect(await saved.get('/')!.clone().text()).toBe('latest-html');expect(await saved.get('/assets/latest.js')!.clone().text()).toBe('latest-asset');expect(requests.every(r=>r.cache==='reload'&&r.path.includes('?fodo-precache='+version))).toBe(true);
 let response:Promise<Response>|undefined;handlers.fetch({request:{url:'https://fodo.example/',method:'GET',mode:'navigate'},respondWith:(p:Promise<Response>)=>{response=p;}});expect(await (await response)!.text()).toBe('latest-html');
});
it('never caches authenticated API requests or cross-origin traffic',()=>{
 const handlers:Record<string,(event:unknown)=>void>={};let intercepted=0;
 runInNewContext(hostedServiceWorker('0123456789abcdef',['/']),{self:{location:{origin:'https://fodo.example'},addEventListener:(type:string,handler:(event:unknown)=>void)=>{handlers[type]=handler;}},URL});
 for(const request of [{url:'https://fodo.example/api/v1/reports',method:'POST',mode:'cors'},{url:'https://fodo.example/api/v1/bootstrap',method:'GET',mode:'cors'},{url:'https://other.example/',method:'GET',mode:'navigate'}])handlers.fetch({request,respondWith:()=>{intercepted++;}});
 expect(intercepted).toBe(0);expect(()=>hostedServiceWorker('0123456789abcdef',['/api/v1/bootstrap'])).toThrow();
});
