SET LOCAL search_path=fodo,pg_catalog;
DO $guard$ DECLARE run record; signature text; BEGIN
 IF to_regclass('fodo.sample_data_runs') IS NOT NULL THEN
  FOR run IN SELECT * FROM fodo.sample_data_runs WHERE status<>'cleaned' LOOP
   SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) INTO signature
    FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN (SELECT jsonb_object_keys(run.baseline));
   IF signature IS DISTINCT FROM run.schema_signature THEN RAISE EXCEPTION 'Trial baseline differs; review before POS order migration'; END IF;
  END LOOP;
 END IF;
END $guard$;

CREATE TABLE IF NOT EXISTS pos_dining_tables(organization_id text NOT NULL REFERENCES organizations(id),id uuid NOT NULL,pos_id text NOT NULL,name text NOT NULL,seats integer NOT NULL CHECK(seats BETWEEN 1 AND 100),active boolean NOT NULL,revision integer NOT NULL CHECK(revision>0),PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,pos_id) REFERENCES points_of_sale(organization_id,id));
CREATE UNIQUE INDEX IF NOT EXISTS pos_dining_name ON pos_dining_tables(organization_id,pos_id,lower(btrim(name))) WHERE active;
CREATE TABLE IF NOT EXISTS pos_orders(organization_id text NOT NULL REFERENCES organizations(id),id uuid NOT NULL,pos_id text NOT NULL,table_id uuid,state text NOT NULL CHECK(state IN ('open','paid')),revision integer NOT NULL CHECK(revision>0),payload jsonb NOT NULL,PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,pos_id) REFERENCES points_of_sale(organization_id,id),FOREIGN KEY(organization_id,table_id) REFERENCES pos_dining_tables(organization_id,id));
CREATE UNIQUE INDEX IF NOT EXISTS pos_table_open_order ON pos_orders(organization_id,table_id) WHERE state='open' AND table_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pos_order_terminal ON pos_orders(organization_id,pos_id,state);
CREATE TABLE IF NOT EXISTS pos_shifts(organization_id text NOT NULL REFERENCES organizations(id),id uuid NOT NULL,pos_id text NOT NULL,cashier text NOT NULL,closed_at timestamptz,payload jsonb NOT NULL,PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,pos_id) REFERENCES points_of_sale(organization_id,id));
CREATE UNIQUE INDEX IF NOT EXISTS pos_cashier_open_shift ON pos_shifts(organization_id,pos_id,cashier) WHERE closed_at IS NULL;
CREATE TABLE IF NOT EXISTS pos_order_changes(organization_id text NOT NULL,operation_id uuid NOT NULL,order_id uuid NOT NULL,revision integer NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(organization_id,operation_id),UNIQUE(organization_id,order_id,revision),FOREIGN KEY(organization_id,order_id) REFERENCES pos_orders(organization_id,id));
CREATE TABLE IF NOT EXISTS pos_collections(organization_id text NOT NULL,operation_id uuid NOT NULL,method text NOT NULL CHECK(method IN ('cash','instapay','visa')),kind text NOT NULL CHECK(kind IN ('collection','refund')),order_id uuid NOT NULL,shift_id uuid NOT NULL,amount numeric(18,2) NOT NULL CHECK(amount>0),payload jsonb NOT NULL,PRIMARY KEY(organization_id,operation_id,method),FOREIGN KEY(organization_id,order_id) REFERENCES pos_orders(organization_id,id),FOREIGN KEY(organization_id,shift_id) REFERENCES pos_shifts(organization_id,id));
CREATE INDEX IF NOT EXISTS pos_collection_shift ON pos_collections(organization_id,shift_id);

