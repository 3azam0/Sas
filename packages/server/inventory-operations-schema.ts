/** Additive schema. Historical sources without lot metadata remain explicitly unknown. */
export const inventoryOperationsTables=`
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
`;
