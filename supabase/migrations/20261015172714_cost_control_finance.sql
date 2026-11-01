SET LOCAL search_path=fodo,pg_catalog;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM fodo.sample_data_runs WHERE status<>'cleaned' AND schema_signature<>(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN ('sales_details','sales_imports','transfer_allocations','transfer_segments','supplier_return_lines','layer_allocations','cost_layers','stock_entries','production_batches','stock_balances','transfer_actions','transfers','supplier_returns','purchase_receipts','purchase_revisions','purchase_orders','count_finalizations','count_revisions','stock_counts','opening_documents','receipt_documents','kitchen_issues','menu_items','recipe_dependencies','recipe_versions','recipe_revisions','recipes','command_receipts','audit_events','items','suppliers','units','points_of_sale','kitchens','locations'))) THEN RAISE EXCEPTION 'Trial baseline differs; review before finance migration'; END IF;
END $guard$;

CREATE TABLE IF NOT EXISTS finance_entries(
 organization_id text NOT NULL REFERENCES organizations(id),operation_id uuid NOT NULL,
 location_id text NOT NULL,business_date date NOT NULL,type text NOT NULL CHECK(type IN ('sales.correct','expense.post','expense.reverse')),
 sale_line_id uuid,expense_id uuid,payload jsonb NOT NULL,amount numeric(18,6) NOT NULL CHECK(amount>=0),actor text NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,operation_id),FOREIGN KEY(organization_id,location_id) REFERENCES locations(organization_id,id),
 FOREIGN KEY(organization_id,sale_line_id) REFERENCES sales_details(organization_id,line_id),
 FOREIGN KEY(organization_id,expense_id) REFERENCES finance_entries(organization_id,operation_id)
);
CREATE INDEX IF NOT EXISTS finance_location_date ON finance_entries(organization_id,location_id,business_date);
CREATE INDEX IF NOT EXISTS finance_sale ON finance_entries(organization_id,sale_line_id) WHERE sale_line_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS finance_expense_reversal ON finance_entries(organization_id,expense_id) WHERE expense_id IS NOT NULL;

ALTER TABLE fodo.finance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE fodo.finance_entries FORCE ROW LEVEL SECURITY;
REVOKE ALL ON fodo.finance_entries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON fodo.finance_entries TO fodo_api;
CREATE POLICY tenant_scope ON fodo.finance_entries TO fodo_api
 USING(organization_id=(SELECT current_setting('fodo.tenant',true)))
 WITH CHECK(organization_id=(SELECT current_setting('fodo.tenant',true)));
UPDATE fodo.sample_data_runs SET baseline=baseline||jsonb_build_object('finance_entries','[]'::jsonb),schema_signature=(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN ('finance_entries','sales_details','sales_imports','transfer_allocations','transfer_segments','supplier_return_lines','layer_allocations','cost_layers','stock_entries','production_batches','stock_balances','transfer_actions','transfers','supplier_returns','purchase_receipts','purchase_revisions','purchase_orders','count_finalizations','count_revisions','stock_counts','opening_documents','receipt_documents','kitchen_issues','menu_items','recipe_dependencies','recipe_versions','recipe_revisions','recipes','command_receipts','audit_events','items','suppliers','units','points_of_sale','kitchens','locations')) WHERE status<>'cleaned';
