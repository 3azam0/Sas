CREATE SCHEMA IF NOT EXISTS fodo;
SET LOCAL search_path = fodo, pg_catalog;

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

CREATE TABLE IF NOT EXISTS purchase_orders(organization_id text NOT NULL REFERENCES organizations(id),order_id uuid NOT NULL,revision integer NOT NULL,state text NOT NULL,payload jsonb NOT NULL,received jsonb NOT NULL DEFAULT '{}',PRIMARY KEY(organization_id,order_id));
CREATE TABLE IF NOT EXISTS purchase_revisions(organization_id text NOT NULL,order_id uuid NOT NULL,revision integer NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(organization_id,order_id,revision),FOREIGN KEY(organization_id,order_id) REFERENCES purchase_orders(organization_id,order_id));
CREATE TABLE IF NOT EXISTS purchase_receipts(organization_id text NOT NULL,operation_id uuid NOT NULL,order_id uuid NOT NULL,payload jsonb NOT NULL,amount numeric(38,12) NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),reversed boolean NOT NULL DEFAULT false,PRIMARY KEY(organization_id,operation_id),FOREIGN KEY(organization_id,order_id) REFERENCES purchase_orders(organization_id,order_id));
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS purchase_receipt_id uuid;
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS purchase_order_line_id uuid;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_purchase_scope') THEN ALTER TABLE stock_entries ADD CONSTRAINT stock_purchase_scope FOREIGN KEY(organization_id,purchase_receipt_id) REFERENCES purchase_receipts(organization_id,operation_id); END IF; END $$;
CREATE INDEX IF NOT EXISTS purchase_receipts_order_lookup ON purchase_receipts(organization_id,order_id);
CREATE INDEX IF NOT EXISTS stock_purchase_receipt_lookup ON stock_entries(organization_id,purchase_receipt_id);
CREATE INDEX IF NOT EXISTS cost_layer_origin_lookup ON cost_layers(organization_id,sequence);


CREATE TABLE IF NOT EXISTS supplier_returns(organization_id text NOT NULL,operation_id uuid NOT NULL,receipt_id uuid NOT NULL,payload jsonb NOT NULL,amount numeric(38,12) NOT NULL CHECK(amount>=0),posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id),FOREIGN KEY(organization_id,receipt_id) REFERENCES purchase_receipts(organization_id,operation_id));
ALTER TABLE supplier_returns ADD COLUMN IF NOT EXISTS inventory_amount numeric(38,12);
CREATE TABLE IF NOT EXISTS supplier_return_lines(organization_id text NOT NULL,return_id uuid NOT NULL,movement_id uuid NOT NULL,source_movement_id uuid NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),amount numeric(30,12) NOT NULL CHECK(amount>=0),PRIMARY KEY(organization_id,movement_id),FOREIGN KEY(organization_id,return_id) REFERENCES supplier_returns(organization_id,operation_id),FOREIGN KEY(organization_id,source_movement_id) REFERENCES stock_entries(organization_id,operation_id),FOREIGN KEY(organization_id,movement_id) REFERENCES stock_entries(organization_id,operation_id));
CREATE INDEX IF NOT EXISTS supplier_return_receipt_lookup ON supplier_returns(organization_id,receipt_id);
CREATE INDEX IF NOT EXISTS supplier_return_document_lookup ON supplier_return_lines(organization_id,return_id);
CREATE INDEX IF NOT EXISTS supplier_return_source_lookup ON supplier_return_lines(organization_id,source_movement_id);
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS supplier_return_id uuid;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_return_scope') THEN ALTER TABLE stock_entries ADD CONSTRAINT stock_return_scope FOREIGN KEY(organization_id,supplier_return_id) REFERENCES supplier_returns(organization_id,operation_id); END IF; END $$;
CREATE INDEX IF NOT EXISTS stock_return_lookup ON stock_entries(organization_id,supplier_return_id);


