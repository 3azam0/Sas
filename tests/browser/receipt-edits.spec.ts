import {test,expect} from '@playwright/test';
import {selectCatalog} from './catalog-control';

test('edits and cancels a direct receipt under the same document number',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();
 await expect(page.getByRole('heading',{name:'نظرة عامة',exact:true})).toBeVisible({timeout:60000});
 const origin=new URL(page.url()).origin;
 const snapshot=async()=>await(await page.request.get('/api/v1/bootstrap')).json();
 const initial=await snapshot(),generation=initial.generation;
 const locationId=crypto.randomUUID(),operationId=crypto.randomUUID();
 const base={organizationId:'grills',generation,capturedAt:new Date().toISOString(),schemaVersion:1};
 const headers={Origin:origin,'X-Fodo-Generation':generation};
 // Warm the local API route before the browser's shorter save timeout.
 expect((await page.request.post('/api/v1/document-corrections',{headers,data:{},timeout:90000})).status()).toBe(400);
 async function post(path:string,data:unknown){
  const response=await page.request.post('/api/v1/'+path,{headers,data});
  expect(response.ok(),await response.text()).toBe(true);
 }
 await post('setup',{...base,operationId:crypto.randomUUID(),type:'location.save',expectedRevision:0,record:{id:locationId,name:'مخزن اختبار '+locationId.slice(0,6),kind:'مخزن',active:true}});
 const rice=initial.items.find((item:{id:string})=>item.id==='rice');
 await post('receipts',{...base,operationId,type:'receipt.document',locationId,businessDate:'2026-11-01',currency:'EGP',reason:'استلام مباشر تجريبي',lines:[{lineId:crypto.randomUUID(),itemId:rice.id,unitId:rice.unitId,quantity:'10',unitCost:'2'}]});
 await expect.poll(async()=>(await snapshot()).receipts.some((row:{document:{operationId:string}})=>row.document.operationId===operationId)).toBe(true);
 await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();
 await expect(page.getByLabel('الموقع',{exact:true}).locator('option[value="'+locationId+'"]')).toHaveCount(1,{timeout:30000});
 await page.getByLabel('الموقع',{exact:true}).selectOption(locationId);
 const nav=page.getByRole('navigation',{name:'التنقل الرئيسي'});
 const activity=nav.getByRole('button',{name:'سجل الحركات',exact:true});
 if(!await activity.isVisible())await nav.locator('summary').filter({hasText:/^المخزون/}).click();
 await activity.click();
 const row=page.locator('#operation-'+operationId).filter({hasText:'استلام مباشر تجريبي'});
 await row.locator(':scope > summary').click();
 await row.getByRole('button',{name:'تعديل المواد والكميات',exact:true}).click();
 const edit=page.getByRole('dialog',{name:'تعديل مستند الاستلام'});
 await edit.getByLabel('تاريخ الاستلام',{exact:true}).fill('2026-11-02');
 await edit.getByLabel('سبب تعديل المستند',{exact:true}).fill('مراجعة وزن وتكلفة');
 await edit.getByRole('button',{name:'تعديل '+rice.name,exact:true}).click();
 await edit.getByLabel('الكمية (كجم)',{exact:true}).fill('5');
 await edit.getByLabel('تكلفة الوحدة (ج.م)',{exact:true}).fill('3');
 await edit.getByRole('button',{name:'حفظ تعديل المادة',exact:true}).click();
 await selectCatalog(page,edit.getByRole('combobox',{name:'المادة',exact:true}),'beef');
 await edit.getByLabel('الكمية (كجم)',{exact:true}).fill('2');
 await edit.getByLabel('تكلفة الوحدة (ج.م)',{exact:true}).fill('4');
 await edit.getByRole('button',{name:'إضافة إلى القائمة',exact:true}).click();
 await edit.getByRole('button',{name:'حفظ الاستلام',exact:true}).click();
 await expect(edit).toHaveCount(0,{timeout:45000});
 await expect(row.locator(':scope > summary')).toContainText('2026-11-02');
 if(!await row.evaluate(node=>(node as HTMLDetailsElement).open))await row.locator(':scope > summary').click();
 await row.getByText(/سجل التعديلات/).click();
 await expect(row.getByText(/مراجعة وزن وتكلفة/)).toBeVisible();
 const receipts=async()=>(await snapshot()).receipts.filter((r:{document:{locationId:string}})=>r.document.locationId===locationId);
 expect(await receipts()).toMatchObject([{document:{operationId,lines:[{itemId:'beef',quantity:'2'},{itemId:'rice',quantity:'5'}]}}]);
 await row.getByRole('button',{name:'إلغاء المستند',exact:true}).click();
 await page.getByLabel('سبب إلغاء المستند',{exact:true}).fill('إلغاء اختبار الاستلام');
 await page.getByRole('button',{name:'تأكيد إلغاء المستند',exact:true}).click();
 await expect(row.locator(':scope > summary')).toContainText('ملغى',{timeout:45000});
 await expect(row.getByRole('button',{name:'تعديل المواد والكميات',exact:true})).toHaveCount(0);
 expect(await receipts()).toMatchObject([{document:{operationId},amount:'0.000000000000',edits:[{updated:null},{revision:1}]}]);
});
