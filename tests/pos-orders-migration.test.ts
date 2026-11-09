import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {expect,it} from 'vitest';

const sql=(file:string)=>readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');

it('adds POS tables, preserves a trial baseline and enforces hosted tenant and cashier permissions',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE fodo_api NOLOGIN;
   CREATE SCHEMA fodo; GRANT USAGE ON SCHEMA fodo TO fodo_api,anon;
   CREATE TABLE fodo.organizations(id text PRIMARY KEY);
   CREATE TABLE fodo.points_of_sale(organization_id text REFERENCES fodo.organizations,id text,PRIMARY KEY(organization_id,id));
   CREATE TABLE fodo.day_closures(organization_id text,location_id text,closed_through date);
   CREATE TABLE fodo.sales_details(organization_id text,location_id text,business_date date,import_id uuid);
   CREATE TABLE fodo.sample_data_runs(id int PRIMARY KEY,status text,baseline jsonb,schema_signature text);
   INSERT INTO fodo.sample_data_runs VALUES (1,'active','{}',NULL);
   INSERT INTO fodo.organizations VALUES ('qibli'),('other');
   INSERT INTO fodo.points_of_sale VALUES ('qibli','pos'),('other','pos');
   GRANT SELECT ON fodo.day_closures TO fodo_api;
   GRANT INSERT ON fodo.sales_details TO fodo_api;
  `);
  const migration=await sql('20261109214121_pos_orders.sql');
  await db.transaction(tx=>tx.exec(migration));
  const baseline=await db.query<{baseline:Record<string,unknown[]>}>('SELECT baseline FROM fodo.sample_data_runs');
  expect(baseline.rows[0].baseline).toEqual({
   pos_collections:[],pos_order_changes:[],pos_orders:[],pos_shifts:[],pos_dining_tables:[]
  });
  await db.transaction(tx=>tx.exec(migration));
  const tableId='00000000-0000-4000-8000-000000000001';
  const orderId='00000000-0000-4000-8000-000000000002';
  const changeId='00000000-0000-4000-8000-000000000003';
  await db.exec(`
   INSERT INTO fodo.pos_dining_tables VALUES ('other','${tableId}','pos','الطاولة',4,true,1);
   INSERT INTO fodo.day_closures VALUES ('qibli','kitchen','2026-11-08');
   SET ROLE fodo_api; SET fodo.tenant='qibli'; SET fodo.role='viewer';
   SELECT set_config('fodo.user','cashier',false);
  `);
  expect((await db.query('SELECT * FROM fodo.pos_dining_tables')).rows).toHaveLength(0);
  const newOrder=`INSERT INTO fodo.pos_orders VALUES ('qibli','${orderId}','pos',NULL,'paid',2,'{"businessDate":"2026-11-08","locationId":"kitchen"}')`;
  await expect(db.exec(newOrder)).rejects.toMatchObject({code:'42501'});
  await db.exec("SET fodo.role='operator'");
  await expect(db.exec(`INSERT INTO fodo.pos_dining_tables VALUES ('qibli','${tableId}','pos','الطاولة',4,true,1)`)).rejects.toMatchObject({code:'42501'});
  await db.exec(newOrder);
  const closedSale=`INSERT INTO fodo.sales_details VALUES ('qibli','kitchen','2026-11-08','${orderId}')`;
  await expect(db.exec(closedSale)).rejects.toThrow('FODO_PERIOD_CLOSED');
  await db.transaction(async tx=>{
   await tx.query('INSERT INTO fodo.pos_order_changes VALUES ($1,$2,$3,2,$4)',[
    'qibli',changeId,orderId,JSON.stringify({actor:'cashier',at:'2026-11-09T10:00:00Z',before:{state:'paid'}}),
   ]);
   await tx.query("SELECT set_config('fodo.pos_amendment',$1,true)",[changeId]);
   await tx.exec(closedSale);
  });
  await expect(db.exec(closedSale)).rejects.toThrow('FODO_PERIOD_CLOSED');
  await db.exec('RESET ROLE; SET ROLE anon');
  await expect(db.query('SELECT * FROM fodo.pos_orders')).rejects.toMatchObject({code:'42501'});
 }finally{await db.close();}
});
