import {test,expect,type Locator} from '@playwright/test';
import {selectCatalog} from './catalog-control';

async function fillItem(dialog:Locator,name:string,sku:string){
 await dialog.getByLabel('اسم السجل',{exact:true}).fill(name);
 await expect(dialog.getByLabel('كود المادة',{exact:true})).not.toBeEditable();
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
 await page.getByLabel('بحث المواد',{exact:true}).fill(name);await expect(page.getByRole('table').getByText(name,{exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'المخزون',exact:true}).click();await page.getByLabel('بحث المواد',{exact:true}).fill(name);await expect(page.getByRole('table').getByText(name,{exact:true})).toBeVisible();
 await context.setOffline(false);await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();
 await expect.poll(async()=>{const s=await(await page.request.get('/api/v1/bootstrap')).json();return s.items.some((i:any)=>i.name===name);},{timeout:30000}).toBe(true);
 const s=await(await page.request.get('/api/v1/bootstrap')).json(),item=s.items.find((i:any)=>i.name===name);
 expect(s.balances.filter((b:any)=>b.itemId===item.id).every((b:any)=>Number(b.quantity)===0)).toBe(true);
 expect(s.entries.some((e:any)=>e.itemId===item.id)).toBe(false);
});

test('item form saves and starts another item without closing',async({page})=>{
 const first=`مادة متتابعة أولى ${Date.now()}`,second=`مادة متتابعة ثانية ${Date.now()}`;
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();await page.getByRole('button',{name:'المخزون',exact:true}).click();
 const add=page.getByRole('button',{name:'إضافة مادة',exact:true});await add.click();const editor=page.getByRole('dialog',{name:'إضافة مادة',exact:true});
 await editor.getByLabel('اسم السجل',{exact:true}).fill(first);await editor.getByRole('button',{name:'حفظ وإضافة مادة جديدة',exact:true}).click();
 await expect(editor).toBeVisible();await expect(editor.getByRole('status')).toContainText('تم حفظ المادة');await expect(editor.getByLabel('اسم السجل',{exact:true})).toHaveValue('');await expect(editor.getByLabel('اسم السجل',{exact:true})).toBeFocused();
 await editor.getByLabel('اسم السجل',{exact:true}).fill(second);await editor.getByRole('button',{name:'حفظ الإعدادات',exact:true}).click();await expect(editor).not.toBeVisible();
 await page.getByLabel('بحث المواد',{exact:true}).fill(second);await expect(page.getByRole('table').getByText(second,{exact:true})).toBeVisible();
});

