export const transferEditTables=`
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
`;
