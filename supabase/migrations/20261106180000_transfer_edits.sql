SET LOCAL search_path = fodo, pg_catalog;

CREATE TABLE IF NOT EXISTS transfer_edits (
 organization_id text NOT NULL,
 transfer_id uuid NOT NULL,
 operation_id uuid NOT NULL,
 revision integer NOT NULL,
 actor text NOT NULL,
 reason text NOT NULL,
 previous_document jsonb NOT NULL,
 updated_document jsonb NOT NULL,
 reversal_ids jsonb NOT NULL,
 replay_ids jsonb NOT NULL,
 posted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,operation_id),
 UNIQUE(organization_id,transfer_id,revision),
 FOREIGN KEY(organization_id,transfer_id) REFERENCES transfers(organization_id,transfer_id)
);

ALTER TABLE transfer_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_edits FORCE ROW LEVEL SECURITY;
REVOKE ALL ON transfer_edits FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON transfer_edits TO fodo_api;
CREATE POLICY tenant_scope ON transfer_edits TO fodo_api
 USING (organization_id=current_setting('fodo.tenant',true))
 WITH CHECK (organization_id=current_setting('fodo.tenant',true));
