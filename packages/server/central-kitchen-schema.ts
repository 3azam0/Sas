// Additive migration: legacy production_batches and butchery documents are unchanged.
export const centralKitchenTables=`
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
`;
