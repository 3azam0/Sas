SET LOCAL search_path=fodo,pg_catalog;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM fodo.sample_data_runs WHERE status<>'cleaned' AND schema_signature<>(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN ('sales_details','sales_imports','transfer_allocations','transfer_segments','supplier_return_lines','layer_allocations','cost_layers','stock_entries','production_batches','stock_balances','transfer_actions','transfers','supplier_returns','purchase_receipts','purchase_revisions','purchase_orders','count_finalizations','count_revisions','stock_counts','opening_documents','receipt_documents','kitchen_issues','menu_items','recipe_dependencies','recipe_versions','recipe_revisions','recipes','command_receipts','audit_events','items','suppliers','units','locations'))) THEN RAISE EXCEPTION 'Trial baseline schema differs; review before adding kitchen directory'; END IF;
END $guard$;

CREATE TABLE IF NOT EXISTS kitchens(
 organization_id text NOT NULL REFERENCES organizations(id),id text NOT NULL,name text NOT NULL,
 active boolean NOT NULL DEFAULT true,revision integer NOT NULL CHECK(revision>0),PRIMARY KEY(organization_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS kitchen_active_name ON kitchens(organization_id,lower(btrim(name))) WHERE active;
ALTER TABLE kitchen_issues ADD COLUMN IF NOT EXISTS kitchen_id text;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='kitchen_recipient_scope' AND conrelid='kitchen_issues'::regclass) THEN
 ALTER TABLE kitchen_issues ADD CONSTRAINT kitchen_recipient_scope FOREIGN KEY(organization_id,kitchen_id) REFERENCES kitchens(organization_id,id);
END IF; END $$;

ALTER TABLE fodo.kitchens ENABLE ROW LEVEL SECURITY;
ALTER TABLE fodo.kitchens FORCE ROW LEVEL SECURITY;
REVOKE ALL ON fodo.kitchens FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON fodo.kitchens TO fodo_api;
CREATE POLICY tenant_scope ON fodo.kitchens TO fodo_api
 USING(organization_id=(SELECT current_setting('fodo.tenant',true)))
 WITH CHECK(organization_id=(SELECT current_setting('fodo.tenant',true)));
UPDATE fodo.sample_data_runs SET baseline=baseline||jsonb_build_object('kitchens','[]'::jsonb),schema_signature=(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN ('sales_details','sales_imports','transfer_allocations','transfer_segments','supplier_return_lines','layer_allocations','cost_layers','stock_entries','production_batches','stock_balances','transfer_actions','transfers','supplier_returns','purchase_receipts','purchase_revisions','purchase_orders','count_finalizations','count_revisions','stock_counts','opening_documents','receipt_documents','kitchen_issues','menu_items','recipe_dependencies','recipe_versions','recipe_revisions','recipes','command_receipts','audit_events','items','suppliers','units','kitchens','locations')) WHERE status<>'cleaned';
