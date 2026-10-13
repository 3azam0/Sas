import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {kitchenInventoryMigration} from '../packages/server/kitchen-inventory-schema';
// @ts-expect-error administrative JavaScript module
import {kitchenInventoryMigrationSql} from '../scripts/kitchen-inventory-migration.mjs';
import {hostedBaselineSchema,organizationProfileMigration,kitchenIssueMigration,kitchenDirectoryMigration} from '../packages/server/schema';
// @ts-expect-error administrative JavaScript module
import {tableSql,policySql,captureSql,cleanupSql} from '../scripts/sample-data/admin.mjs';
// @ts-expect-error administrative JavaScript module
import {kitchenIssueMigrationSql} from '../scripts/kitchen-issue-migration.mjs';
// @ts-expect-error administrative JavaScript module
import {kitchenDirectoryMigrationSql} from '../scripts/kitchen-directory-migration.mjs';
it('extends a previous private trial baseline safely and retains guarded cleanup and tenant RLS',async()=>{
 const db=new PGlite(),run=randomUUID();try{
  await db.exec('CREATE SCHEMA fodo; SET search_path=fodo,pg_catalog; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE fodo_api;');await db.exec(hostedBaselineSchema+organizationProfileMigration);await db.exec(tableSql+policySql);await db.exec("INSERT INTO organizations(id,name) VALUES('trial','Trial'),('other','Other');");
  // The backup was captured before the new table/column existed.
  await db.exec(captureSql('trial',run).replaceAll("'kitchen_issues',",'').replaceAll("'kitchens',",'').replaceAll("'points_of_sale',",''));
  const sql=kitchenIssueMigrationSql(kitchenIssueMigration);
  await db.exec('ALTER TABLE items ADD COLUMN unreviewed text');await expect(db.exec(sql)).rejects.toThrow('differs');await db.exec('ALTER TABLE items DROP COLUMN unreviewed');await db.exec(sql);
  expect((await db.query<{count:number}>("SELECT jsonb_array_length(baseline->'kitchen_issues') AS count FROM sample_data_runs WHERE id=$1",[run])).rows[0].count).toBe(0);
  expect((await db.query<{rls:boolean;forced:boolean}>("SELECT relrowsecurity AS rls,relforcerowsecurity AS forced FROM pg_class WHERE oid='fodo.kitchen_issues'::regclass")).rows[0]).toEqual({rls:true,forced:true});
  expect((await db.query<{allowed:boolean}>("SELECT has_table_privilege('authenticated','fodo.kitchen_issues','SELECT') AS allowed")).rows[0].allowed).toBe(false);
  const directory=kitchenDirectoryMigrationSql(kitchenDirectoryMigration);await db.exec(directory);
  expect((await db.query<{count:number}>("SELECT jsonb_array_length(baseline->'kitchens') AS count FROM sample_data_runs WHERE id=$1",[run])).rows[0].count).toBe(0);
  expect((await db.query<{allowed:boolean}>("SELECT has_table_privilege('authenticated','fodo.kitchens','SELECT') AS allowed")).rows[0].allowed).toBe(false);
  await db.exec("INSERT INTO kitchens VALUES('trial','k1','Kitchen',true,1);");
  await db.exec(kitchenInventoryMigrationSql(kitchenInventoryMigration));
  await db.exec(cleanupSql('trial',run));expect((await db.query<{status:string}>('SELECT status FROM sample_data_runs WHERE id=$1',[run])).rows[0].status).toBe('cleaned');
 }finally{await db.close();}
});
