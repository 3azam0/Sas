-- Cashier POS kitchen status journal; no change to existing stock or sales.
SET LOCAL search_path=fodo,pg_catalog;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM fodo.sample_data_runs WHERE status<>'cleaned' AND schema_signature<>(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN ('finance_entries','sales_details','sales_imports','transfer_allocations','transfer_segments','supplier_return_lines','layer_allocations','cost_layers','stock_entries','production_batches','stock_balances','transfer_actions','transfers','supplier_returns','purchase_receipts','purchase_revisions','purchase_orders','count_finalizations','count_revisions','stock_counts','opening_documents','receipt_documents','kitchen_issues','menu_items','recipe_dependencies','recipe_versions','recipe_revisions','recipes','command_receipts','audit_events','items','suppliers','units','points_of_sale','kitchens','locations'))) THEN RAISE EXCEPTION 'Trial baseline differs; review before counter POS migration'; END IF;
END $guard$;

CREATE TABLE IF NOT EXISTS pos_kitchen_actions(
 organization_id text NOT NULL REFERENCES organizations(id),operation_id uuid NOT NULL,sale_id uuid NOT NULL,kitchen_id text NOT NULL,
 revision integer NOT NULL CHECK(revision>0),state text NOT NULL CHECK(state IN ('preparing','ready','collected')),payload jsonb NOT NULL,actor text NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,operation_id),UNIQUE(organization_id,sale_id,revision),
 FOREIGN KEY(organization_id,sale_id) REFERENCES sales_imports(organization_id,operation_id),FOREIGN KEY(organization_id,kitchen_id) REFERENCES kitchens(organization_id,id)
);
CREATE INDEX IF NOT EXISTS pos_kitchen_scope ON pos_kitchen_actions(organization_id,kitchen_id,sale_id,revision DESC);

ALTER TABLE fodo.pos_kitchen_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fodo.pos_kitchen_actions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON fodo.pos_kitchen_actions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON fodo.pos_kitchen_actions TO fodo_api;
CREATE POLICY tenant_scope ON fodo.pos_kitchen_actions TO fodo_api
 USING(organization_id=(SELECT current_setting('fodo.tenant',true)))
 WITH CHECK(organization_id=(SELECT current_setting('fodo.tenant',true)));
UPDATE fodo.sample_data_runs SET baseline=baseline||jsonb_build_object('pos_kitchen_actions','[]'::jsonb),schema_signature=(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN ('pos_kitchen_actions','finance_entries','sales_details','sales_imports','transfer_allocations','transfer_segments','supplier_return_lines','layer_allocations','cost_layers','stock_entries','production_batches','stock_balances','transfer_actions','transfers','supplier_returns','purchase_receipts','purchase_revisions','purchase_orders','count_finalizations','count_revisions','stock_counts','opening_documents','receipt_documents','kitchen_issues','menu_items','recipe_dependencies','recipe_versions','recipe_revisions','recipes','command_receipts','audit_events','items','suppliers','units','points_of_sale','kitchens','locations')) WHERE status<>'cleaned';
