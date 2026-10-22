/** Public app shell only. Versioned requests bypass an older worker's cached files. */
export function hostedServiceWorker(buildId,paths){
 if(!/^[a-f0-9]{16}$/.test(buildId)||paths.some(p=>!p.startsWith('/')||p.startsWith('/api/')))throw new Error('Invalid hosted shell assets');
 return `const CACHE='fodo-hosted-${buildId}',FILES=${JSON.stringify(paths)};
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const responses=await Promise.all(FILES.map(async path=>{const response=await fetch(path+'?fodo-precache=${buildId}',{cache:'reload'});if(!response.ok)throw new Error('Shell asset unavailable');return [path,response];}));
 const cache=await caches.open(CACHE);await Promise.all(responses.map(([path,response])=>cache.put(path,response)));await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('fodo-hosted-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request,{cache:'reload'}).catch(()=>caches.open(CACHE).then(cache=>cache.match('/'))));return;}
 if(FILES.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(response=>response||fetch(event.request)));
});`;
}
