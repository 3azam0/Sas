// Additive kitchen/POS scope. Existing accepted movements retain their meaning.
export const kitchenInventoryMigration=`
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS location_id text;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS parent_location_id text;
-- Deterministic tenant-qualified location identity; no stock is moved or consumed.
INSERT INTO locations(organization_id,id,name,kind,active,revision)
 SELECT organization_id,'ki:'||md5(organization_id||':'||id),name,'مطبخ',active,1 FROM kitchens WHERE location_id IS NULL
 ON CONFLICT(organization_id,id) DO NOTHING;
UPDATE kitchens SET location_id='ki:'||md5(organization_id||':'||id) WHERE location_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS kitchen_stock_location ON kitchens(organization_id,location_id) WHERE location_id IS NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='kitchen_location_scope' AND conrelid='kitchens'::regclass) THEN ALTER TABLE kitchens ADD CONSTRAINT kitchen_location_scope FOREIGN KEY(organization_id,location_id) REFERENCES locations(organization_id,id); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='kitchen_parent_scope' AND conrelid='kitchens'::regclass) THEN ALTER TABLE kitchens ADD CONSTRAINT kitchen_parent_scope FOREIGN KEY(organization_id,parent_location_id) REFERENCES locations(organization_id,id); END IF;
END $$;
CREATE TABLE IF NOT EXISTS points_of_sale(
 organization_id text NOT NULL REFERENCES organizations(id),id text NOT NULL,name text NOT NULL,source text NOT NULL,kitchen_id text NOT NULL,
 active boolean NOT NULL DEFAULT true,revision integer NOT NULL CHECK(revision>0),PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,kitchen_id) REFERENCES kitchens(organization_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS pos_active_name ON points_of_sale(organization_id,lower(btrim(name))) WHERE active;
CREATE INDEX IF NOT EXISTS pos_kitchen_scope ON points_of_sale(organization_id,kitchen_id);
-- New sources use ["pos",terminal,externalSource]; legacy source identities are untouched.
CREATE UNIQUE INDEX IF NOT EXISTS sales_pos_external_identity ON sales_details(organization_id,source,business_date,transaction_id,line_key) WHERE source LIKE '["pos",%';
`;
