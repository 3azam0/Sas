import {beforeEach,afterEach,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {createDatabase,seed,getSnapshot,postSetupCommand,postRecipe,postProduction} from '@saas/server';
import type {Access,RecipeDefinition} from '@saas/contracts';
import {estimateRecipe} from '../packages/domain/recipes';
let db:PGlite;
const access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
const base=()=>({operationId:randomUUID(),organizationId:'grills',capturedAt:new Date().toISOString(),schemaVersion:1});
const definition=(extra:Partial<RecipeDefinition>={}):RecipeDefinition=>({code:'',name:'وصفة تلقائية',outputMode:'non_stocked',outputUnitId:'قطعة',outputQuantity:'2',salePrice:'100',effectiveDate:'2026-10-29',lines:[{lineId:randomUUID(),kind:'material',itemId:'rice',unitId:'كجم',inputUnit:'base',enteredQuantity:'1',quantity:'1'}],...extra});
const material=(id:string,name:string)=>({...base(),type:'item.save',expectedRevision:0,record:{id,name,sku:'',category:'مواد غذائية',unitId:'كجم',minimum:'0',purchaseUnits:[],active:true}});
beforeEach(async()=>{db=await createDatabase();await seed(db,'moving_average');});
afterEach(async()=>{await db.close();});

it('assigns material codes under the tenant lock, deduplicates replay, preserves historical SKUs and rejects changing an existing code',async()=>{
 const a=material(randomUUID(),'مادة أولى'),b=material(randomUUID(),'مادة ثانية');const results=await Promise.all([postSetupCommand(db,access,a),postSetupCommand(db,access,b)]);expect(await postSetupCommand(db,access,a)).toEqual(results[0]);
 const s=await getSnapshot(db,access);expect([a,b].map(c=>s.items.find(i=>i.id===c.record.id)!.sku).sort()).toEqual(['MAT-000001','MAT-000002']);expect(s.items.find(i=>i.id==='rice')?.sku).toBe('DR-001');
 await expect(postSetupCommand(db,access,{...a,operationId:randomUUID(),expectedRevision:1,record:{...a.record,sku:'CHANGED'}})).rejects.toMatchObject({code:'IMMUTABLE_CODE'});
});

it('generates distinct recipe codes for two blank offline drafts and keeps codes stable through publication and new versions',async()=>{
 const a={...base(),type:'recipe.save',recipeId:randomUUID(),expectedRevision:0,definition:definition()},b={...base(),type:'recipe.save',recipeId:randomUUID(),expectedRevision:0,definition:definition({name:'وصفة ثانية'})};
 const before=await getSnapshot(db,access);await Promise.all([postRecipe(db,access,a),postRecipe(db,access,b)]);const saved=await getSnapshot(db,access);expect(saved.recipes!.map(r=>r.definition.code).sort()).toEqual(['REC-000001','REC-000002']);
 const code=saved.recipes!.find(r=>r.recipeId===a.recipeId)!.definition.code;const versionId=randomUUID();await postRecipe(db,access,{...base(),type:'recipe.publish',recipeId:a.recipeId,expectedRevision:1,versionId});await postRecipe(db,access,{...a,operationId:randomUUID(),expectedRevision:2,definition:{...a.definition,name:'اسم محدث'}});await postRecipe(db,access,a);
 const after=await getSnapshot(db,access);expect(after.recipes!.find(r=>r.recipeId===a.recipeId)!.definition.code).toBe(code);expect(after.recipeVersions!.find(v=>v.versionId===versionId)!.definition.code).toBe(code);expect(after.balances).toEqual(before.balances);expect(after.entries).toEqual(before.entries);
});

it('assigns automatic production references and preserves stock/cost idempotency',async()=>{
 const output=material(randomUUID(),'ناتج تصنيع');await postSetupCommand(db,access,output);const recipeId=randomUUID(),versionId=randomUUID();await postRecipe(db,access,{...base(),type:'recipe.save',recipeId,expectedRevision:0,definition:definition({outputMode:'stocked',outputItemId:output.record.id,outputUnitId:'كجم',outputQuantity:'1'})});await postRecipe(db,access,{...base(),type:'recipe.publish',recipeId,expectedRevision:1,versionId});
 const batch=()=>({...base(),type:'production.post',versionId,inputLocationId:'central',outputLocationId:'central',outputMovementId:randomUUID(),plannedOutput:'1',actualOutput:'1',reference:'',businessDate:'2026-10-29',lines:[{movementId:randomUUID(),itemId:'rice',unitId:'كجم',quantity:'1',abnormalWaste:'0'}]});const a=batch(),b=batch();await Promise.all([postProduction(db,access,a),postProduction(db,access,b)]);await postProduction(db,access,a);const s=await getSnapshot(db,access);expect(s.productions!.map(p=>p.document.reference).sort()).toEqual(['PROD-000001','PROD-000002']);expect(s.reconciliation!.every(r=>r.matches)).toBe(true);expect(s.balances.find(b=>b.itemId===output.record.id)!.quantity).toBe('2.000000');
});

it('keeps average costing primary, latest receipt independent, and missing prices incomplete',async()=>{
 const s=await getSnapshot(db,access),d=definition();s.receiptPrices=[{locationId:'central',itemId:'rice',unitCost:'100',businessDate:'2026-10-29',postedAt:new Date().toISOString(),sourceOperationId:randomUUID()}];const primary=estimateRecipe(s,'test',d,'central'),comparison=estimateRecipe(s,'test',d,'central','latest_receipt');expect(primary.unitCost).not.toBe(comparison.unitCost);expect(comparison.batchCost).toBe('100');
 const missing={...s,balances:s.balances.filter(b=>b.itemId!=='rice')};expect(estimateRecipe(missing,'test',d,'central')).toMatchObject({complete:false,batchCost:null,unitCost:null,foodCostPercent:null});expect(estimateRecipe(missing,'test',d,'central','latest_receipt').complete).toBe(true);expect(estimateRecipe(s,'test',d,'central')).toEqual(primary);
});
