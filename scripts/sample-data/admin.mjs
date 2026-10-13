import {randomUUID} from 'node:crypto';
export const tables=['sales_details','sales_imports','transfer_allocations','transfer_segments','supplier_return_lines','layer_allocations','cost_layers','stock_entries','production_batches','stock_balances','transfer_actions','transfers','supplier_returns','purchase_receipts','purchase_revisions','purchase_orders','count_finalizations','count_revisions','stock_counts','opening_documents','receipt_documents','kitchen_issues','menu_items','recipe_dependencies','recipe_versions','recipe_revisions','recipes','command_receipts','audit_events','items','suppliers','units','points_of_sale','kitchens','locations'];
export const tableSql=`CREATE TABLE fodo.sample_data_runs (
 id uuid PRIMARY KEY, organization_id text NOT NULL REFERENCES fodo.organizations(id),
 dataset text NOT NULL, status text NOT NULL CHECK(status IN ('loading','active','cleaned')),
 baseline jsonb NOT NULL, organization_baseline jsonb NOT NULL, schema_signature text NOT NULL,
 trial_generation uuid NOT NULL, manifest jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, cleaned_at timestamptz
);
CREATE UNIQUE INDEX sample_data_one_open_run ON fodo.sample_data_runs(organization_id) WHERE status <> 'cleaned';
ALTER TABLE fodo.sample_data_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fodo.sample_data_runs FROM PUBLIC, anon, authenticated, fodo_api;`;
export const policySql=`CREATE POLICY sample_data_deny_clients ON fodo.sample_data_runs FOR ALL TO PUBLIC USING(false) WITH CHECK(false);`;
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const uuid=value=>{if(!/^[a-f0-9-]{36}$/i.test(value))throw Error('Invalid run UUID');return literal(value)+'::uuid';};
const org=value=>{if(!/^[A-Za-z0-9_-]{1,80}$/.test(value))throw Error('Invalid organization');return literal(value);};
const list=tables.map(literal).join(',');
const signature=`(SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,',' ORDER BY table_name,ordinal_position)) FROM information_schema.columns WHERE table_schema='fodo' AND table_name IN (${list}))`;
const schemaGuard=`IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='fodo' AND column_name='organization_id' AND table_name NOT IN (${list},'user_access','sample_data_runs','provision_challenges')) THEN RAISE EXCEPTION 'Unknown tenant table; review cleanup before continuing'; END IF;`;
export function captureSql(organizationId,runId=randomUUID()){
 const o=org(organizationId),r=uuid(runId);
 return `DO $sample$ DECLARE b jsonb='{}'; original jsonb; trial uuid=gen_random_uuid(); rows jsonb; t text; BEGIN
 SELECT to_jsonb(o) INTO original FROM fodo.organizations o WHERE id=${o} FOR UPDATE;
 IF original IS NULL THEN RAISE EXCEPTION 'Organization missing'; END IF;
 ${schemaGuard}
 IF EXISTS(SELECT 1 FROM fodo.sample_data_runs WHERE organization_id=${o} AND status<>'cleaned') THEN RAISE EXCEPTION 'A trial is already open'; END IF;
 IF EXISTS(SELECT 1 FROM fodo.stock_entries WHERE organization_id=${o}) OR EXISTS(SELECT 1 FROM fodo.recipes WHERE organization_id=${o}) OR EXISTS(SELECT 1 FROM fodo.menu_items WHERE organization_id=${o}) THEN RAISE EXCEPTION 'Trial requires an empty operational baseline'; END IF;
 FOREACH t IN ARRAY ARRAY[${list}] LOOP
 EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) FROM fodo.%I x WHERE organization_id=$1',t) INTO rows USING ${o}; b=jsonb_set(b,ARRAY[t],rows);
 END LOOP;
 INSERT INTO fodo.sample_data_runs(id,organization_id,dataset,status,baseline,organization_baseline,schema_signature,trial_generation) VALUES(${r},${o},'wahat-menu-v1','loading',b,original,${signature},trial);
 UPDATE fodo.organizations SET generation=trial WHERE id=${o};
 END $sample$; SELECT id,organization_id,status,trial_generation,jsonb_array_length(baseline->'items') AS baseline_items FROM fodo.sample_data_runs WHERE id=${r};`;
}
export function finishSql(organizationId,runId,manifest){return `UPDATE fodo.sample_data_runs SET status='active',completed_at=COALESCE(completed_at,now()),manifest=${literal(JSON.stringify(manifest))}::jsonb||jsonb_build_object('stockMovements',(SELECT count(*) FROM fodo.stock_entries WHERE organization_id=${org(organizationId)})) WHERE id=${uuid(runId)} AND organization_id=${org(organizationId)} AND status IN ('loading','active') AND trial_generation=(SELECT generation FROM fodo.organizations WHERE id=${org(organizationId)}) RETURNING id,status,manifest;`;}
export function cleanupSql(organizationId,runId){
 const o=org(organizationId),r=uuid(runId),restore=[...tables].reverse().map(t=>`INSERT INTO fodo.${t} SELECT * FROM jsonb_populate_recordset(null::fodo.${t},run.baseline->'${t}');`).join('\n');
 return `DO $sample$ DECLARE run fodo.sample_data_runs%ROWTYPE; current_generation uuid; t text; BEGIN
 SELECT generation INTO current_generation FROM fodo.organizations WHERE id=${o} FOR UPDATE;
 SELECT * INTO run FROM fodo.sample_data_runs WHERE id=${r} AND organization_id=${o} FOR UPDATE;
 IF run.id IS NULL THEN RAISE EXCEPTION 'Matching trial backup missing'; END IF;
 IF run.status='cleaned' THEN RETURN; END IF;
 IF run.trial_generation<>current_generation THEN RAISE EXCEPTION 'Generation changed; cleanup refused'; END IF;
 ${schemaGuard}
 IF run.schema_signature<>${signature} THEN RAISE EXCEPTION 'Schema changed; review baseline restore'; END IF;
 FOREACH t IN ARRAY ARRAY[${list}] LOOP EXECUTE format('DELETE FROM fodo.%I WHERE organization_id=$1',t) USING ${o}; END LOOP;
 ${restore}
 UPDATE fodo.organizations SET generation=gen_random_uuid(),costing_method=run.organization_baseline->>'costing_method',costing_revision=costing_revision+1 WHERE id=${o};
 INSERT INTO fodo.audit_events(organization_id,actor,operation_id,action) VALUES(${o},'sample-data-admin',gen_random_uuid(),'sample.restore-baseline');
 UPDATE fodo.sample_data_runs SET status='cleaned',cleaned_at=now() WHERE id=${r};
 END $sample$; SELECT id,status,cleaned_at FROM fodo.sample_data_runs WHERE id=${r} AND organization_id=${o};`;
}
