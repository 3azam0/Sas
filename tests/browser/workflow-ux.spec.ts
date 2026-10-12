import {test,expect,type Page,type Locator} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {selectCatalog} from './catalog-control';

async function enter(page:Page){
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();
 await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible({timeout:30000});
}
async function setup(page:Page,supplier=false){
 const origin=new URL(page.url()).origin,locationId=crypto.randomUUID(),supplierId=crypto.randomUUID();
 const generation=(await(await page.request.get('/api/v1/bootstrap')).json()).generation;
 for(const [type,record] of [
  ['location.save',{id:locationId,name:'مخزن النماذج '+Date.now(),kind:'مخزن',active:true}],
  ...(supplier?[['supplier.save',{id:supplierId,name:'مورد النماذج '+Date.now(),phone:'',email:'',address:'',active:true}]]:[])
 ]){
  const response=await page.request.post('/api/v1/setup',{headers:{Origin:origin,'X-Fodo-Generation':generation},data:{operationId:crypto.randomUUID(),organizationId:'grills',expectedRevision:0,type,record,capturedAt:new Date().toISOString(),schemaVersion:1}});
  expect(response.ok(),await response.text()).toBe(true);
 }
 await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();
 await expect(page.getByLabel('الموقع',{exact:true}).locator(`option[value="${locationId}"]`)).toHaveCount(1);
 await page.getByLabel('الموقع',{exact:true}).selectOption(locationId);
 return {locationId,supplierId};
}
async function describedError(field:Locator,page:Page){
 await expect(field).toBeFocused();await expect(field).toHaveAttribute('aria-invalid','true');
 const ids=(await field.getAttribute('aria-describedby')??'').split(/\s+/).filter(Boolean);
 expect(await page.evaluate(ids=>ids.some(id=>document.getElementById(id)?.classList.contains('field-error')),ids)).toBe(true);
}

test('328-item Arabic and SKU search works offline and keeps the selection on a short phone',async({page,context},testInfo)=>{
 const targetId=crypto.randomUUID();
 await page.route('**/api/v1/bootstrap',async route=>{
  const response=await route.fetch(),snapshot=await response.json(),rice=snapshot.items.find((i:any)=>i.id==='rice');
  snapshot.items=[...snapshot.items.slice(0,5),...Array.from({length:323},(_,index)=>({...rice,id:index===200?targetId:crypto.randomUUID(),sku:`CAT-${index}`,name:`أرز صنف البحث ${index}`,category:`تصنيف ${index%20}`,purchaseUnits:[]}))];
  await route.fulfill({response,json:snapshot});
 });
 await enter(page);await context.setOffline(true);
 await page.getByRole('button',{name:'استلام مواد',exact:true}).click();
 const dialog=page.getByRole('dialog'),search=dialog.getByRole('combobox',{name:'المادة',exact:true}),stored=dialog.locator('.catalog-select select');
 await selectCatalog(page,search,'rice');await expect(dialog.getByRole('combobox',{name:'المادة',exact:true})).toHaveCount(1);
 const results=page.getByRole('listbox',{name:'خيارات المادة'});const started=Date.now();await search.fill('CAT-200');await expect(results.getByRole('option')).toHaveCount(1);
 const elapsedMs=Date.now()-started;testInfo.annotations.push({type:'catalog-search-ms',description:String(elapsedMs)});
 const measurement=testInfo.outputPath('catalog-search.json');await writeFile(measurement,JSON.stringify({items:328,query:'CAT-200',elapsedMs,includesBrowserAutomation:true}));await testInfo.attach('catalog-search',{path:measurement,contentType:'application/json'});
 await search.press('Enter');await expect(stored).toHaveValue(targetId);await search.fill('ارز صنف البحث 200');await expect(results.getByRole('option')).toHaveCount(1);
 await search.fill('لا توجد هذه المادة');await expect(results.getByRole('option')).toHaveCount(0);await expect(stored).toHaveValue(targetId);await search.press('Enter');await expect(search).toBeFocused();await expect(stored).toHaveValue(targetId);
 await search.press('Tab');await expect(search).toHaveValue('أرز صنف البحث 200 · CAT-200 · كجم');await search.fill('');await expect(results.getByRole('option')).toHaveCount(328);await search.press('Escape');
 await page.setViewportSize({width:820,height:1180});await page.screenshot({path:'../Fodo-Catalog-Search-Tablet.png'});
 await page.setViewportSize({width:390,height:640});
 const footer=dialog.locator('.modal-footer'),box=await footer.boundingBox();expect(box).not.toBeNull();expect(box!.y+box!.height).toBeLessThanOrEqual(641);
 await dialog.locator('.modal-body').evaluate(element=>element.scrollTop=element.scrollHeight);
 await expect(footer.getByRole('button',{name:'حفظ العملية',exact:true})).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'../Fodo-Catalog-Search-Short-Mobile.png'});
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
 await expect(page.getByRole('button',{name:'استلام مواد',exact:true})).toBeFocused();
});

