SET LOCAL search_path = fodo, pg_catalog;

CREATE TABLE IF NOT EXISTS menu_catalog_drafts (
 organization_id text NOT NULL,
 kitchen_id text NOT NULL,
 source text NOT NULL,
 code text NOT NULL,
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 imported_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,source,code),
 FOREIGN KEY(organization_id,kitchen_id) REFERENCES kitchens(organization_id,id)
);

ALTER TABLE menu_catalog_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_catalog_drafts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON menu_catalog_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON menu_catalog_drafts TO fodo_api;
CREATE POLICY tenant_scope ON menu_catalog_drafts TO fodo_api
 USING (organization_id=current_setting('fodo.tenant',true))
 WITH CHECK (organization_id=current_setting('fodo.tenant',true));
