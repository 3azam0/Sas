import {test,expect} from '@playwright/test';
import {selectCatalog} from './catalog-control';

test('receiving quick-create preserves rows, selects an offline material and accepts a blank reference',async({page,context})=>{
 const suffix=Date.now().toString(),name=`مادة استلام ${suffix}`,sku=`RCV-${suffix}`;
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();
 await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible({timeout:30000});
 await page.getByLabel('الموقع',{exact:true}).selectOption('central');await context.setOffline(true);
 await page.getByRole('button',{name:'استلام مواد',exact:true}).click();
 const receipt=page.getByRole('dialog',{name:'استلام مواد',exact:true});
 await selectCatalog(page,receipt.getByLabel('المادة',{exact:true}),'rice');
 await receipt.getByLabel('الكمية (كجم)',{exact:true}).fill('2');await receipt.getByLabel('تكلفة الوحدة (ج.م)',{exact:true}).fill('20');
 await receipt.getByRole('button',{name:'إضافة مادة أخرى',exact:true}).click();const material=receipt.getByLabel('مادة السطر 2',{exact:true});
 // No-results Enter creates; Escape cancels only the child and preserves the receipt.
 await material.fill(name);await material.press('Enter');
 const create=page.getByRole('dialog',{name:'إضافة مادة جديدة',exact:true});
 await expect(create.getByLabel('اسم السجل')).toHaveValue(name);await expect(create.getByLabel('وحدة المخزون',{exact:true})).toHaveValue('');
 await create.getByLabel('اسم السجل').press('Escape');await expect(create).not.toBeVisible();await expect(material).toBeFocused();
 await expect(receipt.getByLabel('الكمية (كجم)',{exact:true})).toHaveValue('2');
 // F2 works when matching results exist too, and required unit selection is explicit.
 await material.fill('أرز');await material.press('F2');await expect(create.getByLabel('اسم السجل')).toHaveValue('أرز');await create.getByLabel('اسم السجل').fill(name);await create.getByLabel('كود المادة').fill(sku);
 await create.getByRole('button',{name:'حفظ واختيار',exact:true}).click();await expect(create.getByLabel('وحدة المخزون',{exact:true})).toHaveAttribute('aria-invalid','true');
 await create.getByLabel('وحدة المخزون',{exact:true}).selectOption({label:'كجم'});await create.getByRole('button',{name:'حفظ واختيار',exact:true}).click();
 await expect(create).not.toBeVisible();await expect(material).toHaveValue(`${name} · ${sku} · كجم`);
 await expect(receipt.getByLabel('كمية السطر 2',{exact:true})).toBeFocused();await expect(receipt.getByLabel('مرجع الاستلام',{exact:true})).not.toHaveAttribute('required','');
 await receipt.getByLabel('كمية السطر 2',{exact:true}).fill('3');await receipt.getByLabel('تكلفة السطر 2',{exact:true}).fill('10');
 await expect(receipt.locator('.operation-summary strong')).toHaveText('٧٠ ج.م');await receipt.getByRole('button',{name:'حفظ العملية',exact:true}).click();await expect(receipt).not.toBeVisible();
 await page.reload();await context.setOffline(false);await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();
 await expect.poll(async()=>{const s=await(await page.request.get('/api/v1/bootstrap')).json();const id=s.items.find((item:any)=>item.sku===sku)?.id;return !!id&&s.receipts.some((r:any)=>r.document.lines.some((line:any)=>line.itemId===id));},{timeout:30000}).toBeTruthy();
 const s=await(await page.request.get('/api/v1/bootstrap')).json(),item=s.items.find((item:any)=>item.sku===sku);
 const posted=s.receipts.find((r:any)=>r.document.lines.some((line:any)=>line.itemId===item.id));expect(posted.document.reason).toBe('');expect(posted.document.lines).toHaveLength(2);
 expect(s.balances.find((b:any)=>b.locationId==='central'&&b.itemId===item.id).quantity).toBe('3.000000');
});
