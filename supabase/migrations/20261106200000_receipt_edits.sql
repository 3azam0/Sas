SET LOCAL search_path=fodo,pg_catalog;

CREATE TABLE IF NOT EXISTS receipt_edits(
 organization_id text NOT NULL,
 receipt_id uuid NOT NULL,
 operation_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision>0),
 actor text NOT NULL,
 reason text NOT NULL,
 previous_document jsonb NOT NULL,
 updated_document jsonb,
 amount numeric(38,12) NOT NULL CHECK(amount>=0),
 replaced_line_ids uuid[] NOT NULL,
 posted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,receipt_id,revision),
 UNIQUE(organization_id,operation_id),
 FOREIGN KEY(organization_id,receipt_id) REFERENCES receipt_documents(organization_id,operation_id)
);

ALTER TABLE receipt_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_edits FORCE ROW LEVEL SECURITY;
REVOKE ALL ON receipt_edits FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON receipt_edits TO fodo_api;
CREATE POLICY tenant_scope ON receipt_edits TO fodo_api
 USING(organization_id=current_setting('fodo.tenant',true))
 WITH CHECK(organization_id=current_setting('fodo.tenant',true));
