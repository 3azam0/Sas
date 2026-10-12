import {test,expect} from '@playwright/test';
test('one catalog field preserves uncommitted searches and rejects duplicate choices without posting stock',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible();
 const posts:string[]=[];page.on('request',request=>{if(request.method()==='POST')posts.push(request.url());});
 await page.getByRole('button',{name:'استلام مواد',exact:true}).click();const dialog=page.getByRole('dialog',{name:'استلام مواد'}),field=dialog.getByRole('combobox',{name:'المادة',exact:true});
 await expect(field).toHaveCount(1);await expect(dialog.getByLabel('بحث المادة',{exact:true})).toHaveCount(0);
 await field.click();await expect(page.getByRole('listbox',{name:'خيارات المادة'})).toBeVisible();
 await field.fill('DR-001');await field.press('ArrowDown');await field.press('Enter');await expect(dialog.getByLabel('وحدة الاستلام',{exact:true})).toBeFocused();await expect(dialog.locator('.catalog-select select')).toHaveValue('rice');
 const selection=await field.inputValue();await field.fill('UNKNOWN-CATALOG-QUERY');await field.press('Enter');await expect(field).toBeFocused();await expect(dialog.locator('.catalog-select select')).toHaveValue('rice');await field.press('Tab');await expect(field).toHaveValue(selection);
 await dialog.getByRole('button',{name:'إضافة مادة أخرى',exact:true}).click();const second=dialog.getByRole('combobox',{name:'مادة السطر 2'}),stored=dialog.locator('.catalog-select select').nth(1),old=await stored.inputValue();
 await second.fill('DR-001');await expect(page.getByRole('listbox',{name:'خيارات مادة السطر 2'}).getByRole('option')).toHaveAttribute('aria-disabled','true');await second.press('ArrowDown');await second.press('Enter');await expect(stored).toHaveValue(old);await expect(second).toBeFocused();
 await second.press('Escape');await expect(page.getByRole('listbox')).toHaveCount(0);await expect(dialog).toBeVisible();await second.press('Shift+Enter');await expect(dialog.getByLabel('تكلفة الوحدة (ج.م)',{exact:true})).toBeFocused();
 expect(posts).toEqual([]);await dialog.getByRole('button',{name:'إلغاء',exact:true}).click();
});
