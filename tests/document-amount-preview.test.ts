import {describe,it,expect} from 'vitest';
import {documentAmountPreview} from '../apps/web/src/document-amount-preview';

describe('document amount display',()=>{
 it('retains completed amounts when a new row is empty, and distinguishes explicit zero cost',()=>{
  expect(documentAmountPreview([{quantity:'2',unitCost:'20'},{quantity:'',unitCost:''},{quantity:'3',unitCost:'0'}])).toEqual({amount:'40',completeCount:2,incompleteCount:1});
 });
 it('normalizes Arabic decimals and multiplies receiving factors without floating-point loss',()=>{
  expect(documentAmountPreview([{quantity:'٢',unitCost:'٠٫١',factor:'٣'}])).toEqual({amount:'0.6',completeCount:1,incompleteCount:0});
 });
 it('excludes negative, invalid and unpostable converted quantities from the displayed subtotal',()=>{
  expect(documentAmountPreview([{quantity:'-1',unitCost:'20'},{quantity:'1',unitCost:'abc'},{quantity:'0.000001',unitCost:'1',factor:'0.1'},{quantity:'999999999',unitCost:'1',factor:'2'}])).toEqual({amount:'0',completeCount:0,incompleteCount:4});
 });
});