CREATE TABLE IF NOT EXISTS transfers(organization_id text NOT NULL REFERENCES organizations(id),transfer_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),source_id text NOT NULL,destination_id text NOT NULL,payload jsonb NOT NULL,amount numeric(38,12) NOT NULL CHECK(amount>=0),posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,transfer_id),CHECK(source_id<>destination_id),FOREIGN KEY(organization_id,source_id) REFERENCES locations(organization_id,id),FOREIGN KEY(organization_id,destination_id) REFERENCES locations(organization_id,id));
CREATE INDEX IF NOT EXISTS transfer_source_lookup ON transfers(organization_id,source_id);
CREATE INDEX IF NOT EXISTS transfer_destination_lookup ON transfers(organization_id,destination_id);
CREATE TABLE IF NOT EXISTS transfer_segments(organization_id text NOT NULL,transfer_id uuid NOT NULL,dispatch_line_id uuid NOT NULL,layer_id uuid NOT NULL,ordinal integer NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),received numeric(18,6) NOT NULL DEFAULT 0 CHECK(received>=0),lost numeric(18,6) NOT NULL DEFAULT 0 CHECK(lost>=0),unit_cost numeric(18,6) NOT NULL CHECK(unit_cost>=0),PRIMARY KEY(organization_id,dispatch_line_id,layer_id),CHECK(received+lost<=quantity),FOREIGN KEY(organization_id,transfer_id) REFERENCES transfers(organization_id,transfer_id),FOREIGN KEY(organization_id,dispatch_line_id) REFERENCES stock_entries(organization_id,operation_id),FOREIGN KEY(organization_id,layer_id) REFERENCES cost_layers(organization_id,id));
ALTER TABLE transfer_segments ADD COLUMN IF NOT EXISTS initial_value numeric(30,12);
ALTER TABLE transfer_segments ADD COLUMN IF NOT EXISTS remaining_value numeric(30,12) CHECK(remaining_value>=0);
CREATE INDEX IF NOT EXISTS transfer_segment_document_lookup ON transfer_segments(organization_id,transfer_id);
CREATE INDEX IF NOT EXISTS transfer_segment_layer_lookup ON transfer_segments(organization_id,layer_id);
CREATE TABLE IF NOT EXISTS transfer_actions(organization_id text NOT NULL,operation_id uuid NOT NULL,transfer_id uuid NOT NULL,payload jsonb NOT NULL,amount numeric(38,12) NOT NULL CHECK(amount>=0),posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id),FOREIGN KEY(organization_id,transfer_id) REFERENCES transfers(organization_id,transfer_id));
CREATE INDEX IF NOT EXISTS transfer_action_document_lookup ON transfer_actions(organization_id,transfer_id);
CREATE TABLE IF NOT EXISTS transfer_allocations(organization_id text NOT NULL,operation_id uuid NOT NULL,action_id uuid NOT NULL,dispatch_line_id uuid NOT NULL,layer_id uuid NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),amount numeric(30,12) NOT NULL CHECK(amount>=0),PRIMARY KEY(organization_id,operation_id,layer_id),FOREIGN KEY(organization_id,action_id) REFERENCES transfer_actions(organization_id,operation_id),FOREIGN KEY(organization_id,dispatch_line_id,layer_id) REFERENCES transfer_segments(organization_id,dispatch_line_id,layer_id));
CREATE INDEX IF NOT EXISTS transfer_allocation_action_lookup ON transfer_allocations(organization_id,action_id);
CREATE INDEX IF NOT EXISTS transfer_allocation_segment_lookup ON transfer_allocations(organization_id,dispatch_line_id,layer_id);
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS transfer_id uuid;
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS transfer_line_id uuid;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_transfer_scope') THEN ALTER TABLE stock_entries ADD CONSTRAINT stock_transfer_scope FOREIGN KEY(organization_id,transfer_id) REFERENCES transfers(organization_id,transfer_id); END IF; END $$;
CREATE INDEX IF NOT EXISTS stock_transfer_lookup ON stock_entries(organization_id,transfer_id);


