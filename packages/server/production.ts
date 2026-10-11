import type {Database} from './database';
import {createHash,randomUUID} from 'node:crypto';
import {productionSchema,BusinessError,type Access,type CommandResult,type PostedProduction,type Snapshot,type ProductionLineCost} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {validateProduction,exactOutputLayers,productionWasteValue} from '../domain/production';
import {recipeSnapshot} from './recipes';
import {assertGeneration,planIssue,applyIssue,costingMethod,rebalanceAverage} from './valuation';
import {reconcileStock} from './counts';

export const productionTables=`
CREATE TABLE IF NOT EXISTS production_batches(organization_id text NOT NULL REFERENCES organizations(id),operation_id uuid NOT NULL,version_id uuid NOT NULL,input_location_id text NOT NULL,output_location_id text NOT NULL,output_item_id text NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,operation_id),FOREIGN KEY(organization_id,version_id) REFERENCES recipe_versions(organization_id,version_id),FOREIGN KEY(organization_id,input_location_id) REFERENCES locations(organization_id,id),FOREIGN KEY(organization_id,output_location_id) REFERENCES locations(organization_id,id),FOREIGN KEY(organization_id,output_item_id) REFERENCES items(organization_id,id));
CREATE INDEX IF NOT EXISTS production_version_lookup ON production_batches(organization_id,version_id);
CREATE INDEX IF NOT EXISTS production_input_lookup ON production_batches(organization_id,input_location_id);
CREATE INDEX IF NOT EXISTS production_output_lookup ON production_batches(organization_id,output_location_id);
CREATE INDEX IF NOT EXISTS production_item_lookup ON production_batches(organization_id,output_item_id);
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS production_id uuid;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='stock_production_scope') THEN ALTER TABLE stock_entries ADD CONSTRAINT stock_production_scope FOREIGN KEY(organization_id,production_id) REFERENCES production_batches(organization_id,operation_id); END IF; END $$;
CREATE INDEX IF NOT EXISTS stock_production_lookup ON stock_entries(organization_id,production_id);
`;
export async function productionSnapshot(tx:Pick<Database,'query'>,org:string){return {productions:(await tx.query<{result:PostedProduction}>('SELECT result FROM production_batches WHERE organization_id=$1 ORDER BY posted_at DESC',[org])).rows.map(r=>r.result)};}
export async function postProduction(db:Database,access:Access,input:unknown):Promise<CommandResult>{
 const parsed=productionSchema.safeParse(input);if(!parsed.success)throw new BusinessError('INVALID_PRODUCTION','راجع الكميات والناتج وأسباب الهالك أو فشل الدفعة.',400);const c=parsed.data,org=c.organizationId;
 if(org!==access.organizationId||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','الجلسة لا تسمح بالإنتاج لهذه المؤسسة.',403);
 const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
 return db.transaction(async tx=>{
  await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);await assertGeneration(tx,org,c.generation);
  const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[org,c.operationId])).rows[0];if(prior){if(prior.payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','معرّف الإنتاج مستخدم لبيانات مختلفة.');return prior.result;}
  const ids=[c.operationId,c.outputMovementId,...c.lines.map(l=>l.movementId)];if((await tx.query('SELECT 1 FROM command_receipts WHERE organization_id=$1 AND operation_id=ANY($2::uuid[]) UNION ALL SELECT 1 FROM stock_entries WHERE organization_id=$1 AND operation_id=ANY($2::uuid[])',[org,ids])).rows.length)throw new BusinessError('PAYLOAD_CONFLICT','أحد معرّفات الإنتاج أو سطوره مستخدم بالفعل.');
  const data=await recipeSnapshot(tx,org),items=(await tx.query<Snapshot['items'][number]>('SELECT id,unit_id AS "unitId",active FROM items WHERE organization_id=$1',[org])).rows,locations=(await tx.query<Snapshot['locations'][number]>('SELECT id,active FROM locations WHERE organization_id=$1',[org])).rows;
  const plan=validateProduction({recipeVersions:data.recipeVersions,items,locations},c),d=plan.version.definition,method=await costingMethod(tx,org);
  const affected=new Set([...c.lines.map(l=>JSON.stringify([c.inputLocationId,l.itemId])),JSON.stringify([c.outputLocationId,d.outputItemId])]);
  const check=async()=>{if((await reconcileStock(tx,org)).some(r=>affected.has(JSON.stringify([r.locationId,r.itemId]))&&!r.matches))throw new BusinessError('RECONCILIATION_MISMATCH','الرصيد والدفتر والطبقات غير متطابقة؛ لم تُرحل الدفعة.');};await check();
  const prepared=[];let total=decimal('0'),waste=decimal('0');const failed=decimal(c.actualOutput).isZero();const lines:ProductionLineCost[]=[];
  for(const line of c.lines){const issue=decimal(line.quantity).gt(0)?await planIssue(tx,org,c.inputLocationId,line.itemId,line.quantity):null;const amount=issue?.amount??'0',loss=productionWasteValue(amount,line.quantity,line.abnormalWaste,failed);total=total.add(amount);waste=waste.add(loss);const expected=plan.lines.find(l=>l.itemId===line.itemId)!.quantity;lines.push({itemId:line.itemId,movementId:line.movementId,expected,quantity:line.quantity,variance:decimal(line.quantity).sub(expected).toString(),inputAmount:amount,wasteAmount:loss});prepared.push({line,issue});}
  const outputAmount=total.sub(waste).toFixed(12),unitCost=failed?null:decimal(outputAmount).div(c.actualOutput).toFixed(6),parts=failed?[]:exactOutputLayers(c.actualOutput,outputAmount);
  if(decimal(outputAmount).gte('1000000000000000000'))throw new BusinessError('COST_TOO_LARGE','قيمة الناتج تتجاوز الحد؛ قسّم الدفعة.');
  const result:PostedProduction={document:c,recipeName:d.name,outputItemId:d.outputItemId!,outputUnitId:d.outputUnitId,method,inputAmount:total.toFixed(12),wasteAmount:waste.toFixed(12),outputAmount,unitCost,attainment:decimal(c.actualOutput).div(c.plannedOutput).mul(100).toString(),state:failed?'failed':'completed',lines,postedAt:new Date().toISOString()};
  await tx.query('INSERT INTO production_batches(organization_id,operation_id,version_id,input_location_id,output_location_id,output_item_id,payload,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[org,c.operationId,c.versionId,c.inputLocationId,c.outputLocationId,d.outputItemId,JSON.stringify(c),JSON.stringify(result)]);
  for(const {line,issue} of prepared)if(issue){await tx.query('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,production_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[org,line.movementId,c.inputLocationId,line.itemId,decimal(line.quantity).neg().toString(),decimal(issue.amount).neg().toString(),'production.input',c.reference,c.businessDate,c.operationId]);await applyIssue(tx,org,c.inputLocationId,line.itemId,line.movementId,line.quantity,issue);}
  if(!failed){const entry=(await tx.query<{sequence:string}>('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date,production_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING sequence',[org,c.outputMovementId,c.outputLocationId,d.outputItemId,c.actualOutput,outputAmount,'production.output',c.reference,c.businessDate,c.operationId])).rows[0];
   const outputLayers=method==='fifo'?parts:[{quantity:c.actualOutput,unitCost:unitCost!}];
   for(const p of outputLayers)await tx.query('INSERT INTO cost_layers(organization_id,id,location_id,item_id,remaining,unit_cost,sequence,remaining_value) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[org,randomUUID(),c.outputLocationId,d.outputItemId,p.quantity,p.unitCost,entry.sequence,method==='moving_average'?outputAmount:null]);
   await tx.query('INSERT INTO stock_balances VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,location_id,item_id) DO UPDATE SET quantity=stock_balances.quantity+EXCLUDED.quantity,value=stock_balances.value+EXCLUDED.value',[org,c.outputLocationId,d.outputItemId,c.actualOutput,outputAmount]);await rebalanceAverage(tx,org,c.outputLocationId,d.outputItemId!);
  }
  await check();
  for(const id of ids.slice(1))await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,id,createHash('sha256').update('production:'+c.operationId+':'+id).digest('hex'),JSON.stringify({operationId:id,outcome:'accepted'})]);
  const response:CommandResult={operationId:c.operationId,outcome:'accepted',amount:total.toFixed(12)};await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,c.operationId,hash,JSON.stringify(response)]);await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[org,access.userId,c.operationId,c.type]);return response;
 });
}
