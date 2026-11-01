import {describe,it,expect} from 'vitest';
import {amountSorts} from '../apps/web/src/Collection';

describe('financial list ordering',()=>{
 const rows=[{value:'9007199254740992.000002'},{value:null},{value:'9007199254740992.000001'},{value:'0'},{value:undefined}];
 const sorts=amountSorts<(typeof rows)[number]>('cost','Cost',row=>row.value);
 it('compares monetary decimals without converting to floating point',()=>{
  expect([...rows].sort(sorts[0].compare).map(row=>row.value)).toEqual(['0','9007199254740992.000001','9007199254740992.000002',null,undefined]);
 });
 it('keeps unavailable prices last when the highest cost is requested',()=>{
  expect([...rows].sort(sorts[1].compare).map(row=>row.value)).toEqual(['9007199254740992.000002','9007199254740992.000001','0',null,undefined]);
 });
});
