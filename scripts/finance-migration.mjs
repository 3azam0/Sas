import {tables as currentTables} from './sample-data/admin.mjs';
const tables=currentTables.filter(t=>t!=='pos_kitchen_actions');
export function financeMigrationSql(schema){
 const quoted=values=>values.map(t=>"'"+t+"'").join(',');
 const signature=list=>`(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN (${quoted(list)}))`;
 return `SET LOCAL search_path=fodo,pg_catalog;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM fodo.sample_data_runs WHERE status<>'cleaned' AND schema_signature<>${signature(tables.filter(t=>t!=='finance_entries'&&t!=='pos_kitchen_actions'))}) THEN RAISE EXCEPTION 'Trial baseline differs; review before finance migration'; END IF;
END $guard$;
${schema}
ALTER TABLE fodo.finance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE fodo.finance_entries FORCE ROW LEVEL SECURITY;
REVOKE ALL ON fodo.finance_entries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON fodo.finance_entries TO fodo_api;
CREATE POLICY tenant_scope ON fodo.finance_entries TO fodo_api
 USING(organization_id=(SELECT current_setting('fodo.tenant',true)))
 WITH CHECK(organization_id=(SELECT current_setting('fodo.tenant',true)));
UPDATE fodo.sample_data_runs SET baseline=baseline||jsonb_build_object('finance_entries','[]'::jsonb),schema_signature=${signature(tables)} WHERE status<>'cleaned';
`;
}
