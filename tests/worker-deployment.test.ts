import {it,expect} from 'vitest';
import {mkdtemp,readdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {prepareWorkerDeployment} from '../scripts/worker-deployment.mjs';
async function removeFixture(root:string){const target=resolve(root);if(dirname(target)!==resolve(tmpdir())||!basename(target).startsWith('foodo-publish-'))throw new Error('Unsafe test cleanup path');await rm(target,{recursive:true,force:true});}

it('publishes only the explicit worker and config despite unrelated private build files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'foodo-publish-'));
 try{
  await writeFile(join(root,'private-login.txt'),'do-not-upload-TEST');
  const target=join(root,'publish'),path=await prepareWorkerDeployment(target,'export default {}',{name:'fodo',find_additional_modules:true,preview_urls:true});
  expect((await readdir(target)).sort()).toEqual(['worker.js','wrangler.json']);
  expect(await readFile(join(target,'worker.js'),'utf8')).toBe('export default {}');
  expect(JSON.parse(await readFile(path,'utf8'))).toMatchObject({name:'fodo',main:'worker.js',find_additional_modules:false,preview_urls:false});
  expect(await readFile(path,'utf8')).not.toContain('do-not-upload-TEST');
 }finally{await removeFixture(root);}
});
it('refuses a contaminated publication folder before replacing the verified worker',async()=>{
 const root=await mkdtemp(join(tmpdir(),'foodo-publish-'));
 try{
  await prepareWorkerDeployment(root,'verified-worker',{name:'fodo'});
  await writeFile(join(root,'stray.txt'),'not-a-module');
  await expect(prepareWorkerDeployment(root,'replacement',{name:'fodo'})).rejects.toThrow('Unexpected file');
  expect(await readFile(join(root,'worker.js'),'utf8')).toBe('verified-worker');
 }finally{await removeFixture(root);}
});
