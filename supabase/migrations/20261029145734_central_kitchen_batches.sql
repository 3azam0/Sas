-- Additive central-kitchen ledger; available stock is released only on batch closure.
SET LOCAL search_path=fodo,pg_catalog;

CREATE TABLE IF NOT EXISTS central_batches(
 organization_id text NOT NULL REFERENCES organizations(id),batch_id uuid NOT NULL,reference text NOT NULL,
 location_id text NOT NULL,revision integer NOT NULL CHECK(revision>0),state jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,batch_id),UNIQUE(organization_id,reference),
 FOREIGN KEY(organization_id,location_id) REFERENCES locations(organization_id,id)
);
CREATE TABLE IF NOT EXISTS central_actions(
 sequence bigserial PRIMARY KEY,organization_id text NOT NULL,batch_id uuid NOT NULL,operation_id uuid NOT NULL,
 command jsonb NOT NULL,before_state jsonb,actor text NOT NULL,amount numeric(38,12) NOT NULL,
 effects jsonb NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),reversed_by uuid,
 UNIQUE(organization_id,operation_id),FOREIGN KEY(organization_id,batch_id) REFERENCES central_batches(organization_id,batch_id)
);
CREATE INDEX IF NOT EXISTS central_batch_actions ON central_actions(organization_id,batch_id,sequence);
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS central_batch_id uuid;
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS central_action_id uuid;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_central_batch_scope' AND conrelid='stock_entries'::regclass) THEN
 ALTER TABLE stock_entries ADD CONSTRAINT stock_central_batch_scope FOREIGN KEY(organization_id,central_batch_id) REFERENCES central_batches(organization_id,batch_id);
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_central_action_scope' AND conrelid='stock_entries'::regclass) THEN
 ALTER TABLE stock_entries ADD CONSTRAINT stock_central_action_scope FOREIGN KEY(organization_id,central_action_id) REFERENCES central_actions(organization_id,operation_id);
END IF; END $$;
CREATE INDEX IF NOT EXISTS stock_central_batch ON stock_entries(organization_id,central_batch_id);

ALTER TABLE central_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE central_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE central_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE central_actions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON central_batches,central_actions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON central_batches,central_actions TO fodo_api;
GRANT USAGE,SELECT ON SEQUENCE central_actions_sequence_seq TO fodo_api;
CREATE POLICY tenant_scope ON central_batches TO fodo_api USING(organization_id=current_setting('fodo.tenant',true)) WITH CHECK(organization_id=current_setting('fodo.tenant',true));
CREATE POLICY tenant_scope ON central_actions TO fodo_api USING(organization_id=current_setting('fodo.tenant',true)) WITH CHECK(organization_id=current_setting('fodo.tenant',true));
