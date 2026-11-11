SET LOCAL search_path=fodo,pg_catalog;

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

ALTER TABLE kitchen_quantity_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_quantity_revisions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON kitchen_quantity_revisions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON kitchen_quantity_revisions TO fodo_api;
CREATE POLICY tenant_scope ON kitchen_quantity_revisions TO fodo_api
 USING(organization_id=(SELECT current_setting('fodo.tenant',true)))
 WITH CHECK(organization_id=(SELECT current_setting('fodo.tenant',true)));
