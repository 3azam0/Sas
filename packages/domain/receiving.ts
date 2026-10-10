import {BusinessError,type Item,type ReceiptDocument,type Unit} from '@saas/contracts';
import {decimal} from './index';

const standardUnits:Record<string,{dimension:'mass'|'volume';scale:string}>={
 kg:{dimension:'mass',scale:'1000'},'كجم':{dimension:'mass',scale:'1000'},'كيلوجرام':{dimension:'mass',scale:'1000'},'كيلو':{dimension:'mass',scale:'1000'},
 g:{dimension:'mass',scale:'1'},'جم':{dimension:'mass',scale:'1'},'جرام':{dimension:'mass',scale:'1'},
 l:{dimension:'volume',scale:'1000'},'لتر':{dimension:'volume',scale:'1000'},
 ml:{dimension:'volume',scale:'1'},'مل':{dimension:'volume',scale:'1'},'ملليلتر':{dimension:'volume',scale:'1'}
};

/** Undefined means the item's package contents must be supplied explicitly. */
export function receivingUnitFactor(baseName:string,enteredName:string):string|undefined{
 const key=(name:string)=>name.trim().toLowerCase();
 if(key(baseName)===key(enteredName))return '1';
 const base=standardUnits[key(baseName)],entered=standardUnits[key(enteredName)];
 return base&&entered&&base.dimension===entered.dimension?decimal(entered.scale).div(base.scale).toString():undefined;
}

export function validateReceiptLineConversion(line:ReceiptDocument['lines'][number],item:Pick<Item,'unitId'|'unit'|'purchaseUnits'>,units:Unit[],matchCurrentNames=true){
 let factor:string|undefined;
 if(line.purchaseUnitId)factor=item.purchaseUnits?.find(p=>p.id===line.purchaseUnitId)?.factor;
 if(line.receivingUnit){
  const chosen=line.receivingUnit,unit=units.find(u=>u.id===chosen.unitId);
  if(!unit)throw new BusinessError('INVALID_UNIT','وحدة الاستلام غير متاحة في المؤسسة.');
  if(matchCurrentNames&&(unit.name!==chosen.name||item.unit!==chosen.baseName))throw new BusinessError('INVALID_UNIT','تغيّر اسم وحدة الاستلام أو المخزون. صحّح المستند باستخدام الوحدات الحالية.');
  const standard=chosen.unitId===item.unitId?'1':receivingUnitFactor(chosen.baseName,chosen.name);
  if(standard!==undefined&&!decimal(standard).eq(chosen.factor))throw new BusinessError('INVALID_CONVERSION','معامل التحويل لا يطابق وحدة الاستلام.');
  factor=chosen.factor;
 }
 if(line.purchaseUnitId||line.receivingUnit){
  const quantity=factor&&line.enteredQuantity?decimal(line.enteredQuantity).mul(factor):null;
  if(!quantity||quantity.decimalPlaces()>6||!quantity.eq(line.quantity))throw new BusinessError('INVALID_CONVERSION','كمية وحدة الاستلام لا تطابق كمية المخزون أو تتجاوز ٦ منازل عشرية.');
 }
}
