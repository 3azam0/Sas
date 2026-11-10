import {test,expect,type Page} from '@playwright/test';
async function fixture(page:Page,useCurrentLocation=false){
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();await expect(page.getByRole('heading',{name:'نظرة عامة',exact:true})).toBeVisible();const origin=new URL(page.url()).origin,sourceId=useCurrentLocation?await page.getByLabel('الموقع',{exact:true}).inputValue():crypto.randomUUID(),destinationId=crypto.randomUUID();
 async function post(url:string,data:unknown){const r=await page.request.post(url,{headers:{Origin:origin,'X-Fodo-Generation':(await(await page.request.get('/api/v1/bootstrap')).json()).generation},data});expect(r.ok(),await r.text()).toBe(true);}
 for(const [id,name] of [...(useCurrentLocation?[]:[[sourceId,'مصدر التحويل']]),[destinationId,'وجهة التحويل']])await post('/api/v1/setup',{operationId:crypto.randomUUID(),organizationId:'grills',expectedRevision:0,type:'location.save',capturedAt:new Date().toISOString(),schemaVersion:1,record:{id,name:name+' '+Date.now(),kind:'مخزن',active:true}});
 for(const [quantity,unitCost] of [['2','20'],['8','30']])await post('/api/v1/commands',{operationId:crypto.randomUUID(),organizationId:'grills',locationId:sourceId,type:'receipt.post',itemId:'rice',quantity,unitCost,reason:'مصدر تحويل',businessDate:'2026-10-09',capturedAt:new Date().toISOString(),schemaVersion:1});
 await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();await expect(page.getByLabel('الموقع',{exact:true}).locator(`option[value="${destinationId}"]`)).toHaveCount(1);if(!useCurrentLocation)await page.getByLabel('الموقع',{exact:true}).selectOption(sourceId);
 const nav=page.getByRole('navigation',{name:'التنقل الرئيسي'});
 const transfers=nav.getByRole('button',{name:'التحويلات',exact:true});
 if(!await transfers.isVisible())await nav.locator('summary').filter({hasText:/^المخزون/}).click();
 await transfers.click();return {sourceId,destinationId,post};
}
async function dispatch(page:Page,destinationId:string,quantity='5',reason='تحويل اختبار'){
 await page.getByRole('button',{name:'تحويل جديد',exact:true}).click();await page.getByLabel('وجهة التحويل',{exact:true}).selectOption(destinationId);await page.getByLabel('سبب التحويل',{exact:true}).fill(reason);await page.getByLabel('تاريخ التحويل',{exact:true}).fill('2026-10-09');await page.getByLabel('كمية تحويل rice',{exact:true}).fill(quantity);await page.getByRole('button',{name:'حفظ مستند التحويل',exact:true}).click();
}
async function receive(page:Page,quantity='3'){
 await page.getByRole('button',{name:'استلام التحويل',exact:true}).click();await page.getByLabel('سبب التحويل',{exact:true}).fill('استلام جزئي');await page.getByLabel('تاريخ التحويل',{exact:true}).fill('2026-10-09');await page.getByLabel('كمية تحويل rice',{exact:true}).fill(quantity);await page.getByRole('button',{name:'حفظ مستند التحويل',exact:true}).click();
}
test('edits an accepted dispatch under the same ID and shows its timeline',async({page})=>{
 const {sourceId,destinationId,post}=await fixture(page,true);
 const reference='تحويل أصلي '+crypto.randomUUID();
 await dispatch(page,destinationId,'5',reference);
 const original=page.locator('.transfer-action').filter({hasText:reference});
 await expect(original.locator(':scope > summary')).toContainText('مقبول');
 const before=await (await page.request.get('/api/v1/bootstrap')).json();
 const id=before.transfers.find((t:{document:{sourceId:string;destinationId:string}})=>t.document.sourceId===sourceId&&t.document.destinationId===destinationId).transferId;
 await original.locator(':scope > summary').click();
 await original.getByRole('button',{name:'تعديل التحويل',exact:true}).click();
 await expect(page.getByLabel('مصدر التحويل',{exact:true})).toHaveValue(sourceId);
 await expect(page.getByLabel('وجهة التحويل',{exact:true})).toHaveValue(destinationId);
 await expect(page.getByLabel('كمية تحويل rice',{exact:true})).toHaveValue('5');
 await page.getByLabel('تاريخ التحويل',{exact:true}).fill('2026-10-08');
 await page.getByLabel('سبب تعديل التحويل',{exact:true}).fill('تصحيح كمية الإرسال');
 await page.getByLabel('كمية تحويل rice',{exact:true}).fill('2');
 await page.getByRole('button',{name:'حفظ تعديل التحويل',exact:true}).click();
 await expect(page.getByRole('button',{name:'حفظ تعديل التحويل',exact:true})).toHaveCount(0);
 if(!await original.getByText(/سجل التعديلات/).isVisible()&&!await original.evaluate(node=>(node as HTMLDetailsElement).open))await original.locator(':scope > summary').click();
 await expect(original.getByText(/سجل التعديلات/)).toBeVisible();
 await original.getByText(/سجل التعديلات/).click();
 await expect(original.getByText('تصحيح كمية الإرسال',{exact:false})).toBeVisible();
 await expect(original.getByText('من ٥ إلى ٢',{exact:false})).toBeVisible();
 await expect(original.getByText('تاريخ المستند من',{exact:false})).toContainText('2026-10-08');
 const snapshot=await (await page.request.get('/api/v1/bootstrap')).json();
 const transfers=snapshot.transfers.filter((t:{document:{sourceId:string;destinationId:string}})=>t.document.sourceId===sourceId&&t.document.destinationId===destinationId);
 expect(transfers).toHaveLength(1);
 expect(transfers[0]).toMatchObject({transferId:id,document:{businessDate:'2026-10-08',lines:[{quantity:'2'}]}});
 await post('/api/v1/transfers',{operationId:crypto.randomUUID(),organizationId:'grills',generation:snapshot.generation,type:'transfer.receive',transferId:id,expectedRevision:transfers[0].revision,businessDate:'2026-10-09',reason:'استلام للتأكد من التجميع',capturedAt:new Date().toISOString(),schemaVersion:1,lines:[{movementId:crypto.randomUUID(),dispatchLineId:transfers[0].lines[0].dispatchLineId,quantity:'2'}]});
 await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();
 if(!await original.evaluate(node=>(node as HTMLDetailsElement).open))await original.locator(':scope > summary').click();
 await original.getByText(/الاستلام والفقد/).click();
 await expect(original.getByText('استلام للتأكد من التجميع',{exact:false})).toBeVisible();
 await expect(page.locator('.transfer-action > summary').filter({hasText:'استلام للتأكد من التجميع'})).toHaveCount(0);
 await original.getByRole('button',{name:'إلغاء المستند',exact:true}).click();
 await page.getByLabel('سبب إلغاء المستند',{exact:true}).fill('مستند تجريبي للإلغاء');
 await page.getByRole('button',{name:'تأكيد إلغاء المستند',exact:true}).click();
 await expect(original.locator(':scope > summary')).toContainText('ملغى');
});
test('offline dispatch and partial receipt survive reload, preserve cost, then receive remainder exactly once',async({page,context})=>{
 const f=await fixture(page);await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible();await context.setOffline(true);await dispatch(page,f.destinationId,'٥');await expect(page.locator('.transfer-action summary')).toContainText('محفوظ محلياً');await page.getByLabel('الموقع',{exact:true}).selectOption(f.destinationId);await receive(page,'٣');await expect(page.locator('.transfer-action')).toHaveCount(2);await page.reload();await page.getByLabel('الموقع',{exact:true}).selectOption(f.destinationId);await page.getByRole('button',{name:'التحويلات',exact:true}).click();await expect(page.locator('.transfer-document')).toContainText('كميات محلية معلقة');await context.setOffline(false);await page.getByRole('button',{name:'مزامنة الآن',exact:true}).first().click();await expect.poll(async()=>{const s=await(await page.request.get('/api/v1/bootstrap')).json();return s.balances.find((b:any)=>b.locationId===f.destinationId)?.value;}).toBe('70.000000000000');await expect(page.locator('.transfer-document')).toContainText('٦٠ ج.م');await page.screenshot({path:'test-results/fodo-transfers-desktop.png',fullPage:true});
 let s=await(await page.request.get('/api/v1/bootstrap')).json();const t=s.transfers.find((t:any)=>t.document.sourceId===f.sourceId);expect(t.lines[0].remaining).toBe('2.000000');await f.post('/api/v1/transfers',t.document);await receive(page,'2');await expect(page.locator('.transfer-document summary')).toContainText('مستلم بالكامل');await expect.poll(async()=>{const s=await(await page.request.get('/api/v1/bootstrap')).json();return s.balances.find((b:any)=>b.locationId===f.destinationId)?.value;}).toBe('130.000000000000');s=await(await page.request.get('/api/v1/bootstrap')).json();expect(s.balances.find((b:any)=>b.locationId===f.destinationId)?.value).toBe('130.000000000000');expect(s.transfers.find((t:any)=>t.transferId===t.document?.transferId&&t.document.sourceId===f.sourceId).lines[0].remaining).toBe('0.000000');await page.getByRole('button',{name:'سجل الحركات',exact:true}).click();await expect(page.getByRole('cell',{name:'استلام تحويل',exact:true})).toHaveCount(3);
});
test('mobile receiving overage enters review and linked correction preserves history',async({page})=>{
 const f=await fixture(page);await dispatch(page,f.destinationId);await expect(page.locator('.transfer-action summary')).toContainText('مقبول');await page.getByLabel('الموقع',{exact:true}).selectOption(f.destinationId);await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'استلام التحويل',exact:true}).click();await page.getByLabel('سبب التحويل',{exact:true}).fill('كمية غير صحيحة');await page.getByLabel('تاريخ التحويل',{exact:true}).fill('2026-10-09');await page.getByLabel('كمية تحويل rice',{exact:true}).fill('6');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/fodo-transfers-mobile.png',fullPage:true});await page.getByRole('button',{name:'حفظ مستند التحويل',exact:true}).click();await expect(page.locator('.transfer-action summary').filter({hasText:'تحتاج مراجعة'})).toHaveCount(1);let s=await(await page.request.get('/api/v1/bootstrap')).json();expect(s.balances.some((b:any)=>b.locationId===f.destinationId)).toBe(false);await page.getByRole('button',{name:'تصحيح التحويل',exact:true}).click();await page.getByLabel('كمية تحويل rice',{exact:true}).fill('3');await page.getByRole('button',{name:'حفظ مستند التحويل',exact:true}).click();await expect(page.locator('.transfer-action summary').filter({hasText:'تم التصحيح'})).toHaveCount(1);await expect(page.getByText('تصحيح مرتبط بالمستند',{exact:false})).toBeVisible();await expect.poll(async()=>{const s=await(await page.request.get('/api/v1/bootstrap')).json();return s.balances.find((b:any)=>b.locationId===f.destinationId)?.value;}).toBe('70.000000000000');s=await(await page.request.get('/api/v1/bootstrap')).json();expect(s.balances.find((b:any)=>b.locationId===f.destinationId)?.value).toBe('70.000000000000');
});
test('transit loss closes shortage with original cost and no second source deduction',async({page})=>{
 const f=await fixture(page);await dispatch(page,f.destinationId);await expect(page.locator('.transfer-action summary')).toContainText('مقبول');await page.getByLabel('الموقع',{exact:true}).selectOption(f.destinationId);await receive(page);await expect(page.locator('.transfer-document summary')).toContainText('جزئية');await page.getByRole('button',{name:'تسجيل فقد التحويل',exact:true}).click();await page.getByLabel('سبب التحويل',{exact:true}).fill('تلف أثناء النقل');await page.getByLabel('تاريخ التحويل',{exact:true}).fill('2026-10-09');await page.getByLabel('كمية تحويل rice',{exact:true}).fill('2');await page.getByRole('button',{name:'حفظ مستند التحويل',exact:true}).click();await expect(page.locator('.transfer-document summary')).toContainText('مغلق مع فقد');await expect(page.getByRole('button',{name:'استلام التحويل',exact:true})).toHaveCount(0);await expect.poll(async()=>{const s=await(await page.request.get('/api/v1/bootstrap')).json();return s.transferActions.find((a:any)=>a.document.type==='transfer.loss'&&a.document.transferId===s.transfers.find((t:any)=>t.document.sourceId===f.sourceId).transferId)?.amount;}).toBe('60.000000000000');const s=await(await page.request.get('/api/v1/bootstrap')).json();expect(s.balances.find((b:any)=>b.locationId===f.sourceId)?.value).toBe('150.000000000000');expect(s.balances.find((b:any)=>b.locationId===f.destinationId)?.value).toBe('70.000000000000');expect(s.transferActions.find((a:any)=>a.document.type==='transfer.loss'&&a.document.transferId===s.transfers.find((t:any)=>t.document.sourceId===f.sourceId).transferId).amount).toBe('60.000000000000');
});
