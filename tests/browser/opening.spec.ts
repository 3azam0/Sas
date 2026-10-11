import {test,expect,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
async function newSite(page:Page){
 await expect(page.getByRole('heading',{name:'نظرة عامة',exact:true})).toBeVisible();
 const id=crypto.randomUUID(),name=`فرع افتتاح ${Date.now()}`;
 const response=await page.request.post('/api/v1/setup',{headers:{Origin:new URL(page.url()).origin,'X-Fodo-Generation':(await(await page.request.get('/api/v1/bootstrap')).json()).generation},data:{operationId:crypto.randomUUID(),organizationId:'grills',type:'location.save',expectedRevision:0,capturedAt:new Date().toISOString(),schemaVersion:1,record:{id,name,kind:'مطعم',active:true}}});expect(response.ok(),await response.text()).toBe(true);
 await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();
 await expect(page.getByLabel('الموقع',{exact:true}).locator('option').filter({hasText:name})).toHaveCount(1);
 await page.getByLabel('الموقع',{exact:true}).selectOption(id);return id;
}
test('multi-line opening survives offline reload, precedes waste and posts once',async({page,context})=>{
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible({timeout:30000});
 const site=await newSite(page);await page.getByRole('button',{name:'الرصيد الافتتاحي',exact:true}).click();await context.setOffline(true);
 await page.getByRole('button',{name:'إضافة رصيد افتتاحي',exact:true}).click();await page.getByLabel('مرجع الرصيد',{exact:true}).fill('رصيد افتتاح اختبار متعدد');await page.getByLabel('تاريخ الرصيد',{exact:true}).fill('2026-10-09');await page.getByLabel('مادة السطر 1',{exact:true}).selectOption('beef');await page.getByLabel('كمية السطر 1').fill('١٠');await page.getByLabel('تكلفة السطر 1').fill('٢٠');
 await page.getByRole('button',{name:'إضافة سطر',exact:true}).click();await page.getByLabel('مادة السطر 2',{exact:true}).selectOption('rice');await page.getByLabel('كمية السطر 2').fill('٣');await page.getByLabel('تكلفة السطر 2').fill('٠');await expect(page.locator('.opening-editor .operation-summary strong')).toHaveText('٢٠٠ ج.م');await page.getByRole('button',{name:'حفظ الرصيد الافتتاحي',exact:true}).click();
 await expect(page.locator('.opening-document')).toHaveCount(1);await page.reload();await page.getByLabel('الموقع',{exact:true}).selectOption(site);await page.getByRole('button',{name:'الرصيد الافتتاحي',exact:true}).click();await expect(page.locator('.opening-document')).toHaveCount(1);await expect(page.locator('.opening-document summary')).toContainText('محفوظ محلياً');
 await page.getByRole('button',{name:'تسجيل هالك',exact:true}).click();await page.getByLabel('المادة',{exact:true}).selectOption('beef');await page.getByLabel('الكمية (كجم)',{exact:true}).fill('2');await page.getByLabel('سبب الهالك',{exact:true}).fill('هالك بعد الرصيد');await page.getByRole('button',{name:'حفظ العملية',exact:true}).click();
 await context.setOffline(false);await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();
 await expect.poll(async()=>{const s=await(await page.request.get('/api/v1/bootstrap')).json();return s.balances.find((b:any)=>b.locationId===site&&b.itemId==='beef')?.quantity;},{timeout:30000}).toBe('8.000000');
 const snapshot=await(await page.request.get('/api/v1/bootstrap')).json(),doc=snapshot.openings.find((d:any)=>d.document.locationId===site).document;
 expect(snapshot.balances.find((b:any)=>b.locationId===site&&b.itemId==='beef').value).toBe('160.000000000000');expect(snapshot.entries.filter((e:any)=>e.locationId===site)).toHaveLength(3);
 expect((await page.request.post('/api/v1/openings',{headers:{Origin:new URL(page.url()).origin,'X-Fodo-Generation':(await(await page.request.get('/api/v1/bootstrap')).json()).generation},data:doc})).ok()).toBe(true);await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();await expect(page.locator('.opening-document summary')).toContainText('مقبول');
 await page.getByRole('button',{name:'سجل الحركات',exact:true}).click();await expect(page.getByRole('cell',{name:'رصيد افتتاحي',exact:true})).toHaveCount(2);
 await page.getByRole('button',{name:'الرصيد الافتتاحي',exact:true}).click();await page.screenshot({path:'test-results/fodo-opening-desktop.png',fullPage:true});
});
test('CSV mapping rejects errors before posting and opening works on a phone',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();const site=await newSite(page);await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'الرصيد الافتتاحي',exact:true}).click();await page.getByRole('button',{name:'إضافة رصيد افتتاحي',exact:true}).click();
 await page.getByLabel('ملف الرصيد الافتتاحي').setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('code,count,cost,measure\nUNKNOWN,10,20,كجم')});await page.getByLabel('عمود الوحدة',{exact:true}).selectOption('3');await page.getByRole('button',{name:'معاينة سطور CSV',exact:true}).click();await expect(page.locator('.opening-editor').getByRole('alert')).toContainText('كود المادة غير متاح');
 expect((await(await page.request.get('/api/v1/bootstrap')).json()).openings.filter((d:any)=>d.document.locationId===site)).toHaveLength(0);await expect(page.getByRole('button',{name:'حفظ الرصيد الافتتاحي',exact:true})).toBeDisabled();
 await page.getByLabel('ملف الرصيد الافتتاحي').setInputFiles({name:'opening.csv',mimeType:'text/csv',buffer:Buffer.from('code,count,cost,measure\nDR-001,١٠,٢٠,كجم')});await page.getByLabel('عمود الوحدة',{exact:true}).selectOption('3');await page.getByRole('button',{name:'معاينة سطور CSV',exact:true}).click();await expect(page.getByLabel('كمية السطر 1')).toHaveValue('10');
 await page.getByLabel('مرجع الرصيد',{exact:true}).fill('استيراد أرز افتتاحي');await page.screenshot({path:'test-results/fodo-opening-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.getByRole('button',{name:'حفظ الرصيد الافتتاحي',exact:true}).click();
 await expect.poll(async()=>{const s=await(await page.request.get('/api/v1/bootstrap')).json();return s.balances.find((b:any)=>b.locationId===site&&b.itemId==='rice')?.value;},{timeout:30000}).toBe('200.000000000000');
 const posted=(await(await page.request.get('/api/v1/bootstrap')).json()).openings.find((d:any)=>d.document.locationId===site);expect(posted.document.source).toEqual({fileName:'opening.csv',sha256:createHash('sha256').update('code,count,cost,measure\nDR-001,١٠,٢٠,كجم').digest('hex')});
});
