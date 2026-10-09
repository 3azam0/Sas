import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
async function walk(dir, prefix) { const files=[]; for(const entry of await readdir(dir,{withFileTypes:true})) { const path=join(dir,entry.name); const url=prefix+'/'+entry.name; if(entry.isDirectory()) files.push(...await walk(path,url)); else files.push(url); } return files; }
const assets = await walk('apps/web/.next/static','/_next/static');
const version=Date.now().toString();
await writeFile('apps/web/public/precache.json', JSON.stringify({version,assets:['/','/manifest.webmanifest','/icon.svg',...assets]}));
// Change worker bytes with each build so an installed app downloads the new shell.
const workerPath='apps/web/public/sw.js';
const worker=(await readFile(workerPath,'utf8')).replace(/^\/\/ Fodo build:.*\r?\n/m,'');
await writeFile(workerPath,`// Fodo build: ${version}\n${worker}`);
console.log(`Offline manifest: ${assets.length} build assets`);
