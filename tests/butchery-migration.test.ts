import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {schema} from '../packages/server/schema';
import {butcheryTables,butcheryMigration,postButchery} from '../packages/server/butchery';
import {getSnapshot,postCommand} from '@saas/server';
// @ts-expect-error Administrative JavaScript module
import {butcheryMigrationSql} from '../scripts/butchery-migration.mjs';
// @ts-expect-error Administrative JavaScript module
import {tableSql,policySql,captureSql,cleanupSql} from '../scripts/sample-data/admin.mjs';

it('guards the additive hosted migration, preserves trial baselines and restores through batch/catalog foreign keys',async()=>{
 const db=new PGlite(),run=randomUUID(),org='trial',access={organizationId:org,userId:'test',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
 try{
  expect(schema.endsWith(butcheryTables)).toBe(true);
  await db.exec('CREATE SCHEMA fodo; SET search_path=fodo,pg_catalog; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE fodo_api;');
  await db.exec(schema.slice(0,-butcheryTables.length)+tableSql+policySql);
  await db.exec("INSERT INTO organizations(id,name) VALUES('trial','Trial'),('other','Preserve');INSERT INTO units(organization_id,id,name) VALUES('trial','kg','كجم'),('other','kg','كجم');INSERT INTO locations(organization_id,id,name,kind) VALUES('trial','main','Main','مطبخ');INSERT INTO items(organization_id,id,name,sku,category,unit,unit_id,minimum) VALUES('trial','raw','Raw','RAW','Meat','كجم','kg',0),('other','keep','Keep','KEEP','Meat','كجم','kg',0);");
  await db.exec(captureSql(org,run).replaceAll("'butchery_catalog',",'').replaceAll("'butchery_batches',",''));
  const originalItems=(await db.query("SELECT * FROM items ORDER BY organization_id,id")).rows;
  const sql=butcheryMigrationSql(butcheryMigration);
  await db.exec('ALTER TABLE items ADD COLUMN unreviewed text');await expect(db.exec(sql)).rejects.toThrow('differs');await db.exec('ALTER TABLE items DROP COLUMN unreviewed');
  await db.exec('BEGIN;'+sql+'COMMIT;');
  expect((await db.query('SELECT * FROM items ORDER BY organization_id,id')).rows).toEqual(originalItems);
  expect((await db.query("SELECT jsonb_array_length(baseline->'butchery_catalog') AS catalog,jsonb_array_length(baseline->'butchery_batches') AS batches FROM sample_data_runs WHERE id=$1",[run])).rows[0]).toEqual({catalog:0,batches:0});
  expect((await db.query("SELECT relrowsecurity AS rls,relforcerowsecurity AS forced FROM pg_class WHERE oid='fodo.butchery_batches'::regclass")).rows[0]).toEqual({rls:true,forced:true});
  expect((await db.query("SELECT has_table_privilege('anon','fodo.butchery_catalog','SELECT') AS anonymous,has_table_privilege('authenticated','fodo.butchery_batches','INSERT') AS authenticated,has_table_privilege('fodo_api','fodo.butchery_batches','INSERT') AS api")).rows[0]).toEqual({anonymous:false,authenticated:false,api:true});
  const generation=(await getSnapshot(db,access)).generation,base=()=>({organizationId:org,generation,operationId:randomUUID(),businessDate:'2026-10-26',capturedAt:new Date().toISOString(),schemaVersion:1 as const,reason:'Migration test'}),product=randomUUID();
  await postButchery(db,access,{...base(),type:'product.classify',itemId:'raw',meatKind:'beef_input'});
  await postButchery(db,access,{...base(),type:'product.create',itemId:product,name:'New cut',unitId:'kg',meatKind:'beef_product'});
  await postCommand(db,access,{...base(),locationId:'main',itemId:'raw',type:'receipt.post',quantity:'5',unitCost:'100'});
  await postButchery(db,access,{...base(),type:'butchery.process',locationId:'main',mode:'beef',itemId:'raw',quantity:'5',slaughterLoss:'0',cuttingLoss:'1',processingCost:'0',outputs:[{itemId:product,quantity:'4',costShare:'100'}]});
  expect((await db.query('SELECT 1 FROM stock_entries WHERE butchery_id IS NOT NULL')).rows).toHaveLength(2);
  await db.exec(cleanupSql(org,run));
  expect((await db.query('SELECT 1 FROM butchery_batches')).rows).toHaveLength(0);expect((await db.query('SELECT 1 FROM butchery_catalog')).rows).toHaveLength(0);
  expect((await db.query('SELECT * FROM items ORDER BY organization_id,id')).rows).toEqual(originalItems);
  expect((await db.query("SELECT status FROM sample_data_runs WHERE id=$1",[run])).rows[0]).toEqual({status:'cleaned'});
  await expect(db.exec(sql)).rejects.toThrow('already exists');
 }finally{await db.close();}
},60000);
