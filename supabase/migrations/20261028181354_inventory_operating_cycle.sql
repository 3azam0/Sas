-- Additive inventory operating cycle; the sole existing active account retains owner access.
SET search_path = fodo, pg_catalog;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='user_access' AND column_name='role') AND EXISTS(SELECT organization_id FROM user_access WHERE active GROUP BY organization_id HAVING count(*)>1) THEN
  RAISE EXCEPTION 'OWNER_MAPPING_REQUIRED: assign the owner before migrating multiple existing active accounts';
 END IF;
END $$;

ALTER TABLE cost_layers ADD COLUMN IF NOT EXISTS lot jsonb;
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS lot jsonb;
CREATE INDEX IF NOT EXISTS cost_layer_expiry ON cost_layers(organization_id,((lot->>'expiresOn'))) WHERE remaining>0 AND lot IS NOT NULL;
CREATE TABLE IF NOT EXISTS user_access(user_id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),active boolean NOT NULL DEFAULT true);
ALTER TABLE user_access ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'owner' CHECK(role IN ('owner','manager','operator','viewer'));
ALTER TABLE user_access ALTER COLUMN role SET DEFAULT 'operator';
ALTER TABLE user_access ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS day_closures(organization_id text NOT NULL REFERENCES organizations(id),location_id text NOT NULL,closed_through date,revision integer NOT NULL CHECK(revision>0),actor text NOT NULL,reason text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,location_id),FOREIGN KEY(organization_id,location_id) REFERENCES locations(organization_id,id));
CREATE TABLE IF NOT EXISTS inventory_control_events(organization_id text NOT NULL REFERENCES organizations(id),operation_id uuid NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,actor text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id));
CREATE INDEX IF NOT EXISTS inventory_control_event_date ON inventory_control_events(organization_id,created_at DESC);
CREATE OR REPLACE FUNCTION fodo_check_closed_day() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM day_closures c WHERE c.organization_id=NEW.organization_id AND c.location_id=NEW.location_id AND NEW.business_date<=c.closed_through) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FODO_PERIOD_CLOSED';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS inventory_closed_day ON stock_entries;
CREATE TRIGGER inventory_closed_day BEFORE INSERT OR UPDATE OF business_date,location_id,quantity,amount ON stock_entries FOR EACH ROW EXECUTE FUNCTION fodo_check_closed_day();
DROP TRIGGER IF EXISTS sales_closed_day ON sales_details;
CREATE TRIGGER sales_closed_day BEFORE INSERT ON sales_details FOR EACH ROW EXECUTE FUNCTION fodo_check_closed_day();
DROP TRIGGER IF EXISTS finance_closed_day ON finance_entries;
CREATE TRIGGER finance_closed_day BEFORE INSERT ON finance_entries FOR EACH ROW EXECUTE FUNCTION fodo_check_closed_day();
CREATE OR REPLACE FUNCTION fodo_check_inventory_actor() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor text:=current_setting('fodo.user',true); actual_role text;
BEGIN
 IF actor IS NOT NULL AND actor<>'' THEN
  SELECT role INTO actual_role FROM user_access WHERE user_id::text=actor AND organization_id=NEW.organization_id AND active;
  IF actual_role IS NULL OR actual_role='viewer' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FODO_WRITE_FORBIDDEN'; END IF;
  IF TG_TABLE_NAME='count_finalizations' AND actual_role NOT IN ('owner','manager') THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FODO_APPROVAL_REQUIRED'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS inventory_actor ON command_receipts;
CREATE TRIGGER inventory_actor BEFORE INSERT ON command_receipts FOR EACH ROW EXECUTE FUNCTION fodo_check_inventory_actor();
DROP TRIGGER IF EXISTS count_approver ON count_finalizations;
CREATE TRIGGER count_approver BEFORE INSERT ON count_finalizations FOR EACH ROW EXECUTE FUNCTION fodo_check_inventory_actor();

CREATE INDEX IF NOT EXISTS inventory_member_scope ON user_access(organization_id,user_id);
CREATE INDEX IF NOT EXISTS inventory_active_owner ON user_access(organization_id) WHERE active AND role='owner';
ALTER TABLE day_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_closures FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory_control_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_control_events FORCE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON day_closures TO fodo_api;
GRANT SELECT,INSERT ON inventory_control_events TO fodo_api;
CREATE POLICY inventory_closure_read ON day_closures FOR SELECT TO fodo_api USING(organization_id=current_setting('fodo.tenant',true));
CREATE POLICY inventory_closure_insert ON day_closures FOR INSERT TO fodo_api WITH CHECK(organization_id=current_setting('fodo.tenant',true) AND current_setting('fodo.role',true) IN ('owner','manager'));
CREATE POLICY inventory_closure_update ON day_closures FOR UPDATE TO fodo_api USING(organization_id=current_setting('fodo.tenant',true) AND current_setting('fodo.role',true) IN ('owner','manager')) WITH CHECK(organization_id=current_setting('fodo.tenant',true) AND current_setting('fodo.role',true) IN ('owner','manager'));
CREATE POLICY inventory_event_read ON inventory_control_events FOR SELECT TO fodo_api USING(organization_id=current_setting('fodo.tenant',true));
CREATE POLICY inventory_event_insert ON inventory_control_events FOR INSERT TO fodo_api WITH CHECK(organization_id=current_setting('fodo.tenant',true) AND current_setting('fodo.role',true) IN ('owner','manager','operator'));
GRANT SELECT ON user_access TO fodo_api;
GRANT UPDATE(role,display_name) ON user_access TO fodo_api;
CREATE POLICY inventory_membership_read ON user_access FOR SELECT TO fodo_api USING(organization_id=current_setting('fodo.tenant',true) AND (user_id::text=current_setting('fodo.user',true) OR current_setting('fodo.role',true)='owner'));
CREATE POLICY inventory_membership_update ON user_access FOR UPDATE TO fodo_api USING(organization_id=current_setting('fodo.tenant',true) AND current_setting('fodo.role',true)='owner') WITH CHECK(organization_id=current_setting('fodo.tenant',true) AND current_setting('fodo.role',true)='owner');
REVOKE ALL ON FUNCTION fodo_check_closed_day() FROM PUBLIC;
REVOKE ALL ON FUNCTION fodo_check_inventory_actor() FROM PUBLIC;
ALTER FUNCTION fodo_check_closed_day() SET search_path = fodo, pg_catalog;
ALTER FUNCTION fodo_check_inventory_actor() SET search_path = fodo, pg_catalog;
GRANT EXECUTE ON FUNCTION fodo_check_closed_day(),fodo_check_inventory_actor() TO fodo_api;
