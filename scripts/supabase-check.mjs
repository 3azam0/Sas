import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
const path=resolve('apps/web/.env.local');
if(existsSync(path))process.loadEnvFile(path);
try{
 const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||'');
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(url.protocol!=='https:'||!key?.startsWith('sb_publishable_'))throw new Error('Configure the Supabase HTTPS URL and publishable key in apps/web/.env.local.');
 const response=await fetch(new URL('/auth/v1/settings',url),{headers:{apikey:key},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error(`Supabase rejected the connectivity check (HTTP ${response.status}).`);
 const settings=await response.json();
 if(typeof settings.external!=='object')throw new Error('Supabase Auth returned an unexpected response.');
 console.log(`Supabase Auth reachable and publishable key accepted: ${url.hostname}`);
 console.log('Local inventory still uses PGlite; cloud tenant schema and Auth integration are the next stage.');
}catch(error){console.error(error.message);process.exitCode=1;}
