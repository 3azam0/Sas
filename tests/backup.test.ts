import {it,expect} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDatabase,seed,getSnapshot} from '@saas/server';
import {backupDatabase,restoreDatabase} from '../scripts/backup-lib.mjs';
import {acquireFileLock} from '../scripts/file-lock.mjs';
it('blocks a second database owner, restores a verified snapshot and rejects tampering',async()=>{
 const root=mkdtempSync(join(tmpdir(),'fodo-backup-'));const source=join(root,'database');const db=await createDatabase(source);await seed(db);
 await expect(createDatabase(source)).rejects.toThrow('already in use');expect(()=>backupDatabase(source,join(root,'busy'))).toThrow('already in use');
 const access={organizationId:'grills' as const,userId:'test',deviceId:crypto.randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};const before=await getSnapshot(db,access);await db.close();
 const backup=join(root,'backup');const manifest=backupDatabase(source,backup);const restored=join(root,'restored');restoreDatabase(backup,restored);const copy=await createDatabase(restored);expect((await getSnapshot(copy,access)).balances).toEqual(before.balances);await copy.close();
 expect(()=>restoreDatabase(backup,restored)).toThrow('never overwritten');const file=join(backup,'data',manifest.files[0].name);writeFileSync(file,'tampered');expect(()=>restoreDatabase(backup,join(root,'corrupt'))).toThrow('integrity');expect(existsSync(join(root,'corrupt'))).toBe(false);
});
it('reclaims a dead owner but never steals a live owner lock',()=>{
 const root=mkdtempSync(join(tmpdir(),'fodo-lock-'));const file=join(root,'owner.lock');writeFileSync(file,JSON.stringify({pid:99999999,nonce:'stale'}));const release=acquireFileLock(file);expect(JSON.parse(readFileSync(file,'utf8')).pid).toBe(process.pid);expect(()=>acquireFileLock(file)).toThrow();release();expect(existsSync(file)).toBe(false);
});
