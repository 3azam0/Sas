import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {schema} from '../packages/server/schema';
import {getSnapshot,postCommand,postSetupCommand,postOpening,postReceiptDocument,postPurchase,postCount,postRecipe,postProduction,postMenuItem,postSalesImport} from '@saas/server';
import {estimateRecipe} from '../packages/domain/recipes';
import {salesReport} from '../packages/domain/sales-report';
// Administrative scripts are deliberately outside the client and API bundles.
// @ts-expect-error JavaScript script module
import {tableSql,policySql,captureSql,cleanupSql,finishSql} from '../scripts/sample-data/admin.mjs';
// @ts-expect-error JavaScript dataset module
import {seedClientSample,ingredients} from '../scripts/sample-data/seed.mjs';
it('posts the complete menu trial through normal engines, then restores its baseline without touching another tenant',async()=>{
 const db=new PGlite(),organizationId='trial-client',runId=randomUUID(),access={organizationId,userId:'tester',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
 try{
  await db.exec('CREATE SCHEMA fodo; SET search_path=fodo,pg_catalog; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE fodo_api;');await db.exec(schema);await db.exec(tableSql);await db.exec(policySql);
  await db.query('INSERT INTO organizations(id,name) VALUES($1,$2),($3,$4)',[organizationId,'Trial','other-client','Keep']);
  const now=new Date().toISOString(),postSetup=async(record:any,type:string)=>postSetupCommand(db,access,{operationId:randomUUID(),organizationId,type,expectedRevision:0,capturedAt:now,schemaVersion:1,record});
  for(const unit of ['كجم','عدد','لتر'])await postSetup({id:unit,name:unit},'unit.save');await postSetup({id:'main',name:'المخزن الرئيسي',kind:'مخزن',active:true},'location.save');
  for(const [key,[name,unit]] of Object.entries(ingredients) as [string,string[]][])await postSetup({id:key,name,sku:key.toUpperCase(),category:'غذاء',unitId:unit,minimum:'0',purchaseUnits:[],active:true},'item.save');
  await db.query("INSERT INTO units(organization_id,id,name) VALUES('other-client','other-unit','Keep unit')");
  const baseline=await getSnapshot(db,access),originalGeneration=baseline.generation;await db.exec(captureSql(organizationId,runId));const snapshot=await getSnapshot(db,access);expect(snapshot.generation).not.toBe(originalGeneration);
  const run:any={id:runId,generation:snapshot.generation,createdAt:now,commands:{}};
  const handlers:any={setup:postSetupCommand,openings:postOpening,receipts:postReceiptDocument,purchases:postPurchase,recipes:postRecipe,menu:postMenuItem,production:postProduction,commands:postCommand,sales:postSalesImport,counts:postCount};
  const manifest=await seedClientSample({snapshot,run,bootstrap:()=>getSnapshot(db,access),async post(key:string,route:string,fields:any){const c={...fields,organizationId,generation:run.generation,capturedAt:now,schemaVersion:1};run.commands[key]=c;expect(await handlers[route](db,access,c)).toMatchObject({outcome:'accepted'});}});
  const seeded=await getSnapshot(db,access);expect(manifest.menuItems).toBeGreaterThan(90);expect(seeded.salesImports).toHaveLength(8);expect(seeded.salesImports!.some(s=>s.stockShortages?.length)).toBe(true);expect(seeded.reconciliation!.every(r=>r.matches)).toBe(true);expect(seeded.balances.every(b=>Number(b.quantity)>=0)).toBe(true);expect(seeded.recipeVersions!.some(r=>r.definition.lines.some(l=>l.kind==='recipe'))).toBe(true);
  for(const recipe of seeded.recipes!)expect(estimateRecipe(seeded,recipe.recipeId,recipe.definition,'main','latest_receipt').complete).toBe(true);
  expect(salesReport(seeded,'main','','','latest_receipt')).toMatchObject({complete:true,count:100});
  const shortage=seeded.salesImports!.find(s=>s.stockShortages?.length)!;expect(Number(seeded.balances.find(b=>b.itemId===shortage.stockShortages![0].itemId)!.quantity)).toBeGreaterThan(0);
  await db.exec(finishSql(organizationId,runId,manifest));await expect(db.exec(cleanupSql('other-client',runId))).rejects.toThrow('Matching trial backup missing');
  await db.exec('CREATE TABLE fodo.unreviewed_feature(organization_id text)');await expect(db.exec(cleanupSql(organizationId,runId))).rejects.toThrow('Unknown tenant table');await db.exec('DROP TABLE fodo.unreviewed_feature');
  await db.exec('ALTER TABLE fodo.items ADD COLUMN unreviewed_column text');await expect(db.exec(cleanupSql(organizationId,runId))).rejects.toThrow('Schema changed');await db.exec('ALTER TABLE fodo.items DROP COLUMN unreviewed_column');expect((await getSnapshot(db,access)).recipes).toHaveLength(100);
  const currentGeneration=seeded.generation;await db.query('UPDATE organizations SET generation=gen_random_uuid() WHERE id=$1',[organizationId]);await expect(db.exec(cleanupSql(organizationId,runId))).rejects.toThrow('Generation changed');await db.query('UPDATE organizations SET generation=$2 WHERE id=$1',[organizationId,currentGeneration]);
  await db.exec(cleanupSql(organizationId,runId));await db.exec(cleanupSql(organizationId,runId));const cleaned=await getSnapshot(db,access);expect(cleaned.items).toEqual(baseline.items);expect(cleaned.locations).toEqual(baseline.locations);expect(cleaned.generation).not.toBe(originalGeneration);expect(cleaned.generation).not.toBe(currentGeneration);expect(cleaned.entries).toEqual([]);expect(cleaned.recipes).toEqual([]);expect(cleaned.menuItems).toEqual([]);expect(cleaned.acceptedOperationIds.sort()).toEqual(baseline.acceptedOperationIds.sort());
  expect((await db.query("SELECT name FROM units WHERE organization_id='other-client'")).rows).toEqual([{name:'Keep unit'}]);
  await expect(postCommand(db,access,run.commands.waste)).rejects.toThrow(/إعادة|زامن/);
  expect((await db.query("SELECT has_table_privilege('fodo_api','fodo.sample_data_runs','SELECT') AS access")).rows[0]).toMatchObject({access:false});
 }finally{await db.close();}
},60000);
