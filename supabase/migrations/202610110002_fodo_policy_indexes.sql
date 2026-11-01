-- Evaluate the trusted tenant context once per statement, rather than per row.
DO $$ DECLARE t record; col text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='fodo' AND tablename NOT IN ('user_access','provision_challenges') LOOP
  col:=CASE WHEN t.tablename='organizations' THEN 'id' ELSE 'organization_id' END;
  EXECUTE format('ALTER POLICY tenant_scope ON fodo.%I USING (%I = (SELECT current_setting(''fodo.tenant'',true))) WITH CHECK (%I = (SELECT current_setting(''fodo.tenant'',true)))',t.tablename,col,col);
 END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS audit_tenant ON fodo.audit_events(organization_id);
CREATE INDEX IF NOT EXISTS layer_material ON fodo.cost_layers(organization_id,item_id);
CREATE INDEX IF NOT EXISTS item_unit ON fodo.items(organization_id,unit_id);
CREATE INDEX IF NOT EXISTS allocation_layer ON fodo.layer_allocations(organization_id,layer_id);
CREATE INDEX IF NOT EXISTS balance_material ON fodo.stock_balances(organization_id,item_id);
CREATE INDEX IF NOT EXISTS entry_material ON fodo.stock_entries(organization_id,item_id);
CREATE INDEX IF NOT EXISTS entry_opening ON fodo.stock_entries(organization_id,opening_document_id);
CREATE INDEX IF NOT EXISTS entry_receipt ON fodo.stock_entries(organization_id,receipt_document_id);
CREATE INDEX IF NOT EXISTS entry_supplier ON fodo.stock_entries(organization_id,supplier_id);
-- Access mapping is server-only; make the default-deny intent explicit.
CREATE POLICY server_only ON fodo.user_access USING(false) WITH CHECK(false);
-- One-time provisioning is complete. Fail safely if another challenge exists.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM fodo.provision_challenges) THEN RAISE EXCEPTION 'Provisioning challenges must be completed before cleanup'; END IF;
END $$;
DROP TABLE fodo.provision_challenges;
