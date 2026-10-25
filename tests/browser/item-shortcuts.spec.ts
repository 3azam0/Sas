import {test,expect,type Locator} from '@playwright/test';
import {selectCatalog} from './catalog-control';

async function fillItem(dialog:Locator,name:string,sku:string){
 await dialog.getByLabel('اسم السجل',{exact:true}).fill(name);
 await dialog.getByLabel('كود المادة',{exact:true}).fill(sku);
 await dialog.getByLabel('وحدة المخزون',{exact:true}).selectOption({label:'كجم'});
}

test('inventory adds a material offline without creating stock and restores focus',async({page,context})=>{
 const name='مادة مخزون '+Date.now(),sku='INV-'+Date.now();
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();
 await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'المخزون',exact:true}).click();await context.setOffline(true);
 const add=page.getByRole('button',{name:'إضافة مادة',exact:true});await add.click();
 const editor=page.getByRole('dialog',{name:'إضافة مادة',exact:true});await fillItem(editor,name,sku);
 await editor.getByRole('button',{name:'حفظ الإعدادات',exact:true}).click();await expect(editor).not.toBeVisible();await expect(add).toBeFocused();
 await page.getByLabel('بحث المواد',{exact:true}).fill(sku);await expect(page.getByRole('table').getByText(name,{exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'المخزون',exact:true}).click();await page.getByLabel('بحث المواد',{exact:true}).fill(sku);await expect(page.getByRole('table').getByText(name,{exact:true})).toBeVisible();
 await context.setOffline(false);await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();
 await expect.poll(async()=>{const s=await(await page.request.get('/api/v1/bootstrap')).json();return s.items.some((i:any)=>i.sku===sku);},{timeout:30000}).toBe(true);
 const s=await(await page.request.get('/api/v1/bootstrap')).json(),item=s.items.find((i:any)=>i.sku===sku);
 expect(s.balances.filter((b:any)=>b.itemId===item.id).every((b:any)=>Number(b.quantity)===0)).toBe(true);
 expect(s.entries.some((e:any)=>e.itemId===item.id)).toBe(false);
});

test('receiving visible shortcut preserves quantity and cost and selects a new material offline',async({page,context})=>{
 const name='مادة استلام اختصار '+Date.now(),sku='REC-'+Date.now();
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();
 await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible({timeout:30000});await page.getByRole('button',{name:'المخزون',exact:true}).click();await context.setOffline(true);
 await page.getByRole('button',{name:'استلام مواد',exact:true}).click();const receipt=page.getByRole('dialog',{name:'استلام مواد',exact:true});
 await selectCatalog(page,receipt.getByLabel('المادة',{exact:true}),'rice');await receipt.getByLabel('الكمية (كجم)',{exact:true}).fill('2');await receipt.getByLabel('تكلفة الوحدة (ج.م)',{exact:true}).fill('20');
 await receipt.getByRole('button',{name:'إضافة مادة جديدة',exact:true}).click();const create=page.getByRole('dialog',{name:'إضافة مادة جديدة',exact:true});
 await create.getByRole('button',{name:'إلغاء',exact:true}).click();await expect(receipt.getByLabel('المادة',{exact:true})).toBeFocused();await expect(receipt.getByLabel('الكمية (كجم)',{exact:true})).toHaveValue('2');
 await receipt.getByRole('button',{name:'إضافة مادة جديدة',exact:true}).click();await fillItem(create,name,sku);await create.getByRole('button',{name:'حفظ واختيار',exact:true}).click();
 await expect(receipt.getByLabel('المادة',{exact:true})).toHaveValue(`${name} · ${sku} · كجم`);await expect(receipt.getByLabel('الكمية (كجم)',{exact:true})).toBeFocused();
 await expect(receipt.getByLabel('الكمية (كجم)',{exact:true})).toHaveValue('2');await expect(receipt.getByLabel('تكلفة الوحدة (ج.م)',{exact:true})).toHaveValue('20');
 await receipt.getByRole('button',{name:'إلغاء',exact:true}).click();
});

test('kitchen quick-create preserves the draft and cannot issue a new zero-stock material',async({page,context})=>{
 const name='مادة صرف '+Date.now(),sku='KIT-'+Date.now(),kitchenId=crypto.randomUUID();
 await page.route('**/api/v1/bootstrap',async route=>{const response=await route.fetch(),s=await response.json();s.kitchens=[{id:kitchenId,name:'مطبخ اختبار الاختصار',active:true,revision:1,locationId:'alex',parentLocationId:'central'}];await route.fulfill({response,json:s});});
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();
 await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'المخزون',exact:true}).click();await page.getByLabel('الموقع',{exact:true}).selectOption('central');await context.setOffline(true);
 await page.getByRole('button',{name:'صرف للمطبخ',exact:true}).click();const supply=page.getByRole('dialog',{name:'صرف مواد للمطبخ',exact:true});
 await selectCatalog(page,supply.getByLabel('المطبخ المستلم',{exact:true}),kitchenId);
 await selectCatalog(page,supply.getByLabel('مادة الصرف',{exact:true}),'rice');await supply.getByLabel('كمية الصرف',{exact:true}).fill('1');
 await supply.getByRole('button',{name:'إضافة للقائمة',exact:false}).click();
 await supply.getByRole('button',{name:'تفاصيل إضافية للصرف',exact:true}).click();await supply.getByLabel('مرجع الصرف',{exact:true}).fill('مرجع محفوظ');
 await supply.getByRole('button',{name:'إضافة مادة جديدة',exact:true}).click();const create=page.getByRole('dialog',{name:'إضافة مادة جديدة',exact:true});
 await create.getByRole('button',{name:'إلغاء',exact:true}).click();await expect(supply.getByLabel('مادة الصرف',{exact:true})).toBeFocused();
 await supply.getByLabel('مادة الصرف',{exact:true}).fill(name);await supply.getByLabel('مادة الصرف',{exact:true}).press('F2');
 await fillItem(create,name,sku);await create.getByRole('button',{name:'حفظ واختيار',exact:true}).click();await expect(create).not.toBeVisible();
 await expect(supply.getByLabel('مادة الصرف',{exact:true})).toHaveValue(`${name} · ${sku} · كجم`);await expect(supply.getByLabel('كمية الصرف',{exact:true})).toBeFocused();
 await expect(supply.getByLabel('مرجع الصرف',{exact:true})).toHaveValue('مرجع محفوظ');await expect(supply.locator('.kitchen-receipt-list')).toContainText('أرز');
 await supply.getByLabel('كمية الصرف',{exact:true}).fill('1');await supply.getByRole('button',{name:'إضافة للقائمة',exact:false}).click();await expect(supply.locator('#kitchen-entry-error')).toContainText('الرصيد');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await supply.getByRole('button',{name:'إلغاء',exact:true}).click();
});
