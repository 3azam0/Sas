import {test,expect} from '@playwright/test';
test('receiving affects only the selected branch and tenant switching isolates local data',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();
 await expect(page.getByRole('heading',{name:'نظرة عامة',exact:true})).toBeVisible();
 const before=await (await page.request.get('/api/v1/bootstrap')).json();
 await page.getByLabel('الموقع',{exact:true}).selectOption('cairo');
 await page.getByRole('button',{name:'استلام مواد',exact:true}).click();
 await page.getByLabel('المادة',{exact:true}).selectOption('beef');
 await page.getByLabel('الكمية (كجم)',{exact:true}).fill('2');
 await page.getByLabel('تكلفة الوحدة (ج.م)',{exact:true}).fill('100');
 await page.getByLabel('مرجع الاستلام',{exact:true}).fill('اختبار استلام فرع القاهرة');
 await page.getByRole('button',{name:'حفظ العملية',exact:true}).click();
 await page.getByRole('button',{name:'مركز المزامنة',exact:false}).first().click();
 await expect(page.getByText('مقبولة',{exact:true})).toBeVisible({timeout:30000});
 const after=await (await page.request.get('/api/v1/bootstrap')).json();
 const quantity=(s:any,location:string)=>Number(s.balances.find((b:any)=>b.locationId===location&&b.itemId==='beef').quantity);
 expect(quantity(after,'cairo')).toBe(quantity(before,'cairo')+2);
 expect(quantity(after,'central')).toBe(quantity(before,'central'));
 await page.getByRole('button',{name:'فتح بيت المذاق',exact:true}).click();
 await expect(page.getByText('مطاعم بيت المذاق',{exact:true})).toBeVisible();
 await expect(page.getByText('ستظهر عمليات الاستلام والهالك هنا.',{exact:true})).toBeVisible();
 const other=await (await page.request.get('/api/v1/bootstrap')).json();
 expect(other.organizationId).toBe('bistro');
});
test('offline capture survives reload, converges after sync, and rejects overdraft',async({page,context})=>{
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();await expect(page.getByRole('heading',{name:'نظرة عامة',exact:true})).toBeVisible();
 await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'المخزون',exact:true}).click();
 const beef=page.getByRole('row').filter({has:page.getByRole('button',{name:/لحم بقري/})});
 const beforeText=await beef.locator('td').nth(2).innerText();
 await context.setOffline(true);await page.getByRole('button',{name:'تسجيل هالك',exact:true}).click();
 await page.getByLabel('المادة',{exact:true}).selectOption('beef');await page.getByLabel('الكمية (كجم)',{exact:true}).fill('1');await page.getByLabel('سبب الهالك',{exact:true}).fill('اختبار هالك دون اتصال');await page.getByRole('button',{name:'حفظ العملية',exact:true}).click();
 await expect(page.getByText('غير نهائي',{exact:true})).toBeVisible();expect(await beef.locator('td').nth(2).innerText()).toBe(beforeText);
 await page.reload();await expect(page.getByRole('heading',{name:'نظرة عامة',exact:true})).toBeVisible();await page.getByRole('button',{name:'مركز المزامنة',exact:false}).first().click();await expect(page.getByText('محفوظة محلياً',{exact:true})).toBeVisible();
 await context.setOffline(false);await page.getByRole('button',{name:'مزامنة الآن',exact:true}).last().click();await expect(page.getByText('مقبولة',{exact:true})).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'تسجيل هالك',exact:true}).click();await page.getByLabel('المادة',{exact:true}).selectOption('beef');await page.getByLabel('الكمية (كجم)',{exact:true}).fill('999999');await page.getByLabel('سبب الهالك',{exact:true}).fill('اختبار رصيد غير كاف');await page.getByRole('button',{name:'حفظ العملية',exact:true}).click();await expect(page.getByText('تحتاج مراجعة',{exact:true})).toBeVisible({timeout:30000});
 await page.screenshot({path:'../../work/desktop-preview.png',fullPage:true});
});
test('mobile workspace fits a phone viewport',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();await expect(page.getByRole('heading',{name:'نظرة عامة',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'../Fodo-Mobile.png',fullPage:false});});





test('Fodo filters, Arabic decimal input, cost preview, and keyboard dialog work',async({page})=>{
 await page.goto('/');await expect(page).toHaveTitle(/Fodo/);await page.screenshot({path:'../Fodo-Welcome.png',fullPage:true});
 await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();
 await expect(page.getByRole('heading',{name:'نظرة عامة',exact:true})).toBeVisible();
 await page.screenshot({path:'../Fodo-Desktop.png',fullPage:true});
 await page.getByRole('button',{name:'المخزون',exact:true}).click();
 await page.getByLabel('تصفية حسب الفئة').selectOption({label:'لحوم'});
 const table=page.getByLabel('جدول مواد المخزون');
 await expect(table.getByRole('button',{name:/لحم بقري/})).toBeVisible();
 await expect(table.getByRole('button',{name:/أرز مصري/})).toHaveCount(0);
 await page.getByLabel('بحث المواد').fill('does-not-exist');
 await expect(page.getByRole('heading',{name:'لا توجد مواد مطابقة'})).toBeVisible();
 await page.getByRole('button',{name:'عرض كل المواد',exact:true}).click();
 await expect(table.getByRole('button',{name:/أرز مصري/})).toBeVisible();
 await page.getByRole('button',{name:'استلام مواد',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await page.getByLabel('الكمية (كجم)',{exact:true}).fill('٢٫٥');
 await page.getByLabel('تكلفة الوحدة (ج.م)',{exact:true}).fill('١٠');
 await expect(dialog.locator('.operation-summary strong')).toHaveText('٢٥ ج.م');
 await page.screenshot({path:'../Fodo-Form.png',fullPage:false});
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
 await expect(page.getByRole('button',{name:'استلام مواد',exact:true})).toBeFocused();
});
