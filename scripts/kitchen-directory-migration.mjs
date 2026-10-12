import {tables} from './sample-data/admin.mjs';
export function kitchenDirectoryMigrationSql(schema){
 const quoted=values=>values.map(v=>"'"+v+"'").join(',');
 const signature=list=>`(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN (${quoted(list)}))`;
 return `SET LOCAL search_path=fodo,pg_catalog;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM fodo.sample_data_runs WHERE status<>'cleaned' AND schema_signature<>${signature(tables.filter(t=>t!=='kitchens'))}) THEN RAISE EXCEPTION 'Trial baseline schema differs; review before adding kitchen directory'; END IF;
END $guard$;
${schema}
ALTER TABLE fodo.kitchens ENABLE ROW LEVEL SECURITY;
ALTER TABLE fodo.kitchens FORCE ROW LEVEL SECURITY;
REVOKE ALL ON fodo.kitchens FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON fodo.kitchens TO fodo_api;
CREATE POLICY tenant_scope ON fodo.kitchens TO fodo_api
 USING(organization_id=(SELECT current_setting('fodo.tenant',true)))
 WITH CHECK(organization_id=(SELECT current_setting('fodo.tenant',true)));
UPDATE fodo.sample_data_runs SET baseline=baseline||jsonb_build_object('kitchens','[]'::jsonb),schema_signature=${signature(tables)} WHERE status<>'cleaned';
`;
}
