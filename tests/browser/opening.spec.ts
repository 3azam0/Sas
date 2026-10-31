import {selectCatalog} from './catalog-control';
import {test,expect,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
test.setTimeout(120000);
async function navigate(page:Page,name:string){const menu=page.getByRole('button',{name:'القائمة',exact:true});if(await menu.isVisible()){await menu.click();await page.getByRole('dialog').getByRole('button',{name,exact:true}).click();return;}const nav=page.getByRole('navigation',{name:'التنقل الرئيسي',exact:true}),button=nav.getByRole('button',{name,exact:true,includeHidden:true});if(!await button.isVisible())await nav.locator('details').filter({hasText:name}).locator('summary').click();await button.click();}
async function enterWorkspace(page:Page){const enter=page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true});await expect(enter).toBeEnabled({timeout:30000});await enter.click();await expect(page.getByRole('heading',{name:'نظرة عامة',exact:true})).toBeVisible({timeout:30000});}
async function newSite(page:Page){
 await expect(page.getByRole('heading',{name:'نظرة عامة',exact:true})).toBeVisible({timeout:30000});
 const id=crypto.randomUUID(),name=`فرع افتتاح ${Date.now()}`;
 const response=await page.request.post('/api/v1/setup',{headers:{Origin:new URL(page.url()).origin,'X-Fodo-Generation':(await(await page.request.get('/api/v1/bootstrap')).json()).generation},data:{operationId:crypto.randomUUID(),organizationId:'grills',type:'location.save',expectedRevision:0,capturedAt:new Date().toISOString(),schemaVersion:1,record:{id,name,kind:'مطعم',active:true}}});expect(response.ok(),await response.text()).toBe(true);
 await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();
 await expect(page.getByLabel('الموقع',{exact:true}).locator('option').filter({hasText:name})).toHaveCount(1);
 await page.getByLabel('الموقع',{exact:true}).selectOption(id);return id;
}
test('multi-line opening queues before waste and posts once',async({page,context})=>{
 await page.goto('/');await enterWorkspace(page);
 const site=await newSite(page);await navigate(page,'الرصيد الافتتاحي');await context.setOffline(true);
 await page.getByRole('button',{name:'إضافة رصيد افتتاحي',exact:true}).click();const editor=page.getByRole('dialog',{name:'مستند رصيد افتتاحي جديد',exact:true});await editor.getByRole('button',{name:'تفاصيل إضافية للرصيد الافتتاحي',exact:true}).click();await editor.getByLabel('مرجع الرصيد',{exact:true}).fill('رصيد افتتاح اختبار متعدد');await editor.getByLabel('تاريخ الرصيد',{exact:true}).fill('2026-10-09');await selectCatalog(page,editor.getByLabel('المادة',{exact:true}),'beef');await editor.getByLabel('الكمية (كجم)',{exact:true}).fill('١٠');await editor.getByLabel('تكلفة الوحدة (ج.م)',{exact:true}).fill('٢٠');await editor.getByRole('button',{name:'إضافة إلى القائمة',exact:true}).click();
 await selectCatalog(page,editor.getByLabel('المادة',{exact:true}),'rice');await editor.getByLabel('الكمية (كجم)',{exact:true}).fill('٣');await editor.getByLabel('تكلفة الوحدة (ج.م)',{exact:true}).fill('٠');await editor.getByRole('button',{name:'إضافة إلى القائمة',exact:true}).click();await expect(editor.locator('.document-summary strong')).toHaveText('٢٠٠ ج.م');await editor.getByRole('button',{name:'حفظ الرصيد الافتتاحي',exact:true}).click();
 await expect(page.locator('.opening-document')).toHaveCount(1);await expect(page.locator('.opening-document summary')).toContainText('محفوظ محلياً');await navigate(page,'المخزون');
 await page.getByRole('button',{name:'تسجيل هالك',exact:true}).click();await selectCatalog(page,page.getByLabel('المادة',{exact:true}),'beef');await page.getByLabel('الكمية (كجم)',{exact:true}).fill('2');await page.getByLabel('سبب الهالك',{exact:true}).fill('هالك بعد الرصيد');await page.getByRole('button',{name:'حفظ العملية',exact:true}).click();
 await context.setOffline(false);await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();
 await expect.poll(async()=>{const s=await(await page.request.get('/api/v1/bootstrap')).json();return s.balances.find((b:any)=>b.locationId===site&&b.itemId==='beef')?.quantity;},{timeout:30000}).toBe('8.000000');
 const snapshot=await(await page.request.get('/api/v1/bootstrap')).json(),doc=snapshot.openings.find((d:any)=>d.document.locationId===site).document;
 expect(snapshot.balances.find((b:any)=>b.locationId===site&&b.itemId==='beef').value).toBe('160.000000000000');expect(snapshot.entries.filter((e:any)=>e.locationId===site)).toHaveLength(3);
 expect((await page.request.post('/api/v1/openings',{headers:{Origin:new URL(page.url()).origin,'X-Fodo-Generation':(await(await page.request.get('/api/v1/bootstrap')).json()).generation},data:doc})).ok()).toBe(true);await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();await navigate(page,'الرصيد الافتتاحي');await expect(page.locator('.opening-document summary')).toContainText('مقبول');
 await navigate(page,'سجل الحركات');await expect(page.getByRole('cell',{name:'رصيد افتتاحي',exact:true})).toHaveCount(2);
 await navigate(page,'الرصيد الافتتاحي');await page.screenshot({path:'test-results/fodo-opening-desktop.png',fullPage:true});
});
test('CSV mapping rejects errors before posting and opening works on a phone',async({page})=>{
 await page.goto('/');await enterWorkspace(page);const site=await newSite(page);await page.setViewportSize({width:390,height:844});await navigate(page,'الرصيد الافتتاحي');await page.getByRole('button',{name:'إضافة رصيد افتتاحي',exact:true}).click();await page.locator('.opening-import summary').click();
 await page.getByLabel('ملف الرصيد الافتتاحي').setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('code,count,cost,measure\nUNKNOWN,10,20,كجم')});await page.getByLabel('عمود الوحدة',{exact:true}).selectOption('3');await page.getByRole('button',{name:'معاينة سطور CSV',exact:true}).click();await expect(page.locator('.opening-receipt-modal').getByRole('alert')).toContainText('كود المادة غير متاح');
 expect((await(await page.request.get('/api/v1/bootstrap')).json()).openings.filter((d:any)=>d.document.locationId===site)).toHaveLength(0);await expect(page.getByRole('button',{name:'حفظ الرصيد الافتتاحي',exact:true})).toBeDisabled();
 await page.getByLabel('ملف الرصيد الافتتاحي').setInputFiles({name:'opening.csv',mimeType:'text/csv',buffer:Buffer.from('code,count,cost,measure\nDR-001,١٠,٢٠,كجم')});await page.getByLabel('عمود الوحدة',{exact:true}).selectOption('3');await page.getByRole('button',{name:'معاينة سطور CSV',exact:true}).click();await expect(page.getByRole('article',{name:'مادة الرصيد: أرز'})).toContainText('١٠');
 await page.screenshot({path:'test-results/fodo-opening-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.getByRole('button',{name:'حفظ الرصيد الافتتاحي',exact:true}).click();
 await expect.poll(async()=>{const s=await(await page.request.get('/api/v1/bootstrap')).json();return s.balances.find((b:any)=>b.locationId===site&&b.itemId==='rice')?.value;},{timeout:30000}).toBe('200.000000000000');
 const posted=(await(await page.request.get('/api/v1/bootstrap')).json()).openings.find((d:any)=>d.document.locationId===site);expect(posted.document.reason).toBe('');expect(posted.document.source).toEqual({fileName:'opening.csv',sha256:createHash('sha256').update('code,count,cost,measure\nDR-001,١٠,٢٠,كجم').digest('hex')});
});
