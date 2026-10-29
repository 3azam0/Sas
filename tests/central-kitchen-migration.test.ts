import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {schema} from '../packages/server/schema';
import {centralKitchenTables} from '../packages/server/central-kitchen-schema';
import {postCommand,postCentralKitchen,getSnapshot} from '@saas/server';
const migration=readFileSync('supabase/migrations/20261029145734_central_kitchen_batches.sql','utf8');
it('adds hosted batch tables without rewriting legacy stock and enforces tenant-scoped API access',async()=>{
 const db=await PGlite.create();
 try{
  await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE fodo_api NOLOGIN;CREATE SCHEMA fodo;SET search_path=fodo,pg_catalog;'+schema.replace(centralKitchenTables,''));
  await db.exec("INSERT INTO organizations(id,name) VALUES('a','A'),('b','B');INSERT INTO units(organization_id,id,name) VALUES('a','kg','كجم'),('b','kg','كجم');INSERT INTO locations(organization_id,id,name,kind) VALUES('a','main','Main','مخزن'),('b','main','Main','مخزن');INSERT INTO items(organization_id,id,name,sku,category,unit,unit_id,minimum) VALUES('a','beef','Beef','B','Food','كجم','kg',0),('b','beef','Beef','B','Food','كجم','kg',0);");
  const access={organizationId:'a',userId:'operator',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
  await postCommand(db,access,{operationId:randomUUID(),organizationId:'a',locationId:'main',itemId:'beef',type:'receipt.post',quantity:'10',unitCost:'25',reason:'Before migration',businessDate:'2026-10-10',capturedAt:new Date().toISOString(),schemaVersion:1});
  const before=(await db.query('SELECT * FROM stock_entries')).rows;await db.exec('BEGIN;'+migration+'COMMIT;');
  const after=(await db.query<Record<string,unknown>>('SELECT * FROM stock_entries')).rows;expect(after.map(({central_batch_id,central_action_id,...row})=>row)).toEqual(before);expect(after.every(r=>r.central_batch_id===null&&r.central_action_id===null)).toBe(true);
  await db.exec('GRANT USAGE ON SCHEMA fodo TO fodo_api;');
  for(const org of ['a','b']){const s=await getSnapshot(db,{...access,organizationId:org});await postCentralKitchen(db,{...access,organizationId:org},{operationId:randomUUID(),organizationId:org,generation:s.generation,batchId:randomUUID(),expectedRevision:0,type:'central.create',locationId:'main',name:'Batch '+org,operationType:'manufacturing',businessDate:'2026-10-10',capturedAt:new Date().toISOString(),schemaVersion:1});}
  await db.transaction(async tx=>{await tx.query('SET LOCAL ROLE fodo_api');await tx.query("SELECT set_config('fodo.tenant','a',true)");expect((await tx.query('SELECT organization_id FROM central_batches')).rows).toEqual([{organization_id:'a'}]);expect((await tx.query('SELECT organization_id FROM central_actions')).rows).toEqual([{organization_id:'a'}]);expect((await tx.query("UPDATE central_batches SET revision=99 WHERE organization_id='b' RETURNING batch_id")).rows).toEqual([]);});
  expect((await db.query("SELECT has_table_privilege('anon','fodo.central_batches','SELECT') AS anonymous,has_table_privilege('authenticated','fodo.central_actions','INSERT') AS authenticated,has_table_privilege('fodo_api','fodo.central_actions','INSERT') AS api")).rows[0]).toEqual({anonymous:false,authenticated:false,api:true});
  expect((await db.query("SELECT relrowsecurity AS rls,relforcerowsecurity AS forced FROM pg_class WHERE oid='fodo.central_batches'::regclass")).rows[0]).toEqual({rls:true,forced:true});
 }finally{await db.close();}
},120000);
