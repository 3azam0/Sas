import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {matchesStockFilter,stockStatus,presetRange} from '../apps/web/src/filter-helpers';
import FilterToolbar,{FilterSelect} from '../apps/web/src/FilterToolbar';
import Collection from '../apps/web/src/Collection';
describe('stock availability and minimum thresholds',()=>{
 it('never labels a zero balance as available even with no minimum configured',()=>{
  expect(stockStatus('0','0').label).toBe('رصيد صفر');
  expect(stockStatus('0.000000','10').label).toBe('رصيد صفر');
  expect(matchesStockFilter('available','0','0')).toBe(false);
  expect(matchesStockFilter('zero','0','10')).toBe(true);
  expect(matchesStockFilter('low','0','10')).toBe(true);
 });
 it('distinguishes positive availability, low levels and inactive materials using exact decimals',()=>{
  expect(stockStatus('0.000001','0').label).toBe('متوفر');
  expect(stockStatus('1','2').label).toBe('تحت الحد الأدنى');
  expect(stockStatus('3','2',false).label).toBe('غير نشط');
  expect(matchesStockFilter('available','1','2')).toBe(true);
  expect(matchesStockFilter('low','1','2',false)).toBe(false);
  expect(matchesStockFilter('inactive','3','2',false)).toBe(true);
 });
});
it('uses inclusive date presets across month/year boundaries without changing source document dates',()=>{
 expect(presetRange('today','2027-01-03')).toEqual({from:'2027-01-03',to:'2027-01-03'});
 expect(presetRange('week','2027-01-03')).toEqual({from:'2026-12-28',to:'2027-01-03'});
 expect(presetRange('month','2027-01-03')).toEqual({from:'2027-01-01',to:'2027-01-03'});
 expect(presetRange('thirty','2024-03-01')).toEqual({from:'2024-02-01',to:'2024-03-01'});
});
it('exposes individually named removable filters and a single reset action with accessible expansion',()=>{
 const html=renderToStaticMarkup(createElement(FilterToolbar,{title:'الاستلام',primary:createElement('label',null,'المورد',createElement('select',{'aria-label':'المورد'})),advanced:createElement('label',null,'الفترة'),chips:[{key:'supplier',label:'المورد: مورد الأرز',clear:()=>{}}],reset:()=>{}}));
 expect(html).toContain('إزالة تصفية: المورد: مورد الأرز');expect(html).toContain('مسح الكل');
 expect(html).toContain('aria-expanded="false"');expect(html).toContain('aria-controls=');
});
it('keeps all original inventory records in the result denominator when the caller applies filters',()=>{
 const html=renderToStaticMarkup(createElement(Collection<{id:string}>,{title:'المواد',rows:[{id:'rice'}],toolbar:{chips:[],clear:()=>{},total:338,scope:'المخزن الرئيسي'},children:rows=>createElement('p',null,rows.length)}));
 expect(html).toContain('١ نتيجة');expect(html).toContain('٣٣٨');expect(html).toContain('المخزن الرئيسي');
});
it('keeps the All option available to filter selectors without leaking filter-only props into the input',()=>{
 const html=renderToStaticMarkup(createElement(FilterSelect,{'aria-label':'الفئة',value:'',onChange:()=>{}},createElement('option',{value:''},'كل الفئات'),createElement('option',{value:'rice'},'أرز')));
 expect(html).toContain('value="" selected=""');expect(html).not.toContain('includeEmptyOption');expect(html).not.toContain('required=""');
});
