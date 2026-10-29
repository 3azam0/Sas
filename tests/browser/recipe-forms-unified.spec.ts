import {test,expect,type Page} from '@playwright/test';
import {selectCatalog} from './catalog-control';

async function navigate(page:Page,name:string){
 const nav=page.getByRole('navigation',{name:'التنقل الرئيسي',exact:true});
 if(!await nav.isVisible()){const menu=page.getByRole('button',{name:'القائمة',exact:true});await menu.click();await page.getByRole('dialog').getByRole('button',{name,exact:true}).click();return;}
 const target=nav.getByRole('button',{name,exact:true,includeHidden:true});
 if(!await target.isVisible())await nav.locator('details').filter({has:page.getByRole('button',{name,exact:true,includeHidden:true})}).locator('summary').click();await target.click();
}
test.use({actionTimeout:20000});
test('unified recipe forms generate codes and keep average costs independent from the last-receipt comparison',async({page,baseURL})=>{
 test.setTimeout(120000);expect(baseURL).toMatch(/^http:\/\/127\.0\.0\.1:/);
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible({timeout:45000});
 const snapshot=async()=>await(await page.request.get('/api/v1/bootstrap')).json(),initial=await snapshot(),suffix=Date.now().toString(),name=`وصفة تلقائية ${suffix}`;
 const headers={Origin:baseURL!,'X-Fodo-Generation':initial.generation};
 const price=await page.request.post('/api/v1/commands',{headers,data:{generation:initial.generation,operationId:crypto.randomUUID(),organizationId:'grills',locationId:'central',type:'receipt.post',itemId:'rice',quantity:'1',unitCost:'100',reason:'Isolated browser comparison fixture',businessDate:'2026-10-29',capturedAt:new Date().toISOString(),schemaVersion:1}});expect(price.ok(),await price.text()).toBe(true);
 await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();await page.getByLabel('الموقع',{exact:true}).selectOption('central');await navigate(page,'الوصفات والتكاليف');
 await page.getByRole('button',{name:'إضافة وصفة',exact:true}).click();await expect(page.getByLabel('كود الوصفة',{exact:true})).not.toBeEditable();await page.getByLabel('اسم الوصفة',{exact:true}).fill(name);await page.getByLabel('ناتج دفعة الوصفة',{exact:true}).fill('2');await page.getByLabel('وحدة ناتج الوصفة',{exact:true}).selectOption('قطعة');await page.getByLabel('سعر بيع الوصفة الصافي',{exact:true}).fill('100');await page.getByRole('button',{name:'إضافة مكون',exact:true}).click();await selectCatalog(page,page.getByLabel('مكون الوصفة 1',{exact:true}),'rice');await page.getByLabel('كمية مكون الوصفة 1',{exact:true}).fill('1');await page.getByRole('button',{name:'حفظ مسودة الوصفة',exact:true}).click();
 await expect.poll(async()=>(await snapshot()).recipes.find((r:any)=>r.definition.name===name)?.definition.code,{timeout:30000}).toMatch(/^REC-\d{6,}$/);
 const before=await snapshot(),balance=before.balances.find((b:any)=>b.locationId==='central'&&b.itemId==='rice'),format=(v:number)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(v);
 await expect(page.getByTestId('recipe-batch-cost')).toHaveText(format(Number(balance.value)/Number(balance.quantity))+' ج.م');const primary=await page.getByTestId('recipe-batch-cost').textContent();await page.getByLabel('مقارنة بآخر سعر استلام',{exact:true}).check();await expect(page.getByTestId('recipe-comparison-batch-cost')).toHaveText(format(100)+' ج.م');await expect(page.getByTestId('recipe-batch-cost')).toHaveText(primary!);
 await page.screenshot({path:'test-results/recipe-forms-unified-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/recipe-forms-unified-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
 await navigate(page,'إعداد المخزون');await page.getByRole('button',{name:'إضافة مادة',exact:true}).click();await expect(page.getByLabel('كود المادة',{exact:true})).not.toBeEditable();await page.getByLabel('اسم السجل',{exact:true}).fill(`مادة تلقائية ${suffix}`);await page.getByLabel('وحدة المخزون',{exact:true}).selectOption({label:'كجم'});await page.getByRole('button',{name:'حفظ الإعدادات',exact:true}).click();await expect.poll(async()=>(await snapshot()).items.find((i:any)=>i.name===`مادة تلقائية ${suffix}`)?.sku,{timeout:30000}).toMatch(/^MAT-\d{6,}$/);
 const after=await snapshot();expect(after.balances).toEqual(before.balances);expect(after.entries).toEqual(before.entries);
});

