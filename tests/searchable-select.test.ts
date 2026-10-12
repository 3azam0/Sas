import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SearchableSelect,matchesSearch} from '../apps/web/src/FormControls';

it('has one accessible combobox with the selected label and a separate stored form value',()=>{
 const html=renderToStaticMarkup(createElement(SearchableSelect,{'aria-label':'المادة',name:'itemId',value:'rice',required:true,onChange:()=>{}},createElement('option',{value:'rice'},'أرز · DR-001'),createElement('option',{value:'beef',disabled:true},'لحم')));
 expect(html.match(/role="combobox"/g)).toHaveLength(1);
 expect(html).toContain('value="أرز · DR-001"');expect(html).toContain('aria-required="true"');
 expect(html).toMatch(/<select[^>]*hidden=""[^>]*tabindex="-1"[^>]*aria-hidden="true"[^>]*name="itemId"/);
 expect(html).toContain('<option value="rice" selected="">');expect(html).toContain('<option value="beef" disabled="">');
 expect(html).not.toContain('aria-label="بحث المادة"');
});
it('an unselected required catalog stays empty instead of silently choosing the first option',()=>{
 const html=renderToStaticMarkup(createElement(SearchableSelect,{'aria-label':'المادة',value:'',required:true,onChange:()=>{}},createElement('option',{value:'rice'},'أرز')));
 expect(html).toContain('<option value="" selected="">');expect(html).not.toContain('<option value="rice" selected="">');
 expect(html).toContain('value=""');
});
it('search tolerates Arabic marks/alef variants and matches codes without changing the stored item',()=>{
 expect(matchesSearch('أَرْز مطبخ · RICE-020','ارز')).toBe(true);
 expect(matchesSearch('إدارة · KiT-12','kit-12')).toBe(true);
 expect(matchesSearch('سُكَّر','سكر')).toBe(true);
 expect(matchesSearch('أرز  ·  DR-001','ارز · dr-001')).toBe(true);
 expect(matchesSearch('أرز · DR-001','DR-002')).toBe(false);
});
