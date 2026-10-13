import {kitchenInventoryMigration} from './kitchen-inventory-schema';
import {salesTables} from './sales';
import {productionTables} from './production';
import {recipeTables} from './recipes';
import {countTables} from './counts';
import {transferTables} from './transfers';
import {returnTables} from './supplier-returns';
import {purchaseTables} from './purchasing';
// Frozen bootstrap used by the initial hosted migration. Append later changes below.
export const hostedBaselineSchema = `
CREATE TABLE IF NOT EXISTS organizations (id text PRIMARY KEY, name text NOT NULL);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS costing_method text NOT NULL DEFAULT 'moving_average' CHECK(costing_method IN ('fifo','moving_average'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS costing_revision integer NOT NULL DEFAULT 1;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS generation uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS development_baseline boolean NOT NULL DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS development_empty_baseline boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS locations (organization_id text REFERENCES organizations(id), id text, name text NOT NULL, kind text NOT NULL, PRIMARY KEY(organization_id,id));
CREATE TABLE IF NOT EXISTS items (organization_id text REFERENCES organizations(id), id text, name text NOT NULL, sku text NOT NULL, category text NOT NULL, unit text NOT NULL, minimum numeric(18,6) NOT NULL, PRIMARY KEY(organization_id,id), UNIQUE(organization_id,sku));
CREATE TABLE IF NOT EXISTS command_receipts (organization_id text REFERENCES organizations(id), operation_id uuid, payload_hash text NOT NULL, result jsonb NOT NULL, PRIMARY KEY(organization_id,operation_id));
CREATE TABLE IF NOT EXISTS stock_entries (sequence bigserial PRIMARY KEY, organization_id text NOT NULL, operation_id uuid NOT NULL, location_id text NOT NULL, item_id text NOT NULL, quantity numeric(18,6) NOT NULL, amount numeric(30,12) NOT NULL, type text NOT NULL, reason text NOT NULL, business_date date NOT NULL, posted_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(organization_id,location_id) REFERENCES locations(organization_id,id), FOREIGN KEY(organization_id,item_id) REFERENCES items(organization_id,id), UNIQUE(organization_id,operation_id));
CREATE TABLE IF NOT EXISTS cost_layers (organization_id text NOT NULL, id uuid, location_id text NOT NULL, item_id text NOT NULL, remaining numeric(18,6) NOT NULL CHECK(remaining>=0), unit_cost numeric(18,6) NOT NULL CHECK(unit_cost>=0), sequence bigint NOT NULL, PRIMARY KEY(organization_id,id), FOREIGN KEY(organization_id,location_id) REFERENCES locations(organization_id,id), FOREIGN KEY(organization_id,item_id) REFERENCES items(organization_id,id));
ALTER TABLE cost_layers ADD COLUMN IF NOT EXISTS remaining_value numeric(30,12) CHECK(remaining_value>=0);
CREATE TABLE IF NOT EXISTS stock_balances (organization_id text NOT NULL, location_id text, item_id text, quantity numeric(18,6) NOT NULL CHECK(quantity>=0), value numeric(30,12) NOT NULL CHECK(value>=0), PRIMARY KEY(organization_id,location_id,item_id), FOREIGN KEY(organization_id,location_id) REFERENCES locations(organization_id,id), FOREIGN KEY(organization_id,item_id) REFERENCES items(organization_id,id));
CREATE TABLE IF NOT EXISTS layer_allocations (organization_id text NOT NULL, operation_id uuid, layer_id uuid, quantity numeric(18,6) NOT NULL CHECK(quantity>0), amount numeric(30,12) NOT NULL CHECK(amount>=0), PRIMARY KEY(organization_id,operation_id,layer_id), FOREIGN KEY(organization_id,layer_id) REFERENCES cost_layers(organization_id,id));
CREATE TABLE IF NOT EXISTS audit_events (id bigserial PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id), actor text NOT NULL, operation_id uuid NOT NULL, action text NOT NULL, posted_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS fifo_lookup ON cost_layers(organization_id,location_id,item_id,sequence);
CREATE TABLE IF NOT EXISTS opening_documents(organization_id text NOT NULL REFERENCES organizations(id),operation_id uuid NOT NULL,payload jsonb NOT NULL,amount numeric(38,12) NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id));
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS opening_document_id uuid;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_opening_scope') THEN
  ALTER TABLE stock_entries ADD CONSTRAINT stock_opening_scope FOREIGN KEY(organization_id,opening_document_id) REFERENCES opening_documents(organization_id,operation_id);
 END IF;
END $$;

-- Additive setup migration: preserve all existing stock and operation IDs.
CREATE TABLE IF NOT EXISTS units (organization_id text NOT NULL REFERENCES organizations(id), id text NOT NULL, name text NOT NULL, revision integer NOT NULL DEFAULT 1, PRIMARY KEY(organization_id,id), UNIQUE(organization_id,name));
CREATE TABLE IF NOT EXISTS suppliers (organization_id text NOT NULL REFERENCES organizations(id), id text NOT NULL, name text NOT NULL, phone text NOT NULL, email text NOT NULL, address text NOT NULL, active boolean NOT NULL DEFAULT true, revision integer NOT NULL DEFAULT 1, PRIMARY KEY(organization_id,id));
ALTER TABLE items ADD COLUMN IF NOT EXISTS unit_id text;
ALTER TABLE items ADD COLUMN IF NOT EXISTS purchase_units jsonb NOT NULL DEFAULT '[]';
ALTER TABLE items ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE items ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS reference_amount numeric(30,12);
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS supplier_id text;
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS purchase_unit_id uuid;
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS entered_quantity numeric(18,6);
INSERT INTO units(organization_id,id,name) SELECT DISTINCT organization_id,unit,unit FROM items WHERE unit_id IS NULL ON CONFLICT DO NOTHING;
UPDATE items SET unit_id=unit WHERE unit_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='items_unit_scope') THEN
    ALTER TABLE items ADD CONSTRAINT items_unit_scope FOREIGN KEY(organization_id,unit_id) REFERENCES units(organization_id,id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='stock_supplier_scope') THEN
    ALTER TABLE stock_entries ADD CONSTRAINT stock_supplier_scope FOREIGN KEY(organization_id,supplier_id) REFERENCES suppliers(organization_id,id);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS receipt_documents(organization_id text NOT NULL REFERENCES organizations(id),operation_id uuid NOT NULL,payload jsonb NOT NULL,amount numeric(38,12) NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id));
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS receipt_document_id uuid;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_receipt_document_scope') THEN
  ALTER TABLE stock_entries ADD CONSTRAINT stock_receipt_document_scope FOREIGN KEY(organization_id,receipt_document_id) REFERENCES receipt_documents(organization_id,operation_id);
 END IF;
END $$;
${purchaseTables}
${returnTables}
${transferTables}
${countTables}
${recipeTables}
${productionTables}
${salesTables}
`;
export const organizationProfileMigration="ALTER TABLE organizations ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(profile)='object');\n";
export const kitchenIssueMigration=`
CREATE TABLE IF NOT EXISTS kitchen_issues(
 organization_id text NOT NULL REFERENCES organizations(id),operation_id uuid NOT NULL,payload jsonb NOT NULL,
 amount numeric(38,12) NOT NULL CHECK(amount>=0),method text NOT NULL CHECK(method IN ('fifo','moving_average')),
 lines jsonb NOT NULL,actor text NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id)
);
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS kitchen_issue_id uuid;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_kitchen_issue_scope' AND conrelid='stock_entries'::regclass) THEN
 ALTER TABLE stock_entries ADD CONSTRAINT stock_kitchen_issue_scope FOREIGN KEY(organization_id,kitchen_issue_id) REFERENCES kitchen_issues(organization_id,operation_id);
END IF; END $$;
CREATE INDEX IF NOT EXISTS kitchen_issue_tenant_date ON kitchen_issues(organization_id,posted_at DESC);
CREATE INDEX IF NOT EXISTS entry_kitchen_issue ON stock_entries(organization_id,kitchen_issue_id);
`;
export const kitchenDirectoryMigration=`
CREATE TABLE IF NOT EXISTS kitchens(
 organization_id text NOT NULL REFERENCES organizations(id),id text NOT NULL,name text NOT NULL,
 active boolean NOT NULL DEFAULT true,revision integer NOT NULL CHECK(revision>0),PRIMARY KEY(organization_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS kitchen_active_name ON kitchens(organization_id,lower(btrim(name))) WHERE active;
ALTER TABLE kitchen_issues ADD COLUMN IF NOT EXISTS kitchen_id text;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='kitchen_recipient_scope' AND conrelid='kitchen_issues'::regclass) THEN
 ALTER TABLE kitchen_issues ADD CONSTRAINT kitchen_recipient_scope FOREIGN KEY(organization_id,kitchen_id) REFERENCES kitchens(organization_id,id);
END IF; END $$;
`;
export {kitchenInventoryMigration} from './kitchen-inventory-schema';
export const schema=hostedBaselineSchema+organizationProfileMigration+kitchenIssueMigration+kitchenDirectoryMigration+kitchenInventoryMigration;
