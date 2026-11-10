SET LOCAL search_path=fodo,pg_catalog;

ALTER TABLE hr_daily_corrections
 DROP CONSTRAINT IF EXISTS hr_daily_corrections_check,
 ALTER COLUMN entry_event_key DROP NOT NULL,
 ALTER COLUMN exit_event_key DROP NOT NULL,
 ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1 CHECK(revision>0);

DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conrelid='hr_daily_corrections'::regclass AND conname='hr_daily_corrections_distinct_events'
 ) THEN
  ALTER TABLE hr_daily_corrections ADD CONSTRAINT hr_daily_corrections_distinct_events
   CHECK(entry_event_key IS DISTINCT FROM exit_event_key
    AND (skipped_event_key IS NULL OR (skipped_event_key IS DISTINCT FROM entry_event_key AND skipped_event_key IS DISTINCT FROM exit_event_key)));
 END IF;
END $$;

GRANT INSERT ON hr_daily_corrections TO fodo_api;
GRANT UPDATE (entry_event_key,exit_event_key,skipped_event_key,revision,reason,recorded_at) ON hr_daily_corrections TO fodo_api;
CREATE POLICY tenant_insert ON hr_daily_corrections FOR INSERT TO fodo_api
 WITH CHECK(organization_id=current_setting('fodo.tenant',true));
CREATE POLICY tenant_update ON hr_daily_corrections FOR UPDATE TO fodo_api
 USING(organization_id=current_setting('fodo.tenant',true))
 WITH CHECK(organization_id=current_setting('fodo.tenant',true));