DO $security$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['pos_collections','pos_order_changes','pos_orders','pos_shifts','pos_dining_tables'] LOOP
  EXECUTE format('ALTER TABLE fodo.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE fodo.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON fodo.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT,INSERT ON fodo.%I TO fodo_api',t);
  IF t IN ('pos_orders','pos_shifts','pos_dining_tables') THEN EXECUTE format('GRANT UPDATE ON fodo.%I TO fodo_api',t); END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='fodo' AND tablename=t AND policyname='pos_read') THEN
   EXECUTE format('CREATE POLICY pos_read ON fodo.%I FOR SELECT TO fodo_api USING(organization_id=current_setting(''fodo.tenant'',true))',t);
   EXECUTE format('CREATE POLICY pos_insert ON fodo.%I FOR INSERT TO fodo_api WITH CHECK(organization_id=current_setting(''fodo.tenant'',true) AND current_setting(''fodo.role'',true) IN (%s))',t,CASE WHEN t='pos_dining_tables' THEN '''owner'',''manager''' ELSE '''owner'',''manager'',''operator''' END);
   IF t IN ('pos_orders','pos_shifts','pos_dining_tables') THEN
    EXECUTE format('CREATE POLICY pos_update ON fodo.%I FOR UPDATE TO fodo_api USING(organization_id=current_setting(''fodo.tenant'',true) AND current_setting(''fodo.role'',true) IN (%s)) WITH CHECK(organization_id=current_setting(''fodo.tenant'',true) AND current_setting(''fodo.role'',true) IN (%s))',t,CASE WHEN t='pos_dining_tables' THEN '''owner'',''manager''' ELSE '''owner'',''manager'',''operator''' END,CASE WHEN t='pos_dining_tables' THEN '''owner'',''manager''' ELSE '''owner'',''manager'',''operator''' END);
   END IF;
  END IF;
 END LOOP;
END $security$;
DO $baseline$ DECLARE run record; next_baseline jsonb; t text; signature text; BEGIN
 IF to_regclass('fodo.sample_data_runs') IS NOT NULL THEN
  FOR run IN SELECT * FROM fodo.sample_data_runs WHERE status<>'cleaned' LOOP
   next_baseline=run.baseline;
   FOREACH t IN ARRAY ARRAY['pos_collections','pos_order_changes','pos_orders','pos_shifts','pos_dining_tables'] LOOP next_baseline=next_baseline||jsonb_build_object(t,COALESCE(next_baseline->t,'[]'::jsonb)); END LOOP;
   SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) INTO signature
    FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN (SELECT jsonb_object_keys(next_baseline));
   UPDATE fodo.sample_data_runs SET baseline=next_baseline,schema_signature=signature WHERE id=run.id;
  END LOOP;
 END IF;
END $baseline$;
-- A paid invoice keeps its original date. Its audited adjustment must be posted on an open day.
CREATE OR REPLACE FUNCTION fodo.fodo_check_pos_sale_day() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=fodo,pg_catalog AS $function$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM day_closures WHERE organization_id=NEW.organization_id AND location_id=NEW.location_id AND NEW.business_date<=closed_through) THEN
  RETURN NEW;
 END IF;
 IF EXISTS(
  SELECT 1 FROM pos_orders o JOIN pos_order_changes c
   ON c.organization_id=o.organization_id AND c.order_id=o.id AND c.revision=o.revision
  WHERE o.organization_id=NEW.organization_id AND o.id=NEW.import_id AND o.state='paid'
   AND c.operation_id::text=current_setting('fodo.pos_amendment',true)
   AND c.payload->>'actor'=current_setting('fodo.user',true)
   AND c.payload->'before'->>'state'='paid'
   AND o.payload->>'locationId'=NEW.location_id AND o.payload->>'businessDate'=NEW.business_date::text
   AND NOT EXISTS(SELECT 1 FROM day_closures d WHERE d.organization_id=NEW.organization_id AND d.location_id=NEW.location_id
    AND ((c.payload->>'at')::timestamptz AT TIME ZONE 'Africa/Cairo')::date<=d.closed_through)
 ) THEN
  RETURN NEW;
 END IF;
 RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FODO_PERIOD_CLOSED';
END $function$;
REVOKE ALL ON FUNCTION fodo.fodo_check_pos_sale_day() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION fodo.fodo_check_pos_sale_day() TO fodo_api;
DROP TRIGGER IF EXISTS sales_closed_day ON fodo.sales_details;
CREATE TRIGGER sales_closed_day BEFORE INSERT ON fodo.sales_details FOR EACH ROW EXECUTE FUNCTION fodo.fodo_check_pos_sale_day();
