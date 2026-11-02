SET LOCAL search_path=fodo,pg_catalog;
CREATE TABLE IF NOT EXISTS document_corrections(organization_id text NOT NULL REFERENCES organizations(id),operation_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('opening','receipt','kitchen')),source_id uuid NOT NULL,replacement_id uuid NOT NULL,reason text NOT NULL,actor text NOT NULL,reversal_ids jsonb NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id),UNIQUE(organization_id,source_id),UNIQUE(organization_id,replacement_id));
ALTER TABLE document_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_corrections FORCE ROW LEVEL SECURITY;
REVOKE ALL ON document_corrections FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON document_corrections TO fodo_api;
CREATE POLICY tenant_scope ON document_corrections TO fodo_api USING(organization_id=current_setting('fodo.tenant',true)) WITH CHECK(organization_id=current_setting('fodo.tenant',true));
