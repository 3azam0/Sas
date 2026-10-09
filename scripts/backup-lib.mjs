import {mkdirSync,readdirSync,readFileSync,writeFileSync,copyFileSync,existsSync,lstatSync} from 'node:fs';
import {resolve,join,relative,isAbsolute,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {acquireFileLock} from './file-lock.mjs';
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
function files(root,dir=root){const result=[];for(const entry of readdirSync(dir,{withFileTypes:true})){if(entry.name==='.fodo.lock'||entry.name==='.fodo.lock.reclaim')continue;const path=join(dir,entry.name);if(lstatSync(path).isSymbolicLink())throw new Error('Backup refuses symbolic links.');if(entry.isDirectory())result.push(...files(root,path));else result.push(relative(root,path).replaceAll('\\','/'));}return result.sort();}
function directories(root,dir=root){const result=[];for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isSymbolicLink())throw new Error('Backup refuses symbolic links.');if(entry.isDirectory()){result.push(relative(root,path).replaceAll('\\','/'));result.push(...directories(root,path));}}return result.sort();}
function safePath(root,name){if(typeof name!=='string'||!name||isAbsolute(name))throw new Error('Invalid backup path');const path=resolve(root,name);const rel=relative(root,path);if(rel.startsWith('..')||isAbsolute(rel))throw new Error('Invalid backup path');return path;}
export function backupDatabase(source,destination){
 source=resolve(source);destination=resolve(destination);
 if(!existsSync(join(source,'PG_VERSION')))throw new Error('No initialized Fodo PostgreSQL database found.');
 if(existsSync(destination))throw new Error('Backup destination already exists.');
 const nesting=relative(source,destination);if(!nesting.startsWith('..')&&!isAbsolute(nesting))throw new Error('Backup destination must be outside the database directory.');
 const release=acquireFileLock(join(source,'.fodo.lock'));
 try{const names=files(source);const dirs=directories(source);const entries=names.map(name=>({name,sha256:hash(join(source,name))}));mkdirSync(join(destination,'data'),{recursive:true});for(const dir of dirs)mkdirSync(safePath(join(destination,'data'),dir),{recursive:true});for(const item of entries){const target=safePath(join(destination,'data'),item.name);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(source,item.name),target);}const manifest={version:1,service:'fodo',createdAt:new Date().toISOString(),directories:dirs,files:entries};writeFileSync(join(destination,'manifest.json'),JSON.stringify(manifest,null,2));return manifest;}finally{release();}
}
export function restoreDatabase(backup,destination){
 backup=resolve(backup);destination=resolve(destination);if(existsSync(destination))throw new Error('Restore requires a new, empty destination path; existing databases are never overwritten.');
 const manifest=JSON.parse(readFileSync(join(backup,'manifest.json'),'utf8'));
 if(manifest.version!==1||manifest.service!=='fodo'||!Array.isArray(manifest.files)||!Array.isArray(manifest.directories)||manifest.files.length>100000||manifest.directories.length>100000)throw new Error('Invalid backup manifest.');
 const names=new Set();for(const file of manifest.files){if(names.has(file.name))throw new Error('Duplicate backup path');names.add(file.name);const path=safePath(join(backup,'data'),file.name);if(lstatSync(path).isSymbolicLink()||hash(path)!==file.sha256)throw new Error('Backup integrity check failed.');safePath(destination,file.name);}
 if(!names.has('PG_VERSION'))throw new Error('Backup is missing PostgreSQL data.');
 for(const dir of manifest.directories)safePath(destination,dir);for(const dir of manifest.directories)mkdirSync(safePath(destination,dir),{recursive:true});
 for(const file of manifest.files){const target=safePath(destination,file.name);mkdirSync(dirname(target),{recursive:true});copyFileSync(safePath(join(backup,'data'),file.name),target);}return manifest;
}
