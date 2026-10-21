import {tables as currentTables} from './sample-data/admin.mjs';
// Freeze this historical upgrade at its original schema stage.
const tables=currentTables.filter(t=>t!=='finance_entries'&&t!=='pos_kitchen_actions');
// Preserve the existing trial backup across this explicitly reviewed additive
// schema change. Abort first if its signature already differs for any other reason.
export function kitchenIssueMigrationSql(schema){
 const quoted=values=>values.map(v=>"'"+v+"'").join(',');
 const issueTables=tables.filter(t=>t!=='kitchens'&&t!=='points_of_sale');
 const old=quoted(issueTables.filter(t=>t!=='kitchen_issues')),current=quoted(issueTables);
 const signature=list=>`(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN (${list}))`;
 return `SET LOCAL search_path=fodo,pg_catalog;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM fodo.sample_data_runs WHERE status<>'cleaned' AND schema_signature<>${signature(old)}) THEN RAISE EXCEPTION 'Trial baseline schema differs; review before adding kitchen consumption'; END IF;
END $guard$;
${schema}
ALTER TABLE fodo.kitchen_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE fodo.kitchen_issues FORCE ROW LEVEL SECURITY;
REVOKE ALL ON fodo.kitchen_issues FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON fodo.kitchen_issues TO fodo_api;
CREATE POLICY tenant_scope ON fodo.kitchen_issues TO fodo_api
 USING(organization_id=(SELECT current_setting('fodo.tenant',true)))
 WITH CHECK(organization_id=(SELECT current_setting('fodo.tenant',true)));
UPDATE fodo.sample_data_runs SET baseline=baseline||jsonb_build_object('kitchen_issues','[]'::jsonb),schema_signature=${signature(current)} WHERE status<>'cleaned';
`;
}
