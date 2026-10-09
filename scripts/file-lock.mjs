import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
function alive(pid){try{process.kill(pid,0);return true;}catch(error){return error.code!=='ESRCH';}}
export function acquireFileLock(path){
 const token=JSON.stringify({pid:process.pid,nonce:randomUUID()});
 for(let attempt=0;attempt<2;attempt++){
  try{writeFileSync(path,token,{flag:'wx'});return ()=>{try{if(readFileSync(path,'utf8')===token)unlinkSync(path);}catch(error){if(error.code!=='ENOENT')throw error;}};}
  catch(error){if(error.code!=='EEXIST')throw error;}
  let previous;try{previous=readFileSync(path,'utf8');const owner=JSON.parse(previous);if(!Number.isInteger(owner.pid)||owner.pid<=0||alive(owner.pid))throw new Error('Active owner');}catch{throw new Error(`Fodo data is already in use, or its lock needs inspection: ${path}`);}
  const reclaim=path+'.reclaim';
  try{writeFileSync(reclaim,token,{flag:'wx'});}catch{throw new Error('Another process is recovering the Fodo lock. Try again.');}
  try{if(readFileSync(path,'utf8')===previous)unlinkSync(path);}catch(error){if(error.code!=='ENOENT')throw error;}finally{unlinkSync(reclaim);}
 }
 throw new Error('Could not acquire Fodo lock. Try again.');
}
