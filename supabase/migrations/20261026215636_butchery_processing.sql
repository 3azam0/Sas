SET LOCAL search_path=fodo,pg_catalog;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM fodo.sample_data_runs WHERE status<>'cleaned' AND schema_signature<>(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN ('pos_kitchen_actions','finance_entries','sales_details','sales_imports','transfer_allocations','transfer_segments','supplier_return_lines','layer_allocations','cost_layers','stock_entries','production_batches','stock_balances','transfer_actions','transfers','supplier_returns','purchase_receipts','purchase_revisions','purchase_orders','count_finalizations','count_revisions','stock_counts','opening_documents','receipt_documents','kitchen_issues','menu_items','recipe_dependencies','recipe_versions','recipe_revisions','recipes','command_receipts','audit_events','items','suppliers','units','points_of_sale','kitchens','locations'))) THEN RAISE EXCEPTION 'Trial baseline differs; review before butchery migration'; END IF;
 IF to_regclass('fodo.butchery_catalog') IS NOT NULL OR to_regclass('fodo.butchery_batches') IS NOT NULL OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='fodo' AND table_name='stock_entries' AND column_name='butchery_id') THEN RAISE EXCEPTION 'Butchery schema already exists; review migration history before continuing'; END IF;
END $guard$;

CREATE TABLE IF NOT EXISTS butchery_catalog(organization_id text NOT NULL REFERENCES organizations(id),item_id text NOT NULL,unit_id text NOT NULL,meat_kind text NOT NULL CHECK(meat_kind IN ('beef_input','sheep_live','beef_product','lamb_product')),PRIMARY KEY(organization_id,item_id),FOREIGN KEY(organization_id,item_id) REFERENCES items(organization_id,id),FOREIGN KEY(organization_id,unit_id) REFERENCES units(organization_id,id));
CREATE TABLE IF NOT EXISTS butchery_batches(organization_id text NOT NULL REFERENCES organizations(id),operation_id uuid NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id));
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS butchery_id uuid;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_butchery_scope' AND conrelid='stock_entries'::regclass) THEN ALTER TABLE stock_entries ADD CONSTRAINT stock_butchery_scope FOREIGN KEY(organization_id,butchery_id) REFERENCES butchery_batches(organization_id,operation_id); END IF; END $$;
CREATE INDEX IF NOT EXISTS stock_butchery_lookup ON stock_entries(organization_id,butchery_id);
CREATE INDEX IF NOT EXISTS butchery_posted_lookup ON butchery_batches(organization_id,posted_at DESC);

ALTER TABLE butchery_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE butchery_catalog FORCE ROW LEVEL SECURITY;
ALTER TABLE butchery_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE butchery_batches FORCE ROW LEVEL SECURITY;
REVOKE ALL ON butchery_catalog,butchery_batches FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON butchery_catalog,butchery_batches TO fodo_api;
CREATE POLICY tenant_scope ON butchery_catalog TO fodo_api USING(organization_id=current_setting('fodo.tenant',true)) WITH CHECK(organization_id=current_setting('fodo.tenant',true));
CREATE POLICY tenant_scope ON butchery_batches TO fodo_api USING(organization_id=current_setting('fodo.tenant',true)) WITH CHECK(organization_id=current_setting('fodo.tenant',true));

UPDATE fodo.sample_data_runs SET baseline=baseline||jsonb_build_object('butchery_catalog','[]'::jsonb,'butchery_batches','[]'::jsonb),schema_signature=(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN ('pos_kitchen_actions','finance_entries','sales_details','sales_imports','transfer_allocations','transfer_segments','supplier_return_lines','layer_allocations','cost_layers','stock_entries','butchery_batches','production_batches','stock_balances','transfer_actions','transfers','supplier_returns','purchase_receipts','purchase_revisions','purchase_orders','count_finalizations','count_revisions','stock_counts','opening_documents','receipt_documents','kitchen_issues','menu_items','recipe_dependencies','recipe_versions','recipe_revisions','recipes','command_receipts','audit_events','butchery_catalog','items','suppliers','units','points_of_sale','kitchens','locations')) WHERE status<>'cleaned';
