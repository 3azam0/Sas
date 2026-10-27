import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {stableId} from './sample-data/seed.mjs';

// Explicitly approved fictional examples for the existing removable trial.
// The shared posting engine plans every write. No passwords, user sessions,
// direct balance edits, resets or deletion are used. Apply the reviewed SQL
// through the connected administrative database tool, in one transaction.
const directory='.cache/butchery-examples',dataset='butchery-examples-v1';
await mkdir(directory,{recursive:true});
try{const summary=JSON.parse(await readFile(directory+'/summary.json','utf8'));console.log(JSON.stringify({prepared:true,reused:true,...summary},null,2));process.exit(0);}catch(e){if(e.code!=='ENOENT')throw e;}
await build({stdin:{contents:"export {createDatabase,postReceiptDocument,postTransfer,postButchery,getSnapshot,reconcileStock} from './packages/server/index';export {decimal} from './packages/domain/index';",resolveDir:process.cwd(),loader:'ts'},outfile:directory+'/engine.mjs',bundle:true,platform:'node',format:'esm',target:'es2022',tsconfig:'tsconfig.json',external:['@electric-sql/pglite'],logLevel:'warning'});
const engine=await import(pathToFileURL(resolve(directory+'/engine.mjs')).href),{decimal}=engine;
const org='707a2ecc-a724-48ad-8e68-32069b308c63',trial='1ed0fd62-60a1-49be-b8ff-4dc146ad8643',generation='0a069a6d-ab1c-4904-ab9a-cdc2f9e5325a',main='main',butchery='4ea0ed59-bb01-4bef-a642-fd08e3e448e7',unit='كجم';
const capturedAt=new Date().toISOString(),businessDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const id=key=>stableId(trial,dataset+':'+key),access={organizationId:org,userId:'sample-data-admin:butchery-examples',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
const products=[
 ['beef','تجريبي - لحم بقري خام','beef_input'],['sheep','تجريبي - ضاني حي','sheep_live'],
 ['cubes','تجريبي - مكعبات بقري للمطبخ','beef_product'],['mince','تجريبي - لحم بقري مفروم','beef_product'],
 ['lamb','تجريبي - قطع ضاني للمطبخ','lamb_product'],['fat','تجريبي - دهن ضاني للمطبخ','lamb_product']
].map(([key,name,meatKind])=>({key,itemId:id('item:'+key),name,meatKind}));
const item=key=>products.find(p=>p.key===key).itemId;
const base=key=>({operationId:id('operation:'+key),organizationId:org,generation,businessDate,capturedAt,schemaVersion:1,reason:'مثال تجريبي للجزارة - '+key});
const commands=products.map(p=>({key:'create:'+p.key,service:'postButchery',command:{...base('create:'+p.key),type:'product.create',itemId:p.itemId,name:p.name,unitId:unit,meatKind:p.meatKind}}));
commands.push({key:'purchase',service:'postReceiptDocument',command:{...base('purchase'),type:'receipt.document',locationId:main,currency:'EGP',lines:[{lineId:id('receipt:beef'),itemId:item('beef'),unitId:unit,quantity:'10',unitCost:'300'},{lineId:id('receipt:sheep'),itemId:item('sheep'),unitId:unit,quantity:'60',unitCost:'150'}]}});
function transfer(key,sourceId,destinationId,quantities){const transferId=id('transfer:'+key),lines=quantities.map(([key,q])=>({movementId:id('dispatch:'+transferId+':'+key),itemId:item(key),unitId:unit,quantity:q}));commands.push({key:key+':dispatch',service:'postTransfer',command:{...base(key+':dispatch'),type:'transfer.dispatch',transferId,expectedRevision:0,sourceId,destinationId,lines}});commands.push({key:key+':receive',service:'postTransfer',command:{...base(key+':receive'),type:'transfer.receive',transferId,expectedRevision:1,lines:lines.map(l=>({movementId:id('receive:'+l.movementId),dispatchLineId:l.movementId,quantity:l.quantity}))}});}
transfer('inputs-to-butchery',main,butchery,[['beef','10'],['sheep','60']]);
commands.push({key:'beef-batch',service:'postButchery',command:{...base('beef-batch'),type:'butchery.process',locationId:butchery,mode:'beef',itemId:item('beef'),quantity:'10',slaughterLoss:'0',cuttingLoss:'1',processingCost:'100',outputs:[{itemId:item('cubes'),quantity:'6',costShare:'70'},{itemId:item('mince'),quantity:'3',costShare:'30'}]}});
commands.push({key:'sheep-batch',service:'postButchery',command:{...base('sheep-batch'),type:'butchery.process',locationId:butchery,mode:'lamb',itemId:item('sheep'),quantity:'60',headCount:1,carcassWeight:'36',slaughterLoss:'24',cuttingLoss:'4',processingCost:'300',outputs:[{itemId:item('lamb'),quantity:'26',costShare:'90'},{itemId:item('fat'),quantity:'6',costShare:'10'}]}});
transfer('products-to-main',butchery,main,[['cubes','6'],['mince','3'],['lamb','26'],['fat','6']]);
async function blank(){const db=await engine.createDatabase();await db.query('INSERT INTO organizations(id,name,generation,costing_method,costing_revision) VALUES($1,$2,$3,$4,1)',[org,'واحة أولاد سعد',generation,'moving_average']);await db.query('INSERT INTO units(organization_id,id,name) VALUES($1,$2,$2)',[org,unit]);for(const [key,name]of [[main,'المخزن الرئيسي'],[butchery,'جزارة']])await db.query('INSERT INTO locations(organization_id,id,name,kind) VALUES($1,$2,$3,$4)',[org,key,name,key===main?'مخزن':'مطبخ']);return db;}
const db=await blank(),writes=[];
const recorder={query:(...args)=>db.query(...args),transaction:run=>db.transaction(async tx=>{const pending=[];const result=await run({async query(sql,params=[]){const r=await tx.query(sql,params);if(/^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql))pending.push({sql,params,rows:r.rows});return r;}});writes.push(...pending);return result;})};
let planned;
try{for(const {service,command}of commands){const r=await engine[service](recorder,access,command);assert.equal(r.outcome,'accepted');}planned=await engine.getSnapshot(db,access);assert.ok(planned.reconciliation.every(r=>r.matches));assert.ok(planned.transfers.every(t=>t.state==='completed'));assert.equal(planned.butcheryDocuments.filter(d=>d.document.type==='butchery.process').length,2);assert.ok(decimal(planned.balances.reduce((n,b)=>n.add(b.value),decimal('0'))).eq('12400'));}finally{await db.close();}
const quote=v=>v===null||v===undefined?'NULL':typeof v==='number'?(assert.ok(Number.isFinite(v)),String(v)):typeof v==='boolean'?(v?'true':'false'):Array.isArray(v)?'ARRAY['+v.map(quote).join(',')+']':"'"+String(v).replaceAll("'","''")+"'";
const statements=[];for(const w of writes){let sequenceParam=-1;if(/^INSERT INTO cost_layers\(/i.test(w.sql)){const m=w.sql.match(/^INSERT INTO cost_layers\(([^)]+)\) VALUES\(([^)]+)\)/i);assert.ok(m,'Review changed cost-layer SQL');const index=m[1].split(',').indexOf('sequence');sequenceParam=Number(m[2].split(',')[index].replace('$',''));}
 let rendered=w.sql.replace(/\$(\d+)\b/g,(_m,n)=>Number(n)===sequenceParam?`(sequences->>${quote(String(w.params[Number(n)-1]))})::bigint`:quote(w.params[Number(n)-1]));
 if(/^INSERT INTO stock_entries\(/i.test(w.sql)&&/RETURNING sequence\s*$/i.test(w.sql)){const local=String(w.rows[0].sequence);rendered=rendered.replace(/RETURNING sequence\s*$/i,'RETURNING sequence INTO posted_sequence');statements.push(rendered+';',`sequences=jsonb_set(sequences,ARRAY[${quote(local)}],to_jsonb(posted_sequence));`);}else statements.push(rendered+';');}
