import {decimal} from '@saas/domain';
import {normalizeNumber} from '../../../packages/domain/opening-import';

export type ReceivingLine={lineId:string;itemId:string;selection:string;factor:string;enteredQuantity:string;unitCost:string};
const valid=(value:string)=>/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(value);
const bounded=(quantity:string,factor:string)=>{const base=decimal(quantity).mul(factor);return base.gt(0)&&base.decimalPlaces()<=6&&base.lte('999999999.999999');};
type Failure='item'|'quantity'|'factor'|'cost'|'incompatible'|'capacity'|'missing-edit';
type Result={ok:false;reason:Failure}|{ok:true;lines:ReceivingLine[];line:ReceivingLine;action:'added'|'merged'|'updated'};

/** A receipt has one line per material. Never silently merge different prices or package contents. */
export function commitReceivingEntry(lines:ReceivingLine[],entry:ReceivingLine,factorFor:(line:ReceivingLine)=>string,editingId?:string|null):Result{
 if(!entry.itemId)return {ok:false,reason:'item'};
 const quantity=normalizeNumber(entry.enteredQuantity),cost=normalizeNumber(entry.unitCost),factor=normalizeNumber(factorFor(entry));
 if(!valid(quantity)||decimal(quantity).lte(0))return {ok:false,reason:'quantity'};
 if(!valid(factor)||decimal(factor).lte(0))return {ok:false,reason:'factor'};
 if(!bounded(quantity,factor))return {ok:false,reason:'quantity'};
 if(!valid(cost))return {ok:false,reason:'cost'};
 const target=editingId?lines.find(line=>line.lineId===editingId):lines.find(line=>line.itemId===entry.itemId);
 if(editingId&&(!target||target.itemId!==entry.itemId))return {ok:false,reason:'missing-edit'};
 if(!target&&lines.length>=200)return {ok:false,reason:'capacity'};
 let enteredQuantity=decimal(quantity).toString();
 if(target&&!editingId){
  const previousFactor=normalizeNumber(factorFor(target));
  if(target.selection!==entry.selection||!valid(previousFactor)||!valid(target.unitCost)||!decimal(previousFactor).eq(factor)||!decimal(target.unitCost).eq(cost))return {ok:false,reason:'incompatible'};
  enteredQuantity=decimal(target.enteredQuantity).add(quantity).toString();
  if(!valid(enteredQuantity)||!bounded(enteredQuantity,factor))return {ok:false,reason:'quantity'};
 }
 const line={...entry,lineId:target?.lineId??entry.lineId,enteredQuantity,unitCost:decimal(cost).toString(),factor};
 return {ok:true,line,lines:[line,...lines.filter(previous=>previous.lineId!==line.lineId)],action:editingId?'updated':target?'merged':'added'};
}
