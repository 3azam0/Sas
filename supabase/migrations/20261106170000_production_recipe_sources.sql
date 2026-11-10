SET LOCAL search_path = fodo, pg_catalog;

CREATE TABLE IF NOT EXISTS production_recipe_sources (
 organization_id text NOT NULL REFERENCES organizations(id),
 code text NOT NULL,
 source_row integer NOT NULL CHECK(source_row>0),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 imported_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,code)
);

ALTER TABLE production_recipe_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_recipe_sources FORCE ROW LEVEL SECURITY;
REVOKE ALL ON production_recipe_sources FROM PUBLIC,anon,authenticated;
GRANT SELECT ON production_recipe_sources TO fodo_api;
CREATE POLICY tenant_scope ON production_recipe_sources TO fodo_api
 USING (organization_id=current_setting('fodo.tenant',true));