const expected=planned.balances.map(b=>({locationId:b.locationId,itemId:b.itemId,quantity:b.quantity,value:b.value}));
const manifest={dataset,trialId:trial,organizationId:org,generation,createdAt:capturedAt,fictional:true,products,operationIds:commands.map(c=>c.command.operationId),receiptId:id('operation:purchase'),batchIds:[id('operation:beef-batch'),id('operation:sheep-batch')],transferIds:[id('transfer:inputs-to-butchery'),id('transfer:products-to-main')],heads:1,liveWeight:'60',purchasedBeefWeight:'10',receivedValue:'12000',processingValue:'400',returnedValue:'12400',expectedBalances:expected};
const sql=`DO $examples$ DECLARE current_org record; sequences jsonb='{}';posted_sequence bigint;BEGIN
 SELECT generation,costing_method,costing_revision INTO current_org FROM fodo.organizations WHERE id=${quote(org)} FOR UPDATE;
 IF current_org.generation::text<>${quote(generation)} OR current_org.costing_method<>'moving_average' OR current_org.costing_revision<>1 THEN RAISE EXCEPTION 'Organization generation/costing changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM fodo.sample_data_runs WHERE id=${quote(trial)} AND organization_id=${quote(org)} AND trial_generation=${quote(generation)} AND status='active') THEN RAISE EXCEPTION 'Matching removable trial is not active'; END IF;
 IF EXISTS(SELECT 1 FROM fodo.sample_data_runs WHERE id=${quote(trial)} AND manifest->'butcheryExamples'->>'dataset'=${quote(dataset)}) THEN RETURN; END IF;
 IF (SELECT count(*) FROM fodo.locations WHERE organization_id=${quote(org)} AND active AND id IN (${quote(main)},${quote(butchery)}))<>2 OR NOT EXISTS(SELECT 1 FROM fodo.units WHERE organization_id=${quote(org)} AND id=${quote(unit)} AND name=${quote(unit)}) THEN RAISE EXCEPTION 'Main/butchery locations or kilogram unit changed'; END IF;
 IF EXISTS(SELECT 1 FROM fodo.items WHERE organization_id=${quote(org)} AND (id=ANY(${quote(products.map(p=>p.itemId))}) OR name=ANY(${quote(products.map(p=>p.name))}))) THEN RAISE EXCEPTION 'Example item identity/name already exists'; END IF;
 PERFORM set_config('search_path','fodo,pg_catalog',true);
 ${statements.join('\n')}
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(${quote(JSON.stringify(expected))}::jsonb) e("locationId" text,"itemId" text,quantity numeric,value numeric) LEFT JOIN fodo.stock_balances b ON b.organization_id=${quote(org)} AND b.location_id=e."locationId" AND b.item_id=e."itemId" WHERE b.quantity IS DISTINCT FROM e.quantity OR b.value IS DISTINCT FROM e.value) THEN RAISE EXCEPTION 'Example stock differs from independently posted plan'; END IF;
 UPDATE fodo.sample_data_runs SET manifest=jsonb_set(manifest,'{butcheryExamples}',${quote(JSON.stringify(manifest))}::jsonb,true)||jsonb_build_object('stockMovements',(SELECT count(*) FROM fodo.stock_entries WHERE organization_id=${quote(org)})) WHERE id=${quote(trial)};
 END $examples$;
 SELECT id,status,manifest->'butcheryExamples' AS examples FROM fodo.sample_data_runs WHERE id=${quote(trial)};`;
