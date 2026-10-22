import {it,expect} from 'vitest';
import type {CountDefinition,RecipeVersion} from '@saas/contracts';
import {compareConsumption,theoreticalConsumption,type ReconciliationEntry,type ReconciliationCount} from '../packages/domain/consumption-reconciliation';
const entry=(sequence:number,quantity:string,type:string,date='2026-10-10',countId:string|null=null):ReconciliationEntry=>({sequence:String(sequence),operationId:String(sequence),itemId:'rice',locationId:'kitchen',quantity,amount:String(Number(quantity)*10),type,businessDate:date,countId});
function count(id:string,date:string,sequence:string,expected:string,counted:string,movementId:string):ReconciliationCount{return {countId:id,document:{organizationId:'one',locationId:'kitchen',businessDate:date,cutoffAt:date+'T18:00:00.000Z',stockSequence:sequence} as CountDefinition,changes:[{itemId:'rice',expected,counted,amount:'0',movementId}]};}
const entries=[entry(1,'100','receipt.post','2026-10-09'),entry(2,'5','receipt.post'),entry(3,'-10','kitchen.transfer.out'),entry(4,'-5','production.input'),entry(5,'-2','waste.post'),entry(6,'-20','sales.issue'),entry(7,'-3','count.adjust','2026-10-10','close')];
const counts=[count('open','2026-10-09','1','100','100','none'),count('close','2026-10-10','6','68','65','7')];
const input={from:'2026-10-10',to:'2026-10-10',itemId:'rice',locationId:'kitchen',entries,counts,theoretical:'20',selectedRequired:'20',shortage:'0',recipeIssues:[],ledgerMatches:true};
it('independently proves 23 actual versus 20 theoretical without double-counting transfers, waste or preparation',()=>{
 const r=compareConsumption(input);expect(r.status).toBe('complete');expect(r.actual).toBe('23');expect(r.variance).toBe('3');expect(r.variancePercent).toBe('15');expect(r.varianceCost).toBe('30');expect(r.recorded).toBe('20');expect(r.waste).toBe('2');expect(r.productionInput).toBe('5');expect(r.netSupply).toBe('-10');expect(r.countDifference).toBe('-3');expect(r.recordedCost).toBe('200');expect(r.issues).toEqual([]);
});
it('never substitutes ledger deductions for physical consumption when a boundary count is missing',()=>{
 const r=compareConsumption({...input,counts:[counts[1]]});expect(r.actual).toBeNull();expect(r.variance).toBeNull();expect(r.status).toBe('incomplete');expect(r.recorded).toBe('20');expect(r.issues.join()).toContain('السابق');
});
it('rejects late same-period, pre-period and cross-period movement timing',()=>{
 for(const late of [entry(8,'1','receipt.post'),entry(8,'1','receipt.post','2026-10-09'),entry(4,'1','receipt.post','2026-10-11')])expect(compareConsumption({...input,entries:[...entries,late]}).actual).toBeNull();
});
it('requires physical count dates to agree with their real cutoff dates',()=>{
 const closing={...counts[1],document:{...counts[1].document,cutoffAt:'2026-10-11T18:00:00.000Z'}};expect(compareConsumption({...input,counts:[counts[0],closing]}).actual).toBeNull();
});
it('marks manual balance edits, unlinked adjustments, corrupt baselines and corrupt ledgers incomplete',()=>{
 const manual={...counts[1],document:{...counts[1].document,entryMode:'balance_edit' as const}};
 for(const change of [{counts:[counts[0],manual]},{entries:entries.map(e=>e.sequence==='7'?{...e,countId:null}:e)},{counts:[counts[0],{...counts[1],changes:[{...counts[1].changes[0],expected:'99'}]}]},{ledgerMatches:false},{recipeIssues:['missing recipe']}])expect(compareConsumption({...input,...change}).status).toBe('incomplete');
});
it('retains immutable shortage warnings and unchecked theoretical quantities without automatic backfill',()=>{
 const r=compareConsumption({...input,theoretical:'30',selectedRequired:'25',shortage:'5'});expect(r.actual).toBe('23');expect(r.variance).toBe('-7');expect(r.shortage).toBe('5');expect(r.selectedRequired).toBe('25');
});
it('keeps explicit zero costs valid and an empty closing balance unpriced',()=>{
 expect(compareConsumption({...input,entries:entries.map(e=>({...e,amount:'0'}))}).varianceCost).toBe('0');
 const empty=[entry(1,'20','receipt.post','2026-10-09'),entry(2,'-20','sales.issue')];
 const r=compareConsumption({...input,entries:empty,counts:[count('open','2026-10-09','1','20','20','none'),count('close','2026-10-10','2','0','0','none')]});expect(r.actual).toBe('20');expect(r.status).toBe('complete');expect(r.unitCost).toBeNull();expect(r.varianceCost).toBeNull();
});
it('subtracts physical surplus from actual consumption, and leaves zero theoretical percentage undefined',()=>{
 const r=compareConsumption({...input,theoretical:'0',entries:[entry(1,'100','receipt.post','2026-10-09'),entry(2,'-20','sales.issue'),entry(3,'2','count.adjust','2026-10-10','close')],counts:[counts[0],count('close','2026-10-10','2','80','82','3')]});expect(r.actual).toBe('18');expect(r.variancePercent).toBeNull();
});
it('does not mix another location or material into a comparison',()=>{
 expect(compareConsumption({...input,entries:[...entries,{...entry(8,'999','sales.issue'),locationId:'other'},{...entry(9,'999','sales.issue'),itemId:'beans'}]}).actual).toBe('23');
});
it('resolves stocked boundaries and all ingredients independently of selective deduction',()=>{
 const versions=[{recipeId:'meal',versionId:'meal-v1',definition:{outputMode:'non_stocked',outputQuantity:'2',lines:[{kind:'material',itemId:'rice',quantity:'1'},{kind:'recipe',recipeId:'sauce',versionId:'sauce-v1',quantity:'2'}],salesStockItemIds:['rice']}},{recipeId:'sauce',versionId:'sauce-v1',definition:{outputMode:'stocked',outputItemId:'sauce-item',outputQuantity:'1',lines:[{kind:'material',itemId:'tomato',quantity:'10'}]}}] as RecipeVersion[];
 const r=theoreticalConsumption([{versionId:'meal-v1',outputPerSale:'1',quantity:'4',locationId:'kitchen',businessDate:'2026-10-10'}],versions);
 expect(r.quantities.get(JSON.stringify(['kitchen','rice']))).toBe('2');expect(r.quantities.get(JSON.stringify(['kitchen','sauce-item']))).toBe('4');expect(r.quantities.has(JSON.stringify(['kitchen','tomato']))).toBe(false);expect(r.issues.size).toBe(0);
 const invalid=theoreticalConsumption([{versionId:'absent',outputPerSale:'1',quantity:'4',locationId:'kitchen',businessDate:'2026-10-10'}],versions);expect(invalid.issues.has('kitchen')).toBe(true);
});
