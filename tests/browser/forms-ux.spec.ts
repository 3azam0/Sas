import {test,expect,type Locator,type Page} from '@playwright/test';

async function expectNoOverflow(page:Page,dialog?:Locator){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(dialog)expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
}

async function expectErrorDescribed(field:Locator,page:Page){
 await expect(field).toHaveAttribute('aria-invalid','true');
 await expect(field).toBeFocused();
 const ids=(await field.getAttribute('aria-describedby')??'').trim().split(/\s+/).filter(Boolean);
 expect(ids.length).toBeGreaterThan(0);
 const messages=await page.evaluate(ids=>ids.map(id=>document.getElementById(id)).filter((element):element is HTMLElement=>!!element&&element.classList.contains('field-error')).map(element=>element.textContent?.trim()??''),ids);
 expect(messages.some(message=>message.length>0)).toBe(true);
}

async function expectPinnedDialogActions(page:Page,dialog:Locator){
 const header=dialog.locator('.modal-header');
 const body=dialog.locator('.modal-body');
 const footer=dialog.locator('.modal-footer');
 await expect(header).toBeVisible();await expect(body).toBeVisible();await expect(footer).toBeVisible();
 const headerBefore=await header.boundingBox(),footerBefore=await footer.boundingBox();
 expect(headerBefore).not.toBeNull();expect(footerBefore).not.toBeNull();
 const viewport=page.viewportSize()!;
 expect(headerBefore!.y).toBeGreaterThanOrEqual(0);
 expect(footerBefore!.y+footerBefore!.height).toBeLessThanOrEqual(viewport.height+1);
 expect(await body.evaluate(element=>element.scrollHeight>element.clientHeight)).toBe(true);
 await body.evaluate(element=>element.scrollTop=element.scrollHeight);
 expect(await body.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
 const headerAfter=await header.boundingBox(),footerAfter=await footer.boundingBox();
 expect(Math.abs(headerAfter!.y-headerBefore!.y)).toBeLessThan(2);
 expect(Math.abs(footerAfter!.y-footerBefore!.y)).toBeLessThan(2);
 await expect(footer.getByRole('button',{name:/حفظ/})).toBeInViewport();
 await expectNoOverflow(page,dialog);
}

test('enhanced setup form keeps actions visible, explains invalid fields and restores keyboard focus',async({page,context})=>{
 await page.setViewportSize({width:1280,height:900});
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();
 await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'إعداد المخزون',exact:true}).click();await context.setOffline(true);
 const add=page.getByRole('button',{name:'إضافة مادة',exact:true});
 await add.click();const dialog=page.getByRole('dialog');
 const suffix=Date.now().toString();const itemName=`مكون تجربة النموذج ${suffix}`;
 await page.getByLabel('كود المادة',{exact:true}).fill(`FORM-${suffix}`);
 await page.getByLabel('فئة المادة',{exact:true}).fill('اختبار النماذج');
 await page.getByRole('button',{name:'حفظ الإعدادات',exact:true}).click();
 await expectErrorDescribed(page.getByLabel('اسم السجل',{exact:true}),page);
 await page.getByLabel('اسم السجل',{exact:true}).fill(itemName);
 for(let index=1;index<=8;index++){
  await page.getByRole('button',{name:'إضافة وحدة شراء',exact:true}).click();
  await page.getByLabel(`اسم العبوة ${index}`,{exact:true}).fill(`عبوة ${index}`);
  await page.getByLabel(`معامل العبوة ${index}`,{exact:true}).fill(String(index));
 }
 await expectPinnedDialogActions(page,dialog);
 await page.setViewportSize({width:390,height:844});
 await expectPinnedDialogActions(page,dialog);
 await page.screenshot({path:'../Fodo-Setup-Form-Mobile.png'});
 await page.getByRole('button',{name:'حفظ الإعدادات',exact:true}).click();await expect(dialog).not.toBeVisible();
 await expect(page.getByRole('row').filter({hasText:itemName})).toBeVisible();
 await add.click();await expect(dialog).toBeVisible();await page.keyboard.press('Escape');
 await expect(dialog).not.toBeVisible();await expect(add).toBeFocused();
 await expectNoOverflow(page);
});

test('enhanced receiving form validates inline and saves offline from a compact mobile dialog',async({page,context})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();
 await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible({timeout:30000});
 await expectNoOverflow(page);
 const nav=page.locator('.sidebar nav');const navBox=await nav.boundingBox();
 expect(navBox).not.toBeNull();expect(navBox!.height).toBeLessThanOrEqual(100);
 expect(navBox!.y+navBox!.height).toBeLessThanOrEqual(845);
 const contentPadding=await page.locator('.content').evaluate(element=>parseFloat(getComputedStyle(element).paddingBottom));
 expect(contentPadding).toBeGreaterThanOrEqual(navBox!.height);
 await page.getByLabel('الموقع',{exact:true}).selectOption('cairo');await context.setOffline(true);
 const receive=page.getByRole('button',{name:'استلام مواد',exact:true});await receive.click();
 const dialog=page.getByRole('dialog');
 const reference=`نموذج استلام ${Date.now()}`;
 await page.getByLabel('المادة',{exact:true}).selectOption('rice');
 await page.getByLabel('مرجع الاستلام',{exact:true}).fill(reference);
 await page.getByLabel('الكمية (كجم)',{exact:true}).fill('0');
 await page.getByLabel('تكلفة الوحدة (ج.م)',{exact:true}).fill('٢٠');
 await page.getByRole('button',{name:'حفظ العملية',exact:true}).click();
 await expectErrorDescribed(page.getByLabel('الكمية (كجم)',{exact:true}),page);
 await page.getByLabel('الكمية (كجم)',{exact:true}).fill('٢');
 await page.getByRole('button',{name:'إضافة مادة أخرى',exact:true}).click();
 await expectPinnedDialogActions(page,dialog);
 await page.getByRole('button',{name:'حذف السطر 2',exact:true}).click();
 await expect(dialog.locator('.operation-summary strong')).toHaveText('٤٠ ج.م');
 await page.screenshot({path:'../Fodo-Receiving-Form-Mobile.png'});
 await page.getByRole('button',{name:'حفظ العملية',exact:true}).click();await expect(dialog).not.toBeVisible();
 await page.reload();await page.getByRole('button',{name:'مركز المزامنة',exact:false}).first().click();
 const receipt=page.locator('.opening-document').filter({hasText:reference});
 await expect(receipt.locator('summary')).toContainText('محفوظ محلياً');
 await receipt.locator('summary').click();await expect(receipt.locator('tbody tr')).toHaveCount(1);
 await expect(receipt.locator('tbody')).toContainText('٤٠');
 await receive.click();await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(receive).toBeFocused();
 await expectNoOverflow(page);
});