// Independently replay with different ledger sequence numbers to prove references
// use the destination's serial values, and prove same-script replay is harmless.
const replay=await blank();try{await replay.exec("ALTER SCHEMA public RENAME TO fodo;SET search_path=fodo,pg_catalog;CREATE TABLE fodo.sample_data_runs(id uuid PRIMARY KEY,organization_id text,trial_generation uuid,status text,manifest jsonb DEFAULT '{}');");await replay.query('INSERT INTO fodo.sample_data_runs(id,organization_id,trial_generation,status) VALUES($1,$2,$3,$4)',[trial,org,generation,'active']);await replay.exec("SELECT setval(pg_get_serial_sequence('fodo.stock_entries','sequence'),1000,false);");await replay.exec(sql);await replay.exec(sql);const actual=await engine.getSnapshot(replay,access);assert.ok(actual.reconciliation.every(r=>r.matches));assert.deepEqual(actual.balances.map(b=>[b.locationId,b.itemId,b.quantity,b.value]).sort(),planned.balances.map(b=>[b.locationId,b.itemId,b.quantity,b.value]).sort());assert.equal(actual.items.length,6);assert.equal(actual.butcheryDocuments.filter(d=>d.document.type==='butchery.process').length,2);}finally{await replay.close();}
const summary={dataset,trialId:trial,organizationId:org,commands:commands.length,newItems:products.length,batches:2,rawInputKg:'70',returnedProductsKg:'41',receivedValue:'12000',processingValue:'400',returnedValue:'12400',independentReplayVerified:true,idempotencyVerified:true,products:products.map(p=>({name:p.name,itemId:p.itemId}))};
await writeFile(directory+'/apply.sql',sql);await writeFile(directory+'/commands.json',JSON.stringify(commands,null,2));await writeFile(directory+'/manifest.json',JSON.stringify(manifest,null,2));await writeFile(directory+'/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
