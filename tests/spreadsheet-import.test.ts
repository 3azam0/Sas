import {describe,expect,it} from 'vitest';
import {exportWorkbook} from '../packages/domain/export-workbook';
import {parseSpreadsheet,parseXLSX} from '../packages/domain/spreadsheet-import';
import {mapItemSpreadsheet} from '../packages/domain/item-spreadsheet-import';

describe('spreadsheet import',()=>{
 it('reads inline strings and numbers from a generated Excel workbook',()=>{
  const bytes=exportWorkbook('مواد',[['المادة','الفئة','الوحدة','الحد'],['لحم بقري','لحوم','كجم','100']]);
  expect(parseXLSX(bytes)).toEqual([['المادة','الفئة','الوحدة','الحد'],['لحم بقري','لحوم','كجم','100']]);
 });
 it('keeps CSV support and rejects the legacy Excel format',()=>{
  expect(parseSpreadsheet(new TextEncoder().encode('name,unit\nRice,kg').buffer,'items.csv')[1]).toEqual(['Rice','kg']);
  expect(()=>parseSpreadsheet(new ArrayBuffer(0),'items.xls')).toThrow('XLS القديمة');
 });
 it('maps item rows by Arabic headers and keeps generated codes out of the file',()=>{
  const result=mapItemSpreadsheet([['المادة','الفئة','الوحدة','الحد الأدنى'],['لحم بقري','لحوم','كجم','١٠٠']],[{id:'kg',name:'كجم'}],[]);
  expect(result).toEqual({items:[{name:'لحم بقري',category:'لحوم',unitId:'kg',unitName:'كجم',minimum:'100',sourceRow:2}],errors:[]});
 });
});
