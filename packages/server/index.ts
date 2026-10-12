import {seedDevelopmentStock,initializeDevelopmentBaseline} from './development';
import {PGlite} from '@electric-sql/pglite';
import {mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {acquireFileLock} from '../../scripts/file-lock.mjs';
import type {CostingMethod} from '@saas/contracts';
import {schema} from './schema';
export async function createDatabase(path?:string) { if(path) await mkdir(path,{recursive:true});const release=path?acquireFileLock(join(path,'.fodo.lock')):()=>{};const onExit=()=>release();process.once('exit',onExit);try{const db=await PGlite.create(path);const originalClose=db.close.bind(db);db.close=async()=>{try{await originalClose();}finally{process.removeListener('exit',onExit);release();}};await db.exec(schema);return db;}catch(error){process.removeListener('exit',onExit);release();throw error;} }
export async function seed(db:PGlite,method:CostingMethod='moving_average',fixtures=true) {
 await db.transaction(async tx=>{for(const [org,name] of [['grills','مجموعة المشاوي'],['bistro','مطاعم بيت المذاق']]){
 if((await tx.query('SELECT id FROM organizations WHERE id=$1',[org])).rows.length)continue;
 await tx.query('INSERT INTO organizations(id,name,costing_method,development_baseline,development_empty_baseline) VALUES($1,$2,$3,true,true)',[org,name,method]);
 if(!fixtures)continue;
 for(const name of ['كجم','جم','لتر','مل','قطعة'])await tx.query('INSERT INTO units(organization_id,id,name) VALUES($1,$2,$2)',[org,name]);
 for(const [id,label,kind] of [['central','المخزن والمطبخ المركزي','تخزين وتحضير'],['cairo','فرع القاهرة','مطعم'],['alex','فرع الإسكندرية','مطعم']])await tx.query('INSERT INTO locations(organization_id,id,name,kind) VALUES($1,$2,$3,$4)',[org,id,label,kind]);
 for(const [id,label,sku,category,unit,min] of [['beef','لحم بقري','MT-001','لحوم','كجم','8'],['chicken','دجاج طازج','MT-002','دواجن','كجم','10'],['rice','أرز مصري','DR-001','مواد جافة','كجم','15'],['pepper','فلفل أسود','SP-001','توابل','جم','250'],['box','علبة وجبة','PK-001','تغليف','قطعة','50']])await tx.query('INSERT INTO items(organization_id,id,name,sku,category,unit,minimum,unit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$6)',[org,id,label,sku,category,unit,min]);
 await seedDevelopmentStock(tx,org,method);
 }});
}
const globalDB=globalThis as typeof globalThis & {saasDatabase?:Promise<PGlite>};
export function database() { return globalDB.saasDatabase ??= (async()=>{const db=await createDatabase(process.env.SAAS_DATA_DIR || resolve('.data'));await initializeDevelopmentBaseline(db);await seed(db,process.env.SAAS_INITIAL_COSTING_METHOD==='fifo'?'fifo':'moving_average',process.env.SAAS_SEED_FIXTURES==='1');return db;})(); }
export {postCommand,getSnapshot} from './services';
export {postSetupCommand} from './setup';
export {postOpening} from './opening';

export {postPurchase} from './purchasing';

export {postTransfer} from './transfers';

export {postCount,reconcileStock} from './counts';

export {postCosting,initializeDevelopmentBaseline} from './development';

export {generationInput} from './request-generation';

export {postReceiptDocument} from './receipts';
export {postKitchenIssue} from './kitchen-issues';

export {postRecipe} from './recipes';

export {postProduction} from './production';

export {postMenuItem,postSalesImport} from './sales';

export {getReport} from './reports';