CREATE TABLE IF NOT EXISTS stock_counts(organization_id text NOT NULL REFERENCES organizations(id),count_id uuid NOT NULL,location_id text NOT NULL,revision integer NOT NULL CHECK(revision>0),state text NOT NULL CHECK(state IN ('draft','finalized','cancelled')),payload jsonb NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,count_id),FOREIGN KEY(organization_id,location_id) REFERENCES locations(organization_id,id));
CREATE INDEX IF NOT EXISTS count_location_lookup ON stock_counts(organization_id,location_id);
CREATE TABLE IF NOT EXISTS count_revisions(organization_id text NOT NULL,count_id uuid NOT NULL,revision integer NOT NULL,payload jsonb NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,count_id,revision),FOREIGN KEY(organization_id,count_id) REFERENCES stock_counts(organization_id,count_id));
CREATE TABLE IF NOT EXISTS count_finalizations(organization_id text NOT NULL,operation_id uuid NOT NULL,count_id uuid NOT NULL,payload jsonb NOT NULL,changes jsonb NOT NULL,amount numeric(38,12) NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id),UNIQUE(organization_id,count_id),FOREIGN KEY(organization_id,count_id) REFERENCES stock_counts(organization_id,count_id));
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS count_id uuid;
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS count_line_id uuid;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_count_scope') THEN ALTER TABLE stock_entries ADD CONSTRAINT stock_count_scope FOREIGN KEY(organization_id,count_id) REFERENCES stock_counts(organization_id,count_id); END IF; END $$;
CREATE INDEX IF NOT EXISTS stock_count_lookup ON stock_entries(organization_id,count_id);
CREATE INDEX IF NOT EXISTS stock_location_sequence_lookup ON stock_entries(organization_id,location_id,sequence);
CREATE INDEX IF NOT EXISTS stock_location_item_lookup ON stock_entries(organization_id,location_id,item_id);


CREATE TABLE IF NOT EXISTS recipes(organization_id text NOT NULL REFERENCES organizations(id),recipe_id uuid NOT NULL,code text NOT NULL,revision integer NOT NULL,state text NOT NULL CHECK(state IN ('draft','published')),payload jsonb NOT NULL,published_version_id uuid,PRIMARY KEY(organization_id,recipe_id),UNIQUE(organization_id,code));
CREATE TABLE IF NOT EXISTS recipe_versions(organization_id text NOT NULL,version_id uuid NOT NULL,recipe_id uuid NOT NULL,version_number integer NOT NULL,payload jsonb NOT NULL,published_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,version_id),UNIQUE(organization_id,recipe_id,version_number),FOREIGN KEY(organization_id,recipe_id) REFERENCES recipes(organization_id,recipe_id));
CREATE TABLE IF NOT EXISTS recipe_dependencies(organization_id text NOT NULL,version_id uuid NOT NULL,child_version_id uuid NOT NULL,PRIMARY KEY(organization_id,version_id,child_version_id),FOREIGN KEY(organization_id,version_id) REFERENCES recipe_versions(organization_id,version_id),FOREIGN KEY(organization_id,child_version_id) REFERENCES recipe_versions(organization_id,version_id));
CREATE INDEX IF NOT EXISTS recipe_dependency_child ON recipe_dependencies(organization_id,child_version_id);
CREATE TABLE IF NOT EXISTS recipe_revisions(organization_id text NOT NULL,recipe_id uuid NOT NULL,revision integer NOT NULL,operation_id uuid NOT NULL,payload jsonb NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,recipe_id,revision),UNIQUE(organization_id,operation_id),FOREIGN KEY(organization_id,recipe_id) REFERENCES recipes(organization_id,recipe_id));
CREATE INDEX IF NOT EXISTS receipt_cost_lookup ON stock_entries(organization_id,location_id,item_id,sequence DESC) WHERE quantity>0 AND type IN ('receipt.post','purchase.receive');


CREATE TABLE IF NOT EXISTS production_batches(organization_id text NOT NULL REFERENCES organizations(id),operation_id uuid NOT NULL,version_id uuid NOT NULL,input_location_id text NOT NULL,output_location_id text NOT NULL,output_item_id text NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id),FOREIGN KEY(organization_id,version_id) REFERENCES recipe_versions(organization_id,version_id),FOREIGN KEY(organization_id,input_location_id) REFERENCES locations(organization_id,id),FOREIGN KEY(organization_id,output_location_id) REFERENCES locations(organization_id,id),FOREIGN KEY(organization_id,output_item_id) REFERENCES items(organization_id,id));
CREATE INDEX IF NOT EXISTS production_version_lookup ON production_batches(organization_id,version_id);
CREATE INDEX IF NOT EXISTS production_input_lookup ON production_batches(organization_id,input_location_id);
CREATE INDEX IF NOT EXISTS production_output_lookup ON production_batches(organization_id,output_location_id);
CREATE INDEX IF NOT EXISTS production_item_lookup ON production_batches(organization_id,output_item_id);
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS production_id uuid;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_production_scope') THEN ALTER TABLE stock_entries ADD CONSTRAINT stock_production_scope FOREIGN KEY(organization_id,production_id) REFERENCES production_batches(organization_id,operation_id); END IF; END $$;
CREATE INDEX IF NOT EXISTS stock_production_lookup ON stock_entries(organization_id,production_id);