test('receiving visible shortcut preserves quantity and cost and selects a new material offline',async({page,context})=>{
 const name='مادة استلام اختصار '+Date.now(),sku='REC-'+Date.now();
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();
 await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible({timeout:30000});await page.getByRole('button',{name:'المخزون',exact:true}).click();await context.setOffline(true);
 await page.getByRole('button',{name:'استلام مواد',exact:true}).click();const receipt=page.getByRole('dialog',{name:'استلام مواد',exact:true});
 await selectCatalog(page,receipt.getByLabel('المادة',{exact:true}),'rice');await receipt.getByLabel('الكمية (كجم)',{exact:true}).fill('2');await receipt.getByLabel('تكلفة الوحدة (ج.م)',{exact:true}).fill('20');
 expect((await receipt.getByLabel('تكلفة الوحدة (ج.م)',{exact:true}).boundingBox())!.x).toBeGreaterThan((await receipt.getByLabel('وحدة الاستلام',{exact:true}).boundingBox())!.x);
 await receipt.getByRole('button',{name:'ملء الشاشة',exact:true}).click();await expect(receipt).toHaveClass(/form-expanded/);
 expect(await receipt.evaluate(node=>{const r=node.getBoundingClientRect();return r.width===innerWidth&&r.height===innerHeight;})).toBe(true);
 expect(await receipt.evaluate(node=>node.querySelector('.receiving-receipt-pane')!.getBoundingClientRect().top>=node.querySelector('.receiving-composer')!.getBoundingClientRect().bottom)).toBe(true);
 await page.screenshot({path:'.cache/receiving-layout-desktop.png'});
 await page.setViewportSize({width:390,height:844});expect(await receipt.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);await page.screenshot({path:'.cache/receiving-layout-mobile.png'});await page.setViewportSize({width:1280,height:900});
 await receipt.getByRole('button',{name:'استعادة حجم النموذج',exact:true}).click();await expect(receipt).not.toHaveClass(/form-expanded/);
 await receipt.getByRole('button',{name:'إضافة مادة جديدة',exact:true}).click();const create=page.getByRole('dialog',{name:'إضافة مادة جديدة',exact:true});
 await expect(create.locator('.modal-header .form-keyboard-help')).toBeVisible();await expect(create.locator('.modal-header')).toContainText('مطلوبة.');await expect(create.locator('.modal-body .form-keyboard-help')).toHaveCount(0);
 await create.getByRole('button',{name:'إلغاء',exact:true}).click();await expect(receipt.getByLabel('المادة',{exact:true})).toBeFocused();await expect(receipt.getByLabel('الكمية (كجم)',{exact:true})).toHaveValue('2');
 await receipt.getByRole('button',{name:'إضافة مادة جديدة',exact:true}).click();await fillItem(create,name,sku);await create.getByRole('button',{name:'حفظ واختيار',exact:true}).click();
 await expect(receipt.getByLabel('المادة',{exact:true})).toHaveValue(`${name} · ${sku} · كجم`);await expect(receipt.getByLabel('الكمية (كجم)',{exact:true})).toBeFocused();
 await expect(receipt.getByLabel('الكمية (كجم)',{exact:true})).toHaveValue('2');await expect(receipt.getByLabel('تكلفة الوحدة (ج.م)',{exact:true})).toHaveValue('20');
 expect(await receipt.locator('.receiving-composer').evaluate(node=>node.getBoundingClientRect().height)).toBeLessThan(190);
 await receipt.getByRole('button',{name:'إضافة إلى القائمة',exact:false}).click();
 const line=receipt.locator('[data-receiving-line]').first();await expect(line).toContainText(name);
 expect(await line.evaluate(node=>{const centers=['.kitchen-receipt-item','.kitchen-receipt-details','.kitchen-receipt-actions'].map(selector=>{const r=node.querySelector(selector)!.getBoundingClientRect();return r.top+r.height/2;});return Math.max(...centers)-Math.min(...centers)<2;})).toBe(true);
 await page.screenshot({path:'.cache/receiving-line-desktop.png'});await page.setViewportSize({width:390,height:844});
 expect(await receipt.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);expect(await line.evaluate(node=>getComputedStyle(node).flexWrap)).toBe('nowrap');await page.screenshot({path:'.cache/receiving-line-mobile.png'});
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
 expect(Number(await supply.getByLabel('سعر وحدة الصرف',{exact:true}).inputValue())).toBeGreaterThan(0);await supply.getByLabel('سعر وحدة الصرف',{exact:true}).fill('50');await supply.getByLabel('كمية الصرف',{exact:true}).press('Enter');await expect(supply.getByLabel('سعر وحدة الصرف',{exact:true})).toBeFocused();await supply.getByLabel('سعر وحدة الصرف',{exact:true}).press('Enter');
 await page.screenshot({path:'.cache/kitchen-compact-desktop.png'});
 expect(await supply.locator('.kitchen-entry-composer').evaluate(node=>node.getBoundingClientRect().height)).toBeLessThan(170);
 expect(await supply.evaluate(node=>node.querySelector('.kitchen-receipt-section')!.getBoundingClientRect().top>=node.querySelector('.kitchen-entry-composer')!.getBoundingClientRect().bottom)).toBe(true);
 const issueLine=supply.locator('.kitchen-receipt-line').first();await expect(issueLine).toContainText('٥٠');expect(await issueLine.evaluate(node=>{const centers=['.kitchen-receipt-item','.kitchen-receipt-details','.kitchen-receipt-actions'].map(selector=>{const r=node.querySelector(selector)!.getBoundingClientRect();return r.top+r.height/2;});return Math.max(...centers)-Math.min(...centers)<2;})).toBe(true);

 await supply.getByRole('button',{name:'تفاصيل إضافية للصرف',exact:true}).click();await supply.getByLabel('مرجع الصرف',{exact:true}).fill('مرجع محفوظ');
 await supply.getByRole('button',{name:'ملء الشاشة',exact:true}).click();await expect(supply).toHaveClass(/form-expanded/);
 expect(await supply.evaluate(node=>{const r=node.getBoundingClientRect();return r.width===innerWidth&&r.height===innerHeight;})).toBe(true);
 await supply.getByRole('button',{name:'استعادة حجم النموذج',exact:true}).click();await expect(supply).not.toHaveClass(/form-expanded/);
 await supply.getByRole('button',{name:'إضافة مادة جديدة',exact:true}).click();const create=page.getByRole('dialog',{name:'إضافة مادة جديدة',exact:true});
 await create.getByRole('button',{name:'إلغاء',exact:true}).click();await expect(supply.getByLabel('مادة الصرف',{exact:true})).toBeFocused();
 await supply.getByLabel('مادة الصرف',{exact:true}).fill(name);await supply.getByLabel('مادة الصرف',{exact:true}).press('F2');
 await fillItem(create,name,sku);await create.getByRole('button',{name:'حفظ واختيار',exact:true}).click();await expect(create).not.toBeVisible();
 await expect(supply.getByLabel('مادة الصرف',{exact:true})).toHaveValue(`${name} · ${sku} · كجم`);await expect(supply.getByLabel('كمية الصرف',{exact:true})).toBeFocused();
 await expect(supply.getByLabel('مرجع الصرف',{exact:true})).toHaveValue('مرجع محفوظ');await expect(supply.locator('.kitchen-receipt-list')).toContainText('أرز');
 await supply.getByLabel('كمية الصرف',{exact:true}).fill('1');await supply.getByRole('button',{name:'إضافة للقائمة',exact:false}).click();await expect(supply.locator('#kitchen-entry-error')).toContainText('الرصيد');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await supply.getByRole('button',{name:'ملء الشاشة',exact:true}).click();expect(await supply.evaluate(node=>{const r=node.getBoundingClientRect();return r.width===innerWidth&&r.height===innerHeight;})).toBe(true);await expect(supply.getByLabel('مرجع الصرف',{exact:true})).toHaveValue('مرجع محفوظ');
 await page.screenshot({path:'.cache/kitchen-layout-mobile.png'});
 expect(await supply.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);expect(await issueLine.evaluate(node=>getComputedStyle(node).flexWrap)).toBe('nowrap');
 await supply.getByRole('button',{name:'مسح الإدخال',exact:true}).click();await supply.getByRole('button',{name:'حفظ صرف المطبخ',exact:true}).click();await expect(supply).not.toBeVisible();
 const saved=()=>page.evaluate(()=>new Promise<any[]>((resolve,reject)=>{const request=indexedDB.open('restaurant-saas-v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('kitchenIssues','readonly');const get=tx.objectStore('kitchenIssues').getAll();get.onerror=()=>reject(get.error);get.onsuccess=()=>{resolve(get.result);db.close();};};}));
 expect((await saved())[0].document.lines[0].unitPrice).toBe('50');await page.reload();expect((await saved())[0].document.lines[0].unitPrice).toBe('50');
 await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'المطابخ',exact:true}).click();const savedDocument=page.locator('.opening-document').filter({hasText:'مرجع محفوظ'});await savedDocument.locator('summary').click();await savedDocument.getByRole('button',{name:'عرض وطباعة المستند',exact:true}).click();await expect(page.locator('.document-print-total').filter({hasText:'قيمة مستند الصرف'})).toContainText('٥٠');
});
