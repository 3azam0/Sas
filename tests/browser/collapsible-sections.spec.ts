import {test,expect,type Page} from '@playwright/test';
async function enter(page:Page){await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible({timeout:30000});}

test('collapse retains receiving entry and added lines without posting',async({page})=>{
 await enter(page);const posts:string[]=[];page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
 await page.getByRole('button',{name:'استلام مواد',exact:true}).click();const dialog=page.getByRole('dialog',{name:'استلام مواد',exact:true});
 const material=dialog.getByLabel('المادة',{exact:true});await material.fill('أرز');await material.press('Enter');
 const quantity=dialog.getByLabel('الكمية (كجم)',{exact:true});await quantity.fill('2');
 const entry=dialog.locator('.receiving-composer');await entry.getByRole('button',{name:/^طي قسم/}).click();await expect(quantity).not.toBeVisible();
 await entry.getByRole('button',{name:/^توسيع قسم/}).press('Enter');await expect(quantity).toHaveValue('2');
 await dialog.getByLabel('تكلفة الوحدة (ج.م)',{exact:true}).fill('28');await dialog.getByRole('button',{name:'إضافة إلى القائمة',exact:true}).click();
 const list=dialog.locator('.receiving-receipt-pane');await list.getByRole('button',{name:/^طي قسم/}).click();await expect(list.locator('[data-receiving-line]')).not.toBeVisible();
 await expect(dialog.locator('.document-summary strong')).toContainText('٥٦');
 await material.fill('أرز');await material.press('Enter');await quantity.fill('1');await dialog.getByLabel('تكلفة الوحدة (ج.م)',{exact:true}).fill('28');await dialog.getByRole('button',{name:'إضافة إلى القائمة',exact:true}).click();
 await expect(list.getByRole('button',{name:/^طي قسم/})).toHaveAttribute('aria-expanded','true');await expect(list.locator('[data-receiving-line]')).toBeVisible();await expect(dialog.locator('.document-summary strong')).toContainText('٨٤');expect(posts).toEqual([]);
 await dialog.getByRole('button',{name:'إلغاء',exact:true}).click();
});

test('required errors reveal a collapsed setup section before focusing',async({page})=>{
 await enter(page);await page.getByRole('button',{name:'الموردون',exact:true}).click();await page.getByRole('button',{name:'إضافة مورد',exact:true}).click();
 const dialog=page.getByRole('dialog'),name=dialog.getByLabel('اسم السجل',{exact:true});await name.fill('x');
 await dialog.getByRole('button',{name:'طي قسم البيانات الأساسية',exact:true}).click();await expect(name).not.toBeVisible();
 await dialog.getByRole('button',{name:'حفظ الإعدادات',exact:true}).click();await expect(name).toBeVisible();await expect(name).toHaveAttribute('aria-invalid','true');await expect(name).toBeFocused();
 await dialog.getByRole('button',{name:'إلغاء',exact:true}).click();
});

test('inventory section retains its filters and shrinks when collapsed',async({page})=>{
 await enter(page);await page.getByRole('button',{name:'المخزون',exact:true}).click();const panel=page.locator('.collapsible-section').filter({has:page.getByRole('heading',{name:/^مواد المخزون/})});
 const category=page.getByLabel('تصفية حسب الفئة',{exact:true});await category.selectOption({index:1});const value=await category.inputValue();
 const before=await panel.boundingBox();await panel.getByRole('button',{name:/^طي قسم/}).click();await expect(category).not.toBeVisible();const after=await panel.boundingBox();expect(after!.height).toBeLessThan(before!.height);
 await panel.getByRole('button',{name:/^توسيع قسم/}).click();await expect(category).toHaveValue(value);
});