CREATE TABLE IF NOT EXISTS menu_items(organization_id text NOT NULL REFERENCES organizations(id),id uuid NOT NULL,source text NOT NULL,code text NOT NULL,revision integer NOT NULL,version_id uuid NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(organization_id,id),UNIQUE(organization_id,source,code),FOREIGN KEY(organization_id,version_id) REFERENCES recipe_versions(organization_id,version_id));
CREATE INDEX IF NOT EXISTS menu_version_lookup ON menu_items(organization_id,version_id);
CREATE TABLE IF NOT EXISTS sales_imports(organization_id text NOT NULL REFERENCES organizations(id),operation_id uuid NOT NULL,location_id text NOT NULL,result jsonb NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id),FOREIGN KEY(organization_id,location_id) REFERENCES locations(organization_id,id));
CREATE INDEX IF NOT EXISTS sales_import_location ON sales_imports(organization_id,location_id);
CREATE TABLE IF NOT EXISTS sales_details(organization_id text NOT NULL,source text NOT NULL,location_id text NOT NULL,business_date date NOT NULL,transaction_id text NOT NULL,line_key text NOT NULL,line_id uuid NOT NULL,import_id uuid NOT NULL,menu_item_id uuid NOT NULL,version_id uuid NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(organization_id,source,location_id,business_date,transaction_id,line_key),UNIQUE(organization_id,line_id),FOREIGN KEY(organization_id,import_id) REFERENCES sales_imports(organization_id,operation_id),FOREIGN KEY(organization_id,menu_item_id) REFERENCES menu_items(organization_id,id),FOREIGN KEY(organization_id,version_id) REFERENCES recipe_versions(organization_id,version_id));
CREATE INDEX IF NOT EXISTS sales_detail_import ON sales_details(organization_id,import_id);
CREATE INDEX IF NOT EXISTS sales_detail_menu ON sales_details(organization_id,menu_item_id);
CREATE INDEX IF NOT EXISTS sales_detail_version ON sales_details(organization_id,version_id);
CREATE INDEX IF NOT EXISTS sales_detail_location ON sales_details(organization_id,location_id,business_date);


CREATE TABLE IF NOT EXISTS user_access(user_id uuid PRIMARY KEY REFERENCES auth.users(id),organization_id text NOT NULL REFERENCES organizations(id),active boolean NOT NULL DEFAULT true);
CREATE INDEX IF NOT EXISTS user_access_organization ON user_access(organization_id);
CREATE TABLE IF NOT EXISTS provision_challenges(token_hash text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),email text NOT NULL,expires_at timestamptz NOT NULL,used_at timestamptz);
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='fodo_api') THEN CREATE ROLE fodo_api NOLOGIN NOINHERIT; END IF; END $$;
GRANT fodo_api TO postgres;
REVOKE ALL ON SCHEMA fodo FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA fodo TO fodo_api;
DO $$ DECLARE t record; col text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='fodo' LOOP
  EXECUTE format('ALTER TABLE fodo.%I ENABLE ROW LEVEL SECURITY',t.tablename);
  EXECUTE format('REVOKE ALL ON fodo.%I FROM PUBLIC,anon,authenticated',t.tablename);
  IF t.tablename NOT IN ('user_access','provision_challenges') THEN
   col:=CASE WHEN t.tablename='organizations' THEN 'id' ELSE 'organization_id' END;
   EXECUTE format('ALTER TABLE fodo.%I FORCE ROW LEVEL SECURITY',t.tablename);
   EXECUTE format('CREATE POLICY tenant_scope ON fodo.%I TO fodo_api USING (%I = current_setting(''fodo.tenant'',true)) WITH CHECK (%I = current_setting(''fodo.tenant'',true))',t.tablename,col,col);
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON fodo.%I TO fodo_api',t.tablename);
  END IF;
 END LOOP;
END $$;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA fodo TO fodo_api;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA fodo FROM PUBLIC,anon,authenticated;
