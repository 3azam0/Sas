import {it,expect} from 'vitest';
import {parseOpeningCSV,mapOpeningCSV} from '../packages/domain/opening-import';
const items=[{id:'rice',name:'أرز',sku:'001',category:'مواد',unit:'كجم',unitId:'kg',minimum:'0'}];
const mapping={sku:0,quantity:1,unitCost:2,unit:3};
it('maps quoted UTF-8 CSV and Arabic numerals without changing text codes',()=>{
 const rows=parseOpeningCSV('\uFEFFsku,quantity,unitCost,unit\r\n"001",١٠٫٢٥,٢٠,كجم\r\n');
 expect(mapOpeningCSV(rows,mapping,items)).toEqual({lines:[{itemId:'rice',unitId:'kg',quantity:'10.25',unitCost:'20'}],errors:[]});
 expect(parseOpeningCSV('sku,quantity,unitCost,note\n001,1,0,"a,b\nquoted ""word"""')[1][3]).toBe('a,b\nquoted "word"');
});
it('reports unknown codes, repeated materials, wrong units and malformed numbers per row',()=>{
 expect(mapOpeningCSV(parseOpeningCSV('sku,quantity,unitCost,unit\n001,1,2,لتر\nUNKNOWN,1,2,كجم\n001,-1,2,كجم'),mapping,items).errors).toHaveLength(3);
 expect(mapOpeningCSV(parseOpeningCSV('sku,quantity,unitCost,unit\n001,0,2,كجم'),mapping,items).errors[0]).toContain('السطر 2');
 expect(()=>mapOpeningCSV([['sku','q','c'],['001','1','2']],{...mapping,unit:-1,quantity:0},items)).toThrow();
});
it('bounds import size and row count and rejects malformed quoting or headers',()=>{
 expect(()=>parseOpeningCSV('sku,q,c\n'+Array(201).fill('001,1,2').join('\n'))).toThrow('٢٠٠');
 expect(()=>parseOpeningCSV('x'.repeat(1024*1024+1))).toThrow('ميجابايت');
 expect(()=>parseOpeningCSV('sku,q,c\n"001,1,2')).toThrow('اقتباس');
 expect(()=>parseOpeningCSV('sku,sku,c\n001,1,2')).toThrow('مختلفة');
});
