import {it,expect} from 'vitest';
import type {Snapshot,RecipeVersion,SalesLine} from '@saas/contracts';
import {salesReport} from '../packages/domain/sales-report';
const version:RecipeVersion={recipeId:'r',versionId:'v',versionNumber:1,definition:{code:'R',name:'Rice meal',outputMode:'non_stocked',outputQuantity:'2',outputUnitId:'piece',effectiveDate:'2026-10-01',lines:[{lineId:'i',kind:'material',itemId:'rice',unitId:'kg',inputUnit:'base',enteredQuantity:'1',quantity:'1'}]},publishedAt:'2026-10-01'};
const sale:SalesLine={lineId:'s',transactionId:'1',lineKey:'1',businessDate:'2026-10-10',menuItemId:'m',menuCode:'R',menuName:'Rice meal',mappingRevision:1,versionId:'v',outputPerSale:'1',quantity:'6',netAmount:'120'};
const snapshot={organizationId:'real-tenant',fetchedAt:'2026-10-11T00:00:00Z',items:[{id:'rice',name:'Rice',unit:'kg'},{id:'prepared',name:'Prepared rice',unit:'kg'}],balances:[{itemId:'rice',locationId:'a',quantity:'10',value:'280'},{itemId:'prepared',locationId:'a',quantity:'10',value:'500'}],recipeVersions:[version],salesImports:[{document:{source:'POS',locationId:'a',lines:[sale]},acceptedLineIds:['s']}]} as unknown as Snapshot;
it('uses pinned output-per-sale, aggregates only accepted unique sales, and leaves stock untouched',()=>{
 const s=structuredClone(snapshot),before=JSON.stringify(s);s.salesImports!.push(structuredClone(s.salesImports![0]));s.salesImports![1].document.lines.push({...sale,lineId:'pending',transactionId:'2'});
 const r=salesReport(s,'a');expect(r.count).toBe(1);expect(r.lines[0].quantity).toBe('3');expect(r.estimatedCost).toBe('84');expect(r.foodCostPercent).toBe('70');expect(snapshot).toEqual(JSON.parse(before));expect(salesReport(s,'other').count).toBe(0);expect(salesReport(s,'a','2026-10-11').count).toBe(0);
});
it('stops at stocked root and child boundaries, avoiding raw-material double counting',()=>{
 const s=structuredClone(snapshot);s.recipeVersions![0].definition={...version.definition,outputMode:'stocked',outputItemId:'prepared'};expect(salesReport(s,'a').lines).toMatchObject([{itemId:'prepared',quantity:'6',amount:'300'}]);
 s.recipeVersions!.push({...version,recipeId:'parent',versionId:'p',definition:{...version.definition,lines:[{lineId:'child',kind:'recipe',versionId:'v',unitId:'kg',inputUnit:'base',enteredQuantity:'1',quantity:'1'}]}});s.salesImports![0].document.lines[0].versionId='p';expect(salesReport(s,'a').lines).toMatchObject([{itemId:'prepared',quantity:'3',amount:'150'}]);
});
it('distinguishes missing prices from zero prices and missing recipe versions',()=>{
 const s=structuredClone(snapshot);s.balances=[];expect(salesReport(s,'a').estimatedCost).toBeNull();s.receiptPrices=[{locationId:'a',itemId:'rice',unitCost:'0',businessDate:'2026-10-09',sourceOperationId:'zero',postedAt:'2026-10-09'}];expect(salesReport(s,'a','','','latest_receipt').estimatedCost).toBe('0');s.salesImports![0].document.lines[0].netAmount='0';expect(salesReport(s,'a','','','latest_receipt').foodCostPercent).toBeNull();s.recipeVersions=[];const r=salesReport(s,'a');expect(r.estimatedCost).toBeNull();expect(r.issues).toHaveLength(1);
});
