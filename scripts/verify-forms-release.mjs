// Read-only public release verification; never submits business documents.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const origin='https://fodo.am-agent2026.workers.dev';
const release=JSON.parse(await readFile('.cloud-build/deploy.json','utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={origin,expectedBuild:release.buildId,checks:[]};
const health=await fetch(origin+'/api/v1/health');assert.equal(health.status,200);report.health=await health.json();assert.equal(report.health.buildVersion,release.buildId);report.checks.push('Public health serves the expected build');
report.assets=[];
for(const [remote,local]of [[`/assets/fodo-${release.buildId}.js`,'.cloud-build/frontend/frontend.js'],[`/assets/fodo-${release.buildId}.css`,'.cloud-build/frontend/frontend.css'],['/downloads/foodo-print-windows-1.0.0.zip','apps/web/public/downloads/foodo-print-windows-1.0.0.zip']]){
 const response=await fetch(origin+remote);assert.equal(response.status,200,remote);const expected=sha(await readFile(local)),actual=sha(Buffer.from(await response.arrayBuffer()));assert.equal(actual,expected,remote+' differs from the local release');report.assets.push({path:remote,sha256:actual});
}
report.checks.push('Live JavaScript, CSS and Windows printing helper match local SHA256 hashes');
const html=await(await fetch(origin)).text();assert.ok(html.includes(`/assets/fodo-${release.buildId}.js`));report.checks.push('Live HTML selects the new versioned assets');
for(const [path,status,options]of [['/api/v1/bootstrap',401],['/.git/config',404],['/.env.local',404],['/api/v1/commands',403,{method:'POST',headers:{Origin:'https://invalid.example','Content-Type':'application/json'},body:'{}'}]]){const response=await fetch(origin+path,options);assert.equal(response.status,status,path);report.checks.push(`${path}: expected HTTP ${status}`);}
const backend=await fetch('https://bkkxrptgwbrwredauopq.supabase.co/functions/v1/fodo-api/bootstrap',{headers:{apikey:release.metadata.bindings.find(b=>b.name==='SUPABASE_PUBLISHABLE_KEY').text}});assert.equal(backend.status,401);report.checks.push('Deployed backend starts and enforces authentication');
await writeFile('.cloud-build/live-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
