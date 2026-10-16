import {tables as currentTables} from './sample-data/admin.mjs';
// Freeze this historical upgrade at its original schema stage.
const tables=currentTables.filter(t=>t!=='finance_entries');
export function kitchenInventoryMigrationSql(schema){
 const list=tables.map(t=>"'"+t+"'").join(',');
 const signature=exclude=>`(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN (${list}) ${exclude})`;
 return `SET LOCAL search_path=fodo,pg_catalog;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM fodo.sample_data_runs WHERE status<>'cleaned' AND schema_signature<>${signature("AND table_name<>'points_of_sale' AND NOT(table_name='kitchens' AND column_name IN ('location_id','parent_location_id'))")}) THEN RAISE EXCEPTION 'Trial baseline schema differs; review before kitchen inventory migration'; END IF;
END $guard$;
${schema}
CREATE INDEX IF NOT EXISTS kitchen_parent_location_scope ON fodo.kitchens(organization_id,parent_location_id);
ALTER TABLE fodo.points_of_sale ENABLE ROW LEVEL SECURITY;
ALTER TABLE fodo.points_of_sale FORCE ROW LEVEL SECURITY;
REVOKE ALL ON fodo.points_of_sale FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON fodo.points_of_sale TO fodo_api;
CREATE POLICY tenant_scope ON fodo.points_of_sale TO fodo_api
 USING(organization_id=(SELECT current_setting('fodo.tenant',true)))
 WITH CHECK(organization_id=(SELECT current_setting('fodo.tenant',true)));
UPDATE fodo.sample_data_runs run SET baseline=baseline||jsonb_build_object(
 'points_of_sale','[]'::jsonb,
 'kitchens',COALESCE((SELECT jsonb_agg(b.k||jsonb_build_object('location_id',k.location_id,'parent_location_id',k.parent_location_id)) FROM jsonb_array_elements(run.baseline->'kitchens') b(k) JOIN fodo.kitchens k ON k.organization_id=run.organization_id AND k.id=b.k->>'id'),'[]'::jsonb),
 'locations',COALESCE(baseline->'locations','[]'::jsonb)||COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM fodo.locations l JOIN fodo.kitchens k ON k.organization_id=l.organization_id AND k.location_id=l.id WHERE k.organization_id=run.organization_id AND EXISTS(SELECT 1 FROM jsonb_array_elements(run.baseline->'kitchens') b(k) WHERE b.k->>'id'=k.id) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(run.baseline->'locations') b(l) WHERE b.l->>'id'=l.id)),'[]'::jsonb)
 ),schema_signature=${signature('')} WHERE status<>'cleaned';
`;
}
