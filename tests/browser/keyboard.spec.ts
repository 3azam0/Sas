import {test,expect,type Page} from '@playwright/test';
async function enter(page:Page){await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible({timeout:30000});}
test('receiving keyboard adds to the list, merges exactly and protects unfinished entries',async({page})=>{
 await enter(page);const posts:string[]=[];page.on('request',request=>{if(request.method()==='POST')posts.push(request.url());});
 await page.getByRole('button',{name:'استلام مواد',exact:true}).click();const dialog=page.getByRole('dialog',{name:'استلام مواد',exact:true});
 await expect(dialog.getByLabel('المورد',{exact:true})).toBeFocused();await dialog.getByLabel('المورد',{exact:true}).press('Enter');await expect(dialog.getByLabel('تاريخ الاستلام',{exact:true})).toBeFocused();
 await dialog.getByLabel('تاريخ الاستلام',{exact:true}).press('Enter');await dialog.getByLabel('مرجع الاستلام',{exact:true}).press('Enter');await expect(dialog.getByLabel('المادة',{exact:true})).toBeFocused();
 await dialog.getByLabel('المادة',{exact:true}).press('Shift+Enter');await expect(dialog.getByLabel('مرجع الاستلام',{exact:true})).toBeFocused();
 const material=dialog.getByLabel('المادة',{exact:true});await material.fill('أرز');await material.press('Enter');
 const quantity=dialog.getByRole('textbox',{name:/^الكمية/}),cost=dialog.getByLabel('تكلفة الوحدة (ج.م)',{exact:true});
 await expect(quantity).toBeFocused();await quantity.fill('0.1');await quantity.press('Enter');await expect(cost).toBeFocused();await cost.fill('20');await cost.press('Enter');
 await expect(material).toBeFocused();await expect(dialog.locator('.kitchen-receipt-list>li')).toHaveCount(1);expect(posts).toEqual([]);
 await material.press('Escape');await dialog.getByRole('button',{name:'تعديل أرز مصري',exact:true}).click();await expect(dialog.getByRole('button',{name:'حفظ تعديل المادة',exact:true})).toBeVisible();await dialog.getByRole('button',{name:'إلغاء تعديل المادة',exact:true}).click();
 await material.fill('أرز');await material.press('Enter');await quantity.fill('0.2');await cost.fill('20');await cost.press('Alt+Insert');
 await expect(dialog.locator('.kitchen-receipt-list>li')).toHaveCount(1);await expect(dialog.locator('.document-summary strong')).toHaveText('٦ ج.م');
 await material.fill('أرز');await material.press('Enter');await quantity.fill('1');await quantity.press('Control+Enter');
 await expect(dialog.getByRole('alert')).toContainText('أضف المادة الحالية');expect(posts).toEqual([]);
 await dialog.getByRole('button',{name:'إلغاء',exact:true}).click();
});

test('setup supports Enter and Shift+Enter and restores the trigger after Escape',async({page})=>{
 await enter(page);await page.getByRole('button',{name:'الموردون',exact:true}).click();const trigger=page.getByRole('button',{name:'إضافة مورد',exact:true});await trigger.click();const name=page.getByLabel('اسم السجل',{exact:true});await expect(name).toBeFocused();await name.fill('مورد للتجربة');await name.press('Enter');const phone=page.getByLabel('هاتف المورد',{exact:true});await expect(phone).toBeFocused();await phone.press('Shift+Enter');await expect(name).toBeFocused();await name.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(trigger).toBeFocused();
});

test('keyboard guide is available from the workspace and returns focus after Escape',async({page})=>{
 await enter(page);const trigger=page.getByRole('button',{name:'اختصارات لوحة المفاتيح',exact:true});await trigger.click();const guide=page.getByRole('dialog',{name:'اختصارات لوحة المفاتيح',exact:true});await expect(guide).toBeVisible();await expect(guide.getByText('Alt + Insert',{exact:true})).toBeVisible();await expect(guide.getByRole('button',{name:'إغلاق دليل لوحة المفاتيح',exact:true})).toBeFocused();await page.setViewportSize({width:390,height:844});expect(await guide.locator('.keyboard-guide-body').evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);await guide.getByRole('button',{name:'إغلاق دليل لوحة المفاتيح',exact:true}).press('Escape');await expect(guide).toHaveCount(0);await expect(trigger).toBeFocused();
});

test('count keyboard navigation skips excluded rows and crosses pages inside the filter',async({page})=>{
 await page.route('**/api/v1/bootstrap',async route=>{const response=await route.fetch(),snapshot=await response.json(),rice=snapshot.items.find((item:any)=>item.id==='rice');snapshot.items=Array.from({length:60},(_,index)=>({...rice,id:crypto.randomUUID(),sku:`KEY-${index}`,name:`مادة ${index}`,category:index%2?'مستبعدة':'مطابقة'}));await route.fulfill({response,json:snapshot});});
 await enter(page);await page.getByRole('button',{name:'الجرد والتسوية',exact:true}).click();await page.getByRole('button',{name:'جرد جديد',exact:true}).click();await page.getByLabel('تصنيف الجرد',{exact:true}).selectOption('مطابقة');
 const rows=page.locator('form [data-collection-row]:not([data-keyboard-excluded=true])');await rows.nth(24).locator('input').press('Enter');await expect(rows.nth(25).locator('input')).toBeFocused();await expect(rows.nth(25)).toBeVisible();await expect(page.getByLabel('تصنيف الجرد',{exact:true})).toHaveValue('مطابقة');await rows.nth(25).locator('input').press('Shift+Enter');await expect(rows.nth(24).locator('input')).toBeFocused();await expect(rows.nth(24)).toBeVisible();await page.getByRole('button',{name:'إغلاق الجرد',exact:true}).click();
});
