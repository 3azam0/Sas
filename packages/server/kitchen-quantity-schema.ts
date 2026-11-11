export const kitchenQuantityRevisionTables=`
CREATE TABLE IF NOT EXISTS kitchen_quantity_revisions(
 organization_id text NOT NULL,
 kitchen_issue_id uuid NOT NULL,
 line_id uuid NOT NULL,
 operation_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision>0),
 previous_quantity numeric(30,6) NOT NULL CHECK(previous_quantity>0),
 quantity numeric(30,6) NOT NULL CHECK(quantity>0),
 amount numeric(38,12) NOT NULL CHECK(amount>=0),
 actor text NOT NULL,
 reason text NOT NULL,
 business_date date NOT NULL,
 posted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,kitchen_issue_id,revision),
 UNIQUE(organization_id,operation_id),
 FOREIGN KEY(organization_id,kitchen_issue_id) REFERENCES kitchen_issues(organization_id,operation_id)
);
`;

export const kitchenDocumentRevisionTables=`
CREATE TABLE IF NOT EXISTS kitchen_document_revisions(
 organization_id text NOT NULL,
 kitchen_issue_id uuid NOT NULL,
 operation_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision>0),
 document jsonb NOT NULL,
 lines jsonb NOT NULL,
 amount numeric(38,12) NOT NULL CHECK(amount>=0),
 changes jsonb NOT NULL,
 actor text NOT NULL,
 reason text NOT NULL,
 business_date date NOT NULL,
 posted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,kitchen_issue_id,revision),
 UNIQUE(organization_id,operation_id),
 FOREIGN KEY(organization_id,kitchen_issue_id) REFERENCES kitchen_issues(organization_id,operation_id)
);
`;
