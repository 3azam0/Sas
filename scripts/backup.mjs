import {resolve} from 'node:path';
import {backupDatabase,restoreDatabase} from './backup-lib.mjs';
const [mode,input,output]=process.argv.slice(2);
try{
 if(mode==='create'){const destination=resolve(output||`backups/manual-${Date.now()}`);const result=backupDatabase(input||'.data-local',destination);console.log(`Backup verified: ${destination} (${result.files.length} files)`);}
 else if(mode==='restore'&&input&&output){const result=restoreDatabase(input,output);console.log(`Restored ${result.files.length} files to ${resolve(output)}. Original data was not overwritten.`);}
 else{throw new Error('Usage: node scripts/backup.mjs create [database-dir] [new-backup-dir] OR restore <backup-dir> <new-database-dir>');}
}catch(error){console.error(error.message);process.exitCode=1;}
