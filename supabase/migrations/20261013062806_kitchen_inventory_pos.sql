SET LOCAL search_path=fodo,pg_catalog;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM fodo.sample_data_runs WHERE status<>'cleaned' AND schema_signature<>(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN ('sales_details','sales_imports','transfer_allocations','transfer_segments','supplier_return_lines','layer_allocations','cost_layers','stock_entries','production_batches','stock_balances','transfer_actions','transfers','supplier_returns','purchase_receipts','purchase_revisions','purchase_orders','count_finalizations','count_revisions','stock_counts','opening_documents','receipt_documents','kitchen_issues','menu_items','recipe_dependencies','recipe_versions','recipe_revisions','recipes','command_receipts','audit_events','items','suppliers','units','points_of_sale','kitchens','locations') AND table_name<>'points_of_sale' AND NOT(table_name='kitchens' AND column_name IN ('location_id','parent_location_id')))) THEN RAISE EXCEPTION 'Trial baseline schema differs; review before kitchen inventory migration'; END IF;
END $guard$;

ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS location_id text;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS parent_location_id text;
-- Deterministic tenant-qualified location identity; no stock is moved or consumed.
INSERT INTO locations(organization_id,id,name,kind,active,revision)
 SELECT organization_id,'ki:'||md5(organization_id||':'||id),name,'مطبخ',active,1 FROM kitchens WHERE location_id IS NULL
 ON CONFLICT(organization_id,id) DO NOTHING;
UPDATE kitchens SET location_id='ki:'||md5(organization_id||':'||id) WHERE location_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS kitchen_stock_location ON kitchens(organization_id,location_id) WHERE location_id IS NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='kitchen_location_scope' AND conrelid='kitchens'::regclass) THEN ALTER TABLE kitchens ADD CONSTRAINT kitchen_location_scope FOREIGN KEY(organization_id,location_id) REFERENCES locations(organization_id,id); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='kitchen_parent_scope' AND conrelid='kitchens'::regclass) THEN ALTER TABLE kitchens ADD CONSTRAINT kitchen_parent_scope FOREIGN KEY(organization_id,parent_location_id) REFERENCES locations(organization_id,id); END IF;
END $$;
CREATE TABLE IF NOT EXISTS points_of_sale(
 organization_id text NOT NULL REFERENCES organizations(id),id text NOT NULL,name text NOT NULL,source text NOT NULL,kitchen_id text NOT NULL,
 active boolean NOT NULL DEFAULT true,revision integer NOT NULL CHECK(revision>0),PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,kitchen_id) REFERENCES kitchens(organization_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS pos_active_name ON points_of_sale(organization_id,lower(btrim(name))) WHERE active;
CREATE INDEX IF NOT EXISTS pos_kitchen_scope ON points_of_sale(organization_id,kitchen_id);
-- New sources use ["pos",terminal,externalSource]; legacy source identities are untouched.
CREATE UNIQUE INDEX IF NOT EXISTS sales_pos_external_identity ON sales_details(organization_id,source,business_date,transaction_id,line_key) WHERE source LIKE '["pos",%';

CREATE INDEX IF NOT EXISTS kitchen_parent_location_scope ON fodo.kitchens(organization_id,parent_location_id);
ALTER TABLE fodo.points_of_sale ENABLE ROW LEVEL SECURITY;
ALTER TABLE fodo.points_of_sale FORCE ROW LEVEL SECURITY;
REVOKE ALL ON fodo.points_of_sale FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON fodo.points_of_sale TO fodo_api;
CREATE POLICY tenant_scope ON fodo.points_of_sale TO fodo_api
 USING(organization_id=(SELECT current_setting('fodo.tenant',true)))
 WITH CHECK(organization_id=(SELECT current_setting('fodo.tenant',true)));
UPDATE fodo.sample_data_runs run SET baseline=baseline||jsonb_build_object(
 'points_of_sale','[]'::jsonb,
 'kitchens',COALESCE((SELECT jsonb_agg(b.k||jsonb_build_object('location_id',k.location_id,'parent_location_id',k.parent_location_id)) FROM jsonb_array_elements(run.baseline->'kitchens') b(k) JOIN fodo.kitchens k ON k.organization_id=run.organization_id AND k.id=b.k->>'id'),'[]'::jsonb),
 'locations',COALESCE(baseline->'locations','[]'::jsonb)||COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM fodo.locations l JOIN fodo.kitchens k ON k.organization_id=l.organization_id AND k.location_id=l.id WHERE k.organization_id=run.organization_id AND EXISTS(SELECT 1 FROM jsonb_array_elements(run.baseline->'kitchens') b(k) WHERE b.k->>'id'=k.id) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(run.baseline->'locations') b(l) WHERE b.l->>'id'=l.id)),'[]'::jsonb)
 ),schema_signature=(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN ('sales_details','sales_imports','transfer_allocations','transfer_segments','supplier_return_lines','layer_allocations','cost_layers','stock_entries','production_batches','stock_balances','transfer_actions','transfers','supplier_returns','purchase_receipts','purchase_revisions','purchase_orders','count_finalizations','count_revisions','stock_counts','opening_documents','receipt_documents','kitchen_issues','menu_items','recipe_dependencies','recipe_versions','recipe_revisions','recipes','command_receipts','audit_events','items','suppliers','units','points_of_sale','kitchens','locations') ) WHERE status<>'cleaned';
