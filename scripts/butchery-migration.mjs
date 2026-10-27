import {tables} from './sample-data/admin.mjs';

// Wrap the additive schema/RLS export so an open removable trial stays restorable.
// Execute this full SQL in one migration transaction; never apply the suffix alone.
export function butcheryMigrationSql(schema){
 const quoted=list=>list.map(t=>"'"+t+"'").join(',');
 const signature=list=>`(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN (${quoted(list)}))`;
 const prior=tables.filter(t=>t!=='butchery_catalog'&&t!=='butchery_batches');
 return `SET LOCAL search_path=fodo,pg_catalog;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM fodo.sample_data_runs WHERE status<>'cleaned' AND schema_signature<>${signature(prior)}) THEN RAISE EXCEPTION 'Trial baseline differs; review before butchery migration'; END IF;
 IF to_regclass('fodo.butchery_catalog') IS NOT NULL OR to_regclass('fodo.butchery_batches') IS NOT NULL OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='fodo' AND table_name='stock_entries' AND column_name='butchery_id') THEN RAISE EXCEPTION 'Butchery schema already exists; review migration history before continuing'; END IF;
END $guard$;
${schema}
UPDATE fodo.sample_data_runs SET baseline=baseline||jsonb_build_object('butchery_catalog','[]'::jsonb,'butchery_batches','[]'::jsonb),schema_signature=${signature(tables)} WHERE status<>'cleaned';
`;
}
