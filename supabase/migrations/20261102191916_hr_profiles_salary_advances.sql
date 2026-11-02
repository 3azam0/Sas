SET LOCAL search_path=fodo,pg_catalog;
CREATE TABLE IF NOT EXISTS hr_job_titles(
 organization_id text NOT NULL REFERENCES organizations(id),job_id uuid NOT NULL,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100),PRIMARY KEY(organization_id,job_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_job_title_name ON hr_job_titles(organization_id,lower(btrim(name)));
INSERT INTO hr_job_titles(organization_id,job_id,name)
 SELECT organization_id,gen_random_uuid(),min(btrim(job_title)) FROM hr_employees
 WHERE btrim(job_title)<>'' GROUP BY organization_id,lower(btrim(job_title))
 ON CONFLICT DO NOTHING;
ALTER TABLE hr_job_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_job_titles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON hr_job_titles FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON hr_job_titles TO fodo_api;
CREATE POLICY tenant_scope ON hr_job_titles TO fodo_api
 USING(organization_id=current_setting('fodo.tenant',true))
 WITH CHECK(organization_id=current_setting('fodo.tenant',true));

CREATE TABLE IF NOT EXISTS hr_salaries(
 organization_id text NOT NULL,employee_id uuid NOT NULL,state jsonb NOT NULL,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 PRIMARY KEY(organization_id,employee_id),FOREIGN KEY(organization_id,employee_id) REFERENCES hr_employees(organization_id,employee_id)
);
CREATE TABLE IF NOT EXISTS hr_advances(
 organization_id text NOT NULL,advance_id uuid NOT NULL,employee_id uuid NOT NULL,state jsonb NOT NULL,
 PRIMARY KEY(organization_id,advance_id),FOREIGN KEY(organization_id,employee_id) REFERENCES hr_employees(organization_id,employee_id)
);
CREATE INDEX IF NOT EXISTS hr_advance_employee ON hr_advances(organization_id,employee_id);
CREATE TABLE IF NOT EXISTS hr_advance_repayments(
 organization_id text NOT NULL,repayment_id uuid NOT NULL,advance_id uuid NOT NULL,state jsonb NOT NULL,
 PRIMARY KEY(organization_id,repayment_id),FOREIGN KEY(organization_id,advance_id) REFERENCES hr_advances(organization_id,advance_id)
);
CREATE INDEX IF NOT EXISTS hr_repayment_advance ON hr_advance_repayments(organization_id,advance_id);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['hr_salaries','hr_advances','hr_advance_repayments'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO fodo_api',t);
  EXECUTE format('CREATE POLICY tenant_scope ON %I TO fodo_api USING(organization_id=current_setting(''fodo.tenant'',true)) WITH CHECK(organization_id=current_setting(''fodo.tenant'',true))',t);
 END LOOP;
END $$;
GRANT UPDATE ON hr_salaries TO fodo_api;
