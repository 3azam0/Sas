import {mkdir,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// Wrangler must never scan the mixed build/admin folder for extra modules.
export async function prepareWorkerDeployment(directory,worker,config){
 await mkdir(directory,{recursive:true});
 const allowed=new Set(['worker.js','wrangler.json']);
 if((await readdir(directory)).some(name=>!allowed.has(name)))throw new Error('Unexpected file in worker publication folder; review before deployment.');
 const isolated={...config,main:'worker.js',find_additional_modules:false,preview_urls:false};
 await writeFile(join(directory,'worker.js'),worker);
 await writeFile(join(directory,'wrangler.json'),JSON.stringify(isolated,null,2));
 return join(directory,'wrangler.json');
}
