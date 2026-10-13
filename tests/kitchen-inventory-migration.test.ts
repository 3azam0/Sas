import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {hostedBaselineSchema,organizationProfileMigration,kitchenIssueMigration,kitchenDirectoryMigration} from '../packages/server/schema';
import {kitchenInventoryMigration} from '../packages/server/kitchen-inventory-schema';
// @ts-expect-error Administrative JavaScript module
import {tables,tableSql,policySql,cleanupSql} from '../scripts/sample-data/admin.mjs';
// @ts-expect-error Administrative JavaScript module
import {kitchenInventoryMigrationSql} from '../scripts/kitchen-inventory-migration.mjs';

it('backfills tenant-scoped empty kitchen locations, enforces POS RLS and keeps an open trial restorable',async()=>{
 const db=new PGlite(),runId=randomUUID();
 try{
  await db.exec('CREATE SCHEMA fodo; SET search_path=fodo,pg_catalog; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE fodo_api;');
  await db.exec(hostedBaselineSchema+organizationProfileMigration+kitchenIssueMigration+kitchenDirectoryMigration+tableSql+policySql);
  await db.exec("INSERT INTO organizations(id,name) VALUES('one','One'),('two','Two');INSERT INTO locations(organization_id,id,name,kind) VALUES('one','main','Main','مخزن');INSERT INTO kitchens VALUES('one','k','Kitchen one',true,1),('two','k','Kitchen two',true,1);");
  const baseline:Record<string,unknown>={};for(const t of tables as string[])if(t!=='points_of_sale')baseline[t]=(await db.query(`SELECT * FROM ${t} WHERE organization_id='one'`)).rows;
  const original=(await db.query<any>("SELECT * FROM organizations WHERE id='one'")).rows[0],list=(tables as string[]).filter(t=>t!=='points_of_sale').map(t=>"'"+t+"'").join(',');
  const signature=(await db.query<any>(`SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) AS value FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN (${list})`)).rows[0].value;
  await db.query("INSERT INTO sample_data_runs(id,organization_id,dataset,status,baseline,organization_baseline,schema_signature,trial_generation) VALUES($1,'one','test','active',$2,$3,$4,$5)",[runId,JSON.stringify(baseline),JSON.stringify(original),signature,original.generation]);
  await db.exec('BEGIN;'+kitchenInventoryMigrationSql(kitchenInventoryMigration)+'COMMIT;');
  const kitchens=(await db.query<any>('SELECT * FROM kitchens ORDER BY organization_id')).rows;expect(kitchens[0].location_id).not.toBe(kitchens[1].location_id);expect((await db.query('SELECT 1 FROM stock_entries')).rows).toEqual([]);
  const security=(await db.query<any>("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='fodo.points_of_sale'::regclass")).rows[0];expect(security).toEqual({relrowsecurity:true,relforcerowsecurity:true});
  await db.exec("INSERT INTO points_of_sale VALUES('one','p','Test POS','POS','k',true,1);");
  await db.exec(cleanupSql('one',runId));expect((await db.query('SELECT 1 FROM points_of_sale')).rows).toEqual([]);expect((await db.query<any>("SELECT location_id FROM kitchens WHERE organization_id='one'")).rows[0].location_id).toBe(kitchens[0].location_id);expect((await db.query("SELECT 1 FROM kitchens WHERE organization_id='two'")).rows).toHaveLength(1);
  await db.exec('GRANT USAGE ON SCHEMA fodo TO fodo_api;');
  await db.exec("BEGIN; SET LOCAL ROLE fodo_api; SET LOCAL fodo.tenant='one';");expect((await db.query('SELECT * FROM points_of_sale')).rows).toEqual([]);await expect(db.exec("INSERT INTO points_of_sale VALUES('two','evil','Forbidden','POS','k',true,1)")).rejects.toThrow();await db.exec('ROLLBACK;');
 }finally{await db.close();}
});
