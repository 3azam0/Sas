SET LOCAL search_path=fodo,pg_catalog;

CREATE TABLE IF NOT EXISTS hr_shifts(organization_id text NOT NULL REFERENCES organizations(id),shift_id uuid NOT NULL,state jsonb NOT NULL,PRIMARY KEY(organization_id,shift_id));
CREATE TABLE IF NOT EXISTS hr_roster_events(organization_id text NOT NULL,employee_id uuid NOT NULL,business_date date NOT NULL,revision integer NOT NULL,state jsonb NOT NULL,actor text NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,employee_id,business_date,revision),FOREIGN KEY(organization_id,employee_id) REFERENCES hr_employees(organization_id,employee_id));

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['hr_shifts','hr_roster_events'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO fodo_api',t);
  EXECUTE format('CREATE POLICY tenant_scope ON %I TO fodo_api USING(organization_id=current_setting(''fodo.tenant'',true)) WITH CHECK(organization_id=current_setting(''fodo.tenant'',true))',t);
 END LOOP;
END $$;
