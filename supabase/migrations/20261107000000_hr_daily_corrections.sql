SET LOCAL search_path=fodo,pg_catalog;

CREATE TABLE IF NOT EXISTS hr_daily_corrections(
 organization_id text NOT NULL,device_id uuid NOT NULL,badge text NOT NULL,attendance_day date NOT NULL,
 entry_event_key text NOT NULL,exit_event_key text NOT NULL,skipped_event_key text,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 2 AND 500),recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,device_id,badge,attendance_day),
 FOREIGN KEY(organization_id,device_id,badge) REFERENCES hr_employees(organization_id,device_id,badge),
 FOREIGN KEY(organization_id,device_id,entry_event_key) REFERENCES hr_punches(organization_id,device_id,event_key),
 FOREIGN KEY(organization_id,device_id,exit_event_key) REFERENCES hr_punches(organization_id,device_id,event_key),
 FOREIGN KEY(organization_id,device_id,skipped_event_key) REFERENCES hr_punches(organization_id,device_id,event_key),
 CHECK(entry_event_key<>exit_event_key AND skipped_event_key IS DISTINCT FROM entry_event_key AND skipped_event_key IS DISTINCT FROM exit_event_key)
);

ALTER TABLE hr_daily_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_daily_corrections FORCE ROW LEVEL SECURITY;
REVOKE ALL ON hr_daily_corrections FROM PUBLIC,anon,authenticated;
GRANT SELECT ON hr_daily_corrections TO fodo_api;
CREATE POLICY tenant_scope ON hr_daily_corrections FOR SELECT TO fodo_api
 USING(organization_id=current_setting('fodo.tenant',true));
