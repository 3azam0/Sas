import {describe,it,expect} from 'vitest';
import {commitReceivingEntry,type ReceivingLine} from '../apps/web/src/receiving-entry';
const line=(itemId='rice',quantity='1',cost='20',selection='',factor='1'):ReceivingLine=>({lineId:itemId+'-line',itemId,enteredQuantity:quantity,unitCost:cost,selection,factor});
const factor=(entry:ReceivingLine)=>entry.factor;
describe('receiving receipt entry',()=>{
 it('adds newest first and merges compatible quantities exactly without mutating prior lines',()=>{
  const rows=[line('oil'),line('rice','0.1')];
  const result=commitReceivingEntry(rows,{...line('rice','٠٫٢','٢٠٫٠'),lineId:'new'},factor);
  expect(result).toMatchObject({ok:true,action:'merged',line:{lineId:'rice-line',enteredQuantity:'0.3',unitCost:'20'}});
  if(result.ok)expect(result.lines.map(l=>l.itemId)).toEqual(['rice','oil']);
  expect(rows[1].enteredQuantity).toBe('0.1');
 });
 it('refuses to silently change purchase price, receiving unit or package contents during a merge',()=>{
  const original=line('rice','2','20','bag','5');
  for(const entry of [line('rice','1','30','bag','5'),line('rice','1','20','unit:kg','5'),line('rice','1','20','bag','10')]){
   expect(commitReceivingEntry([original],entry,factor)).toEqual({ok:false,reason:'incompatible'});
  }
  expect(original).toMatchObject({enteredQuantity:'2',factor:'5',unitCost:'20'});
 });
 it('edits replace quantities and can explicitly change receiving units and costs while retaining identity',()=>{
  const result=commitReceivingEntry([line('rice','2')],line('rice','500','30','unit:g','0.001'),factor,'rice-line');
  expect(result).toMatchObject({ok:true,action:'updated',line:{lineId:'rice-line',enteredQuantity:'500',unitCost:'30',selection:'unit:g',factor:'0.001'}});
  expect(commitReceivingEntry([line()],line('oil'),factor,'rice-line')).toEqual({ok:false,reason:'missing-edit'});
 });
 it('requires explicit nonnegative costs and positive quantities and factors, including converted precision and bounds',()=>{
  expect(commitReceivingEntry([],line('rice','1','0'),factor)).toMatchObject({ok:true,line:{unitCost:'0'}});
  for(const cost of ['', '-1','NaN','1.0000001'])expect(commitReceivingEntry([],line('rice','1',cost),factor)).toEqual({ok:false,reason:'cost'});
  for(const qty of ['0','-1','1000000000','0.0000001'])expect(commitReceivingEntry([],line('rice',qty),factor)).toEqual({ok:false,reason:'quantity'});
  expect(commitReceivingEntry([],line('rice','0.000001','20','g','0.001'),factor)).toEqual({ok:false,reason:'quantity'});
  expect(commitReceivingEntry([],line('rice','999999999','20','bag','2'),factor)).toEqual({ok:false,reason:'quantity'});
  expect(commitReceivingEntry([],line('rice','1','20','bag','0'),factor)).toEqual({ok:false,reason:'factor'});
  expect(commitReceivingEntry([line('rice','999999999')],line('rice','1'),factor)).toEqual({ok:false,reason:'quantity'});
 });
 it('caps distinct materials at 200 while allowing compatible merges and explicit edits',()=>{
  const full=Array.from({length:200},(_,i)=>line('item-'+i));
  expect(commitReceivingEntry(full,line('extra'),factor)).toEqual({ok:false,reason:'capacity'});
  expect(commitReceivingEntry(full,line('item-199'),factor)).toMatchObject({ok:true,action:'merged',line:{enteredQuantity:'2'}});
  expect(commitReceivingEntry(full,line('item-199','4','30'),factor,'item-199-line')).toMatchObject({ok:true,action:'updated',line:{enteredQuantity:'4',unitCost:'30'}});
 });
});
