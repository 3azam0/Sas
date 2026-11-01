import {decimal} from '@saas/domain';
import {normalizeNumber} from '../../../packages/domain/opening-import';

/** Sum usable editor rows without treating empty/invalid amounts as real zero-cost entries. */
export function documentAmountPreview(lines:{quantity:string;unitCost:string;factor?:string}[]){
 const numeric=(value:string)=>/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(value);
 let amount=decimal('0'),completeCount=0;
 for(const line of lines){
  const quantity=normalizeNumber(line.quantity),cost=normalizeNumber(line.unitCost),factor=normalizeNumber(line.factor??'1');
  if(!numeric(quantity)||!numeric(cost)||!numeric(factor)||decimal(quantity).lte(0)||decimal(factor).lte(0))continue;
  const base=decimal(quantity).mul(factor);if(base.decimalPlaces()>6||base.gt('999999999.999999'))continue;
  amount=amount.add(base.mul(cost));completeCount++;
 }
 return {amount:amount.toString(),completeCount,incompleteCount:lines.length-completeCount};
}
