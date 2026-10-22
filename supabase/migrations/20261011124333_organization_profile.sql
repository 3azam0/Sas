SET LOCAL search_path = fodo, pg_catalog;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(profile)='object');
