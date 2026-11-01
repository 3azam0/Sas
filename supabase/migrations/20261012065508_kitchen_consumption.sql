SET LOCAL search_path=fodo,pg_catalog;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM fodo.sample_data_runs WHERE status<>'cleaned' AND schema_signature<>(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN ('sales_details','sales_imports','transfer_allocations','transfer_segments','supplier_return_lines','layer_allocations','cost_layers','stock_entries','production_batches','stock_balances','transfer_actions','transfers','supplier_returns','purchase_receipts','purchase_revisions','purchase_orders','count_finalizations','count_revisions','stock_counts','opening_documents','receipt_documents','menu_items','recipe_dependencies','recipe_versions','recipe_revisions','recipes','command_receipts','audit_events','items','suppliers','units','locations'))) THEN RAISE EXCEPTION 'Trial baseline schema differs; review before adding kitchen consumption'; END IF;
END $guard$;

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

ALTER TABLE fodo.kitchen_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE fodo.kitchen_issues FORCE ROW LEVEL SECURITY;
REVOKE ALL ON fodo.kitchen_issues FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON fodo.kitchen_issues TO fodo_api;
CREATE POLICY tenant_scope ON fodo.kitchen_issues TO fodo_api
 USING(organization_id=(SELECT current_setting('fodo.tenant',true)))
 WITH CHECK(organization_id=(SELECT current_setting('fodo.tenant',true)));
UPDATE fodo.sample_data_runs SET baseline=baseline||jsonb_build_object('kitchen_issues','[]'::jsonb),schema_signature=(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN ('sales_details','sales_imports','transfer_allocations','transfer_segments','supplier_return_lines','layer_allocations','cost_layers','stock_entries','production_batches','stock_balances','transfer_actions','transfers','supplier_returns','purchase_receipts','purchase_revisions','purchase_orders','count_finalizations','count_revisions','stock_counts','opening_documents','receipt_documents','kitchen_issues','menu_items','recipe_dependencies','recipe_versions','recipe_revisions','recipes','command_receipts','audit_events','items','suppliers','units','locations')) WHERE status<>'cleaned';
