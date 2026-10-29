import {describe,it,expect} from 'vitest';
import type {Command} from '@saas/contracts';
import {centralMaterialAvailability} from '../apps/web/src/central-availability';

const snapshot={organizationId:'grills',generation:'current',acceptedOperationIds:['accepted'],balances:[{locationId:'warehouse',itemId:'beef',quantity:'10',value:'100',average:'10'}]};
const command=(operationId:string,quantity:string,patch:Partial<Command>={}):Command=>({operationId,organizationId:'grills',generation:'current',locationId:'warehouse',itemId:'beef',quantity,type:'waste.post',reason:'test',businessDate:'2026-10-29',capturedAt:'2026-10-29T12:00:00.000Z',schemaVersion:1,...patch});

describe('material availability for batch planning and issuance',()=>{
 it('shows real stock, pending deductions and shortage without crediting pending receipts',()=>{
  const [row]=centralMaterialAvailability(snapshot,[command('issue','3'),command('incoming','20',{type:'receipt.post',unitCost:'10'})],'warehouse',[{itemId:'beef',quantity:'9'}]);
  expect(row).toMatchObject({confirmed:'10.000000',pending:'3.000000',available:'7.000000',required:'9.000000',shortage:'2.000000'});
 });
 it('aggregates repeated ingredient lines instead of reusing stock for each line',()=>{
  const [row]=centralMaterialAvailability(snapshot,[],'warehouse',[{itemId:'beef',quantity:'6'},{itemId:'beef',quantity:'5'}]);
  expect(row).toMatchObject({required:'11.000000',shortage:'1.000000',lineCount:2});
 });
 it('ignores accepted, foreign and stale claims and counts duplicate queued identities only once',()=>{
  const rows=[command('accepted','8'),command('other-tenant','8',{organizationId:'other'}),command('other-location','8',{locationId:'kitchen'}),command('stale','8',{generation:'old'}),command('pending','2'),command('pending','2')];
  expect(centralMaterialAvailability(snapshot,rows,'warehouse',[{itemId:'beef',quantity:'7'}])[0]).toMatchObject({pending:'2.000000',available:'8.000000',shortage:'0.000000',remaining:'1.000000'});
 });
 it('retains micro quantities exactly and accepts Arabic quantity input',()=>{
  const tiny={...snapshot,balances:[{...snapshot.balances[0],quantity:'0.3'}]};
  expect(centralMaterialAvailability(tiny,[command('pending','0.1')],'warehouse',[{itemId:'beef',quantity:'٠٫٢٠٠٠٠١'}])[0].shortage).toBe('0.000001');
 });
 it('treats absent stock as zero and marks incomplete demand without throwing',()=>{
  const rows=centralMaterialAvailability(snapshot,[],'warehouse',[{itemId:'onion',quantity:'2'},{itemId:'beef',quantity:''},{itemId:'',quantity:'1'}]);
  expect(rows).toHaveLength(2);expect(rows[0].shortage).toBe('2.000000');expect(rows[1].complete).toBe(false);
 });
 it('clamps spendable stock when prior pending issues already exceed confirmed stock',()=>{
  expect(centralMaterialAvailability(snapshot,[command('pending','12')],'warehouse',[{itemId:'beef',quantity:'1'}])[0]).toMatchObject({available:'0.000000',shortage:'1.000000'});
 });
});
