import {selectCatalog} from './catalog-control';
import {test,expect} from '@playwright/test';

test('all catalog receiving units support offline conversion, required package contents and linked correction',async({page,context})=>{
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();
 await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible({timeout:30000});
 await page.getByLabel('الموقع',{exact:true}).selectOption('cairo');
 const before=await(await page.request.get('/api/v1/bootstrap')).json();
 await page.getByRole('button',{name:'إعداد المخزون',exact:true}).click();
 await page.getByRole('tab',{name:/وحدات المخزون/}).click();await context.setOffline(true);
 const names=['جرام','عدد','لتر','رول','أنبوبة','لوح'];
 for(const name of names){if(before.units.some((u:any)=>u.name===name))continue;
  await page.getByRole('button',{name:'إضافة وحدة',exact:true}).click();await page.getByLabel('اسم السجل').fill(name);await page.getByRole('button',{name:'حفظ الإعدادات',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible(); // Wait for the durable save before reload.
 }
 await page.reload();await page.getByLabel('الموقع',{exact:true}).selectOption('cairo');await page.getByRole('button',{name:'استلام مواد',exact:true}).click();
 await selectCatalog(page,page.getByLabel('المادة',{exact:true}),'rice');
 const options=await page.getByLabel('وحدة الاستلام',{exact:true}).locator('option').allTextContents();
 for(const name of names)expect(options).toContain(name);expect(options.some(name=>name.includes('كجم'))).toBe(true);
 await page.getByLabel('وحدة الاستلام',{exact:true}).selectOption({label:'جرام'});
 await expect(page.getByLabel('محتوى وحدة الاستلام',{exact:true})).toHaveCount(0);
 await page.getByLabel('الكمية (جرام)',{exact:true}).fill('٥٠٠');await page.getByLabel('تكلفة الوحدة (ج.م)',{exact:true}).fill('٢٠');
 const reference=`وحدات استلام ${Date.now()}`;await page.getByLabel('مرجع الاستلام',{exact:true}).fill(reference);
 await page.getByRole('button',{name:'إضافة إلى القائمة',exact:true}).click();await selectCatalog(page,page.getByLabel('المادة',{exact:true}),'beef');
 await page.getByLabel('وحدة الاستلام',{exact:true}).selectOption({label:'عدد'});
 await page.getByLabel('الكمية (عدد)',{exact:true}).fill('٢');await page.getByLabel('تكلفة الوحدة (ج.م)',{exact:true}).fill('١٠٠');
 await expect(page.getByLabel('محتوى وحدة الاستلام',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'إضافة إلى القائمة',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByLabel('محتوى وحدة الاستلام',{exact:true}).fill('0');await page.getByRole('button',{name:'إضافة إلى القائمة',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('وحدة الاستلام');
 await page.getByLabel('محتوى وحدة الاستلام',{exact:true}).fill('٥');
 await page.getByLabel('وحدة الاستلام',{exact:true}).selectOption({label:'جرام'});await page.getByLabel('وحدة الاستلام',{exact:true}).selectOption({label:'عدد'});
 await expect(page.getByLabel('محتوى وحدة الاستلام',{exact:true})).toHaveValue('');await page.getByLabel('محتوى وحدة الاستلام',{exact:true}).fill('٥');
 await page.getByRole('button',{name:'إضافة إلى القائمة',exact:true}).click();await expect(page.getByRole('dialog').locator('.document-summary strong')).toHaveText('١٬٠١٠ ج.م');
 await page.getByRole('dialog').evaluate(el=>el.scrollTop=0);await page.screenshot({path:'../Fodo-Receiving-Units.png'});await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await page.getByRole('button',{name:'تعديل لحم بقري',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'../Fodo-Receiving-Units-Mobile.png'});await page.setViewportSize({width:1280,height:900});
 await page.getByRole('button',{name:'حفظ العملية',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.reload();await page.getByRole('button',{name:'مركز المزامنة',exact:false}).first().click();
 const history=page.locator('.opening-document').filter({hasText:reference});await history.locator('summary').click();
 await expect(history.locator('tbody')).toContainText('جرام');await expect(history.locator('tbody')).toContainText('عدد');
 let rejected=false;
 await page.route('**/api/v1/receipts',async route=>{if(!rejected){rejected=true;const payload=route.request().postDataJSON();await route.fulfill({status:409,json:{operationId:payload.operationId,outcome:'needs_review',message:'رفض اختبار للتحقق من تصحيح الوحدات'}});}else await route.continue();});
 await context.setOffline(false);await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();
 await expect(history.locator('summary')).toContainText('تحتاج مراجعة');await history.getByRole('button',{name:'تصحيح الاستلام',exact:true}).click();
 await page.getByRole('button',{name:'تعديل أرز مصري',exact:true}).click();await expect(page.getByLabel('وحدة الاستلام',{exact:true})).toHaveValue(/unit:/);
 await expect(page.getByLabel('الكمية (جرام)',{exact:true})).toHaveValue('500');await page.getByRole('button',{name:'إلغاء تعديل المادة',exact:true}).click();
 await page.getByRole('button',{name:'تعديل لحم بقري',exact:true}).click();await expect(page.getByLabel('محتوى وحدة الاستلام',{exact:true})).toHaveValue('5');
 await page.getByLabel('محتوى وحدة الاستلام',{exact:true}).fill('4');await page.getByRole('button',{name:'حفظ تعديل المادة',exact:true}).click();await page.getByRole('button',{name:'حفظ العملية',exact:true}).click();
 await expect.poll(async()=>{const s=await(await page.request.get('/api/v1/bootstrap')).json();return s.receipts.filter((r:any)=>r.document.reason===reference).length;}).toBe(1);
 const after=await(await page.request.get('/api/v1/bootstrap')).json(),receipt=after.receipts.find((r:any)=>r.document.reason===reference);
 expect(receipt.document.lines.find((l:any)=>l.itemId==='rice')).toMatchObject({quantity:'0.5',enteredQuantity:'500',receivingUnit:{name:'جرام',factor:'0.001'}});
 expect(receipt.document.lines.find((l:any)=>l.itemId==='beef')).toMatchObject({quantity:'8',enteredQuantity:'2',receivingUnit:{name:'عدد',factor:'4'}});expect(Number(receipt.amount)).toBe(810);
 for(const [itemId,delta] of [['rice',0.5],['beef',8]] as const){expect(Number(after.balances.find((b:any)=>b.itemId===itemId&&b.locationId==='cairo').quantity)-Number(before.balances.find((b:any)=>b.itemId===itemId&&b.locationId==='cairo').quantity)).toBe(delta);}
 await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();expect((await(await page.request.get('/api/v1/bootstrap')).json()).receipts.filter((r:any)=>r.document.reason===reference)).toHaveLength(1);
});
