import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import CategorySelect,{categoryChoices,cleanCategory} from '../apps/web/src/CategorySelect';
import {navigationGroups} from '../apps/web/src/navigation';

it('keeps every category available regardless of selected category, including uncapped long catalogs',()=>{
 const categories=Array.from({length:80},(_,index)=>`فئة ${index+1}`);
 const html=renderToStaticMarkup(createElement(CategorySelect,{categories,value:'فئة 40',onSelect:()=>{},'aria-label':'فئة المادة'}));
 expect(html.match(/<option /g)).toHaveLength(81);expect(html).toContain('value="فئة 1"');expect(html).toContain('value="فئة 80"');expect(html).toContain('value="فئة 40" selected=""');
 expect(html).not.toContain('<datalist');expect(html).not.toContain('onCreate=');expect(html).not.toContain('createLabel=');
});
it('deduplicates category names while retaining the current saved value and normalizes new names',()=>{
 expect(cleanCategory('  أسماك   ومأكولات\nبحرية  ')).toBe('أسماك ومأكولات بحرية');
 expect(categoryChoices(['Food',' food ','حبوب','حبوب','أرز  ومكرونة'],'أرز  ومكرونة')).toHaveLength(3);
 expect(categoryChoices(['أرز  ومكرونة'],'أرز  ومكرونة')).toEqual(['أرز  ومكرونة']);
 expect(categoryChoices(['حبوب'],'فئة جديدة')).toContain('فئة جديدة');
});
it('preserves every workspace route exactly once in the reordered navigation',()=>{
 const routes=navigationGroups.flatMap(group=>group.views);
 expect(new Set(routes).size).toBe(routes.length);
 expect([...routes].sort()).toEqual(['finance','reports','pos','kitchenDisplay','overview','inventory','setup','suppliers','opening','purchasing','returns','transfers','counts','recipes','production','sales','kitchenIssues','activity','sync','guide'].sort());
});
