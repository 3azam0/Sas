import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
import {zipSync,unzipSync,strToU8} from 'fflate';
const [connectionFile,sdkInstaller]=process.argv.slice(2);
if(!connectionFile)throw new Error('Pass a non-secret connection-details JSON file, then optionally the company-provided SDK installer.');
const details=JSON.parse((await readFile(connectionFile,'utf8')).replace(/^\uFEFF/,''));
const allowed=new Set(['server','deviceId','address','port','syncEveryHours']);
if(Object.keys(details).some(k=>!allowed.has(k)))throw new Error('Connection details must not contain credentials or extra fields.');
const origin=new URL(details.server);
if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||!/^[-a-f0-9]{36}$/i.test(details.deviceId)||isIP(details.address)!==4||details.port!==4370||details.syncEveryHours!==6)throw new Error('Invalid connection details.');
const files=unzipSync(new Uint8Array(await readFile('apps/web/public/downloads/foodo-attendance-windows-1.1.0.zip')));
const root='FooDo-AttendanceSync/';
files[root+'connection-details.json']=strToU8(JSON.stringify(details,null,2));
files[root+'START-HERE.txt']=strToU8('FooDo K14 attendance - another Windows computer\r\n\r\n1. Extract this entire folder to a permanent location.\r\n2. Install the company-provided 32-bit ZKTeco SDK if missing. The optional SDK installer is in Optional-ZKTeco-SDK when supplied.\r\n3. Connect the PC to the K14 LAN. For a direct cable, use a compatible static Ethernet address; see README.md and Configure-DirectCable.ps1. Disconnect the previous collector before using the same laptop IP.\r\n4. Open Open-FooDo.cmd. The FooDo address, existing device ID, K14 IP and six-hour interval are prefilled.\r\n5. When switching collectors, stop the old PC task and renew the token on the SAME FooDo device. Enter the new pairing token and communication key directly in this tool. Click Save & enable schedule, then Sync now.\r\n\r\nThe current PC remains configured and its encrypted settings are backed up. This transfer contains no credentials, employee exports, attendance history or finger templates. Do not copy the old PC DPAPI configuration to this computer.\r\nThe browser displays uploaded attendance; the Windows tool reads the K14.\r\n');
if(sdkInstaller){
 const sdk=new Uint8Array(await readFile(sdkInstaller));
 files[root+'Optional-ZKTeco-SDK/Setup.exe']=sdk;
 files[root+'Optional-ZKTeco-SDK/SHA256.txt']=strToU8(createHash('sha256').update(sdk).digest('hex')+'  Setup.exe\r\nCompany-provided installer copied as supplied; it has not been installed on the target computer by this build.\r\n');
}
if(Object.keys(files).some(n=>/\.mdb$|\.dpapi$|progress|pending|comm-key/i.test(n)))throw new Error('Private runtime data found in transfer.');
const bytes=zipSync(files,{level:9});await mkdir('outputs',{recursive:true});
const path='outputs/FooDo-K14-Transfer-1.1.0.zip';await writeFile(path,bytes);
await writeFile(path+'.sha256',createHash('sha256').update(bytes).digest('hex')+'\n');
console.log(JSON.stringify({path,files:Object.keys(files).length,bytes:bytes.length,containsSdkInstaller:!!sdkInstaller,credentialsIncluded:false}));
