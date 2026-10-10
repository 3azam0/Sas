import type {PGlite} from '@electric-sql/pglite';
import {createHash} from 'node:crypto';
import {recipeCommandSchema,BusinessError,type Access,type CommandResult,type Recipe,type RecipeVersion,type Item,type Unit,type ReceiptPrice} from '@saas/contracts';
import {validateRecipe} from '../domain/recipes';
import {assertGeneration} from './valuation';
type Tx=Pick<PGlite,'query'>;
export const recipeTables=`
CREATE TABLE IF NOT EXISTS recipes(organization_id text NOT NULL REFERENCES organizations(id),recipe_id uuid NOT NULL,code text NOT NULL,revision integer NOT NULL,state text NOT NULL CHECK(state IN ('draft','published')),payload jsonb NOT NULL,published_version_id uuid,PRIMARY KEY(organization_id,recipe_id),UNIQUE(organization_id,code));
CREATE TABLE IF NOT EXISTS recipe_versions(organization_id text NOT NULL,version_id uuid NOT NULL,recipe_id uuid NOT NULL,version_number integer NOT NULL,payload jsonb NOT NULL,published_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,version_id),UNIQUE(organization_id,recipe_id,version_number),FOREIGN KEY(organization_id,recipe_id) REFERENCES recipes(organization_id,recipe_id));
CREATE TABLE IF NOT EXISTS recipe_dependencies(organization_id text NOT NULL,version_id uuid NOT NULL,child_version_id uuid NOT NULL,PRIMARY KEY(organization_id,version_id,child_version_id),FOREIGN KEY(organization_id,version_id) REFERENCES recipe_versions(organization_id,version_id),FOREIGN KEY(organization_id,child_version_id) REFERENCES recipe_versions(organization_id,version_id));
CREATE INDEX IF NOT EXISTS recipe_dependency_child ON recipe_dependencies(organization_id,child_version_id);
CREATE TABLE IF NOT EXISTS recipe_revisions(organization_id text NOT NULL,recipe_id uuid NOT NULL,revision integer NOT NULL,operation_id uuid NOT NULL,payload jsonb NOT NULL,posted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,recipe_id,revision),UNIQUE(organization_id,operation_id),FOREIGN KEY(organization_id,recipe_id) REFERENCES recipes(organization_id,recipe_id));
CREATE INDEX IF NOT EXISTS receipt_cost_lookup ON stock_entries(organization_id,location_id,item_id,sequence DESC) WHERE quantity>0 AND type IN ('receipt.post','purchase.receive');
`;
export async function recipeSnapshot(tx:Tx,org:string){
 const recipes=(await tx.query<Recipe>('SELECT recipe_id AS "recipeId",revision,state,payload AS definition,published_version_id AS "publishedVersionId" FROM recipes WHERE organization_id=$1 ORDER BY code',[org])).rows;
 const recipeVersions=(await tx.query<RecipeVersion>('SELECT recipe_id AS "recipeId",version_id AS "versionId",version_number AS "versionNumber",payload AS definition,published_at::text AS "publishedAt" FROM recipe_versions WHERE organization_id=$1 ORDER BY recipe_id,version_number',[org])).rows;
 const receiptPrices=(await tx.query<ReceiptPrice>(`SELECT DISTINCT ON(location_id,item_id) location_id AS "locationId",item_id AS "itemId",(amount/quantity)::text AS "unitCost",business_date::text AS "businessDate",posted_at::text AS "postedAt",operation_id AS "sourceOperationId" FROM stock_entries WHERE organization_id=$1 AND quantity>0 AND type IN ('receipt.post','purchase.receive') ORDER BY location_id,item_id,sequence DESC`,[org])).rows;
 return {recipes,recipeVersions,receiptPrices};
}
export async function postRecipe(db:PGlite,access:Access,input:unknown):Promise<CommandResult>{
 const parsed=recipeCommandSchema.safeParse(input);if(!parsed.success)throw new BusinessError('INVALID_RECIPE','راجع تعريف الوصفة والمكونات والكميات.',400);const c=parsed.data,org=c.organizationId;
 if(org!==access.organizationId||!Number.isFinite(Date.parse(access.expiresAt))||Date.parse(access.expiresAt)<=Date.now())throw new BusinessError('FORBIDDEN','الجلسة لا تسمح بتعديل هذه المؤسسة.',403);
 const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
 try{return await db.transaction(async tx=>{
  if(!(await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org])).rows.length)throw new BusinessError('FORBIDDEN','المؤسسة غير متاحة.',403);await assertGeneration(tx,org,c.generation);
  const prior=(await tx.query<{payload_hash:string;result:CommandResult}>('SELECT payload_hash,result FROM command_receipts WHERE organization_id=$1 AND operation_id=$2',[org,c.operationId])).rows[0];if(prior){if(prior.payload_hash!==hash)throw new BusinessError('PAYLOAD_CONFLICT','معرّف العملية مستخدم لبيانات مختلفة.');return prior.result;}
  if((await tx.query('SELECT 1 FROM recipe_versions WHERE organization_id=$1 AND version_id=$2',[org,c.operationId])).rows.length)throw new BusinessError('PAYLOAD_CONFLICT','معرّف العملية مستخدم لإصدار وصفة.');
  const current=(await tx.query<Recipe>('SELECT recipe_id AS "recipeId",revision,state,payload AS definition FROM recipes WHERE organization_id=$1 AND recipe_id=$2',[org,c.recipeId])).rows[0];if((current?.revision??0)!==c.expectedRevision)throw new BusinessError('REVISION_CONFLICT','تغيرت الوصفة على جهاز آخر. ألغِ الإجراء المرفوض وافتح أحدث مسودة.');
  if(c.type==='recipe.publish'&&(!current||current.state!=='draft'))throw new BusinessError('INVALID_STATE','احفظ مسودة جديدة قبل نشر إصدار جديد.');
  const d=c.type==='recipe.save'?c.definition:current!.definition;
  const data=await recipeSnapshot(tx,org),items=(await tx.query<Item>('SELECT id,unit_id AS "unitId",active FROM items WHERE organization_id=$1',[org])).rows,units=(await tx.query<Unit>('SELECT id,name FROM units WHERE organization_id=$1',[org])).rows;
  validateRecipe({items,units,recipeVersions:data.recipeVersions},c.recipeId,d);
  const revision=c.expectedRevision+1;
  if(c.type==='recipe.save')await tx.query("INSERT INTO recipes(organization_id,recipe_id,code,revision,state,payload) VALUES($1,$2,$3,$4,'draft',$5) ON CONFLICT(organization_id,recipe_id) DO UPDATE SET code=$3,revision=$4,state='draft',payload=$5",[org,c.recipeId,d.code,revision,JSON.stringify(d)]);
  else{
   if((await tx.query('SELECT 1 FROM command_receipts WHERE organization_id=$1 AND operation_id=$2 UNION ALL SELECT 1 FROM recipe_versions WHERE organization_id=$1 AND version_id=$2',[org,c.versionId])).rows.length)throw new BusinessError('PAYLOAD_CONFLICT','معرّف الإصدار مستخدم بالفعل.');
   const versionNumber=Math.max(0,...data.recipeVersions.filter(v=>v.recipeId===c.recipeId).map(v=>v.versionNumber))+1;
   await tx.query('INSERT INTO recipe_versions(organization_id,version_id,recipe_id,version_number,payload) VALUES($1,$2,$3,$4,$5)',[org,c.versionId,c.recipeId,versionNumber,JSON.stringify(d)]);
   await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,c.versionId,createHash('sha256').update('recipe-version:'+JSON.stringify(d)).digest('hex'),JSON.stringify({operationId:c.versionId,outcome:'accepted'})]);
   for(const l of d.lines)if(l.kind==='recipe')await tx.query('INSERT INTO recipe_dependencies VALUES($1,$2,$3)',[org,c.versionId,l.versionId]);
   await tx.query("UPDATE recipes SET revision=$3,state='published',published_version_id=$4 WHERE organization_id=$1 AND recipe_id=$2",[org,c.recipeId,revision,c.versionId]);
  }
  await tx.query('INSERT INTO recipe_revisions(organization_id,recipe_id,revision,operation_id,payload) VALUES($1,$2,$3,$4,$5)',[org,c.recipeId,revision,c.operationId,JSON.stringify(c)]);
  await tx.query('INSERT INTO audit_events(organization_id,actor,operation_id,action) VALUES($1,$2,$3,$4)',[org,access.userId,c.operationId,c.type]);const result:CommandResult={operationId:c.operationId,outcome:'accepted'};
  await tx.query('INSERT INTO command_receipts VALUES($1,$2,$3,$4)',[org,c.operationId,hash,JSON.stringify(result)]);return result;
 });}catch(error){if((error as {code?:string}).code==='23505')throw new BusinessError('DUPLICATE_RECIPE','كود الوصفة أو معرّف إصدارها مستخدم بالفعل.');throw error;}
}