test('count filters preserve zero and quantities and reveal the first hidden invalid field',async({page,context})=>{
 await enter(page);const {locationId}=await setup(page);await page.getByRole('button',{name:'الجرد والتسوية',exact:true}).click();
 await context.setOffline(true);await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'جرد جديد',exact:true}).click();
 await page.getByLabel('سبب الجرد',{exact:true}).fill('جرد فلترة محفوظ');
 const rice=page.getByLabel('العد الفعلي rice',{exact:true}),beef=page.getByLabel('العد الفعلي beef',{exact:true});
 await rice.fill('-1');await beef.fill('0');await page.getByLabel('بحث مواد الجرد',{exact:true}).fill('MT-001');
 await expect(rice).toBeHidden();await expect(beef).toBeVisible();await page.getByRole('button',{name:'حفظ مسودة الجرد',exact:true}).click();
 await describedError(rice,page);await expect(beef).toHaveValue('0');await rice.fill('2');
 await page.getByLabel('بحث مواد الجرد',{exact:true}).fill('DR-001');await expect(rice).toHaveValue('2');
 await page.getByLabel('بحث مواد الجرد',{exact:true}).fill('MT-001');await expect(beef).toHaveValue('0');await expect(beef).toBeVisible();await page.getByLabel('فلتر حالة العد',{exact:true}).selectOption('counted');await expect(beef).toBeVisible();await page.getByLabel('تصنيف الجرد',{exact:true}).selectOption('لحوم');await expect(beef).toBeVisible();
 const countSave=page.getByRole('button',{name:'حفظ مسودة الجرد',exact:true});await expect(countSave).toBeInViewport();const saveBox=await countSave.boundingBox(),navBox=await page.locator('.sidebar nav').boundingBox();expect(saveBox!.y+saveBox!.height).toBeLessThanOrEqual(navBox!.y+1);await expect(page.locator('.sidebar nav [aria-current=page]')).toBeInViewport();await page.screenshot({path:'../Fodo-Count-Filter-Mobile.png'});await beef.press('Control+Enter');
 await expect(page.locator('.count-document')).toContainText('جرد فلترة محفوظ');await page.reload();
 await page.getByLabel('الموقع',{exact:true}).selectOption(locationId);await page.getByRole('button',{name:'الجرد والتسوية',exact:true}).click();
 const document=page.locator('.count-document').filter({hasText:'جرد فلترة محفوظ'});await expect(document.locator('tbody tr')).toHaveCount(2);
 await page.getByRole('button',{name:'تعديل مسودة الجرد',exact:true}).click();await expect(page.getByLabel('العد الفعلي rice',{exact:true})).toHaveValue('2');await expect(page.getByLabel('العد الفعلي beef',{exact:true})).toHaveValue('0');
 await context.setOffline(false);const snapshot=await(await page.request.get('/api/v1/bootstrap')).json();expect(snapshot.balances.filter((b:any)=>b.locationId===locationId)).toHaveLength(0);
});

test('purchase Ctrl+Enter submission focuses its invalid quantity and saves an offline draft without stock',async({page,context})=>{
 await page.setViewportSize({width:390,height:844});
 await enter(page);const {locationId,supplierId}=await setup(page,true);await page.getByRole('button',{name:'المشتريات',exact:true}).click();
 await context.setOffline(true);await page.getByRole('button',{name:'أمر شراء جديد',exact:true}).click();
 await page.getByLabel('مورد الشراء',{exact:true}).selectOption(supplierId);await page.getByLabel('مرجع أمر الشراء',{exact:true}).fill('شراء من لوحة المفاتيح');
 await page.getByLabel('مادة الشراء 1',{exact:true}).fill('DR-001');await page.getByLabel('مادة الشراء 1',{exact:true}).press('Enter');
 const quantity=page.getByLabel('كمية الشراء 1',{exact:true}),cost=page.getByLabel('تكلفة الشراء 1',{exact:true});
 await quantity.fill('خطأ');await cost.fill('20');await cost.press('Control+Enter');await describedError(quantity,page);
 await quantity.fill('2');const save=page.getByRole('button',{name:'حفظ مسودة الشراء',exact:true});await expect(save).toBeInViewport();const actionBox=await save.boundingBox(),navigationBox=await page.locator('.sidebar nav').boundingBox();expect(actionBox!.y+actionBox!.height).toBeLessThanOrEqual(navigationBox!.y+1);await page.screenshot({path:'../Fodo-Purchase-Form-Mobile.png'});
 await cost.press('Control+Enter');await expect(page.locator('.purchase-order')).toContainText('شراء من لوحة المفاتيح');await page.reload();
 await page.getByLabel('الموقع',{exact:true}).selectOption(locationId);await page.getByRole('button',{name:'المشتريات',exact:true}).click();
 await expect(page.locator('.purchase-order')).toContainText('شراء من لوحة المفاتيح');
 await context.setOffline(false);const snapshot=await(await page.request.get('/api/v1/bootstrap')).json();expect(snapshot.balances.filter((b:any)=>b.locationId===locationId)).toHaveLength(0);
});

test('invalid recovery file has an associated Arabic error and Escape restores mobile focus',async({page})=>{
 await page.setViewportSize({width:390,height:640});await enter(page);
 await page.getByRole('button',{name:'مركز المزامنة',exact:false}).first().click();
 const trigger=page.getByRole('button',{name:'استعادة ملف',exact:true});await trigger.click();
 const dialog=page.getByRole('dialog'),file=dialog.getByLabel('ملف الاسترداد',{exact:true});
 await expect(file).toBeFocused();await file.setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
 await describedError(file,page);await expect(dialog.getByRole('alert')).toContainText('ملف الاسترداد غير صالح');
 await expect(dialog.getByRole('button',{name:'تأكيد الاسترداد',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'../Fodo-Recovery-Error-Mobile.png'});await page.keyboard.press('Escape');
 await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();
});
