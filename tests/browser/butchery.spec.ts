import {test,expect} from '@playwright/test';

test('butchery creates named products, assigns unequal costs and preserves offline capture',async({page,context,baseURL})=>{
 test.setTimeout(240000);
 // Embedded PostgreSQL initialization can be slow on a loaded Windows host.
 // Verify readiness independently so form assertions measure the UI workflow.
 const readiness=await page.request.post('/api/v1/demo-session',{headers:{origin:baseURL!},data:{organizationId:'grills',deviceId:crypto.randomUUID()},timeout:120000});expect(readiness.ok()).toBe(true);
 const initial=await page.request.get('/api/v1/bootstrap',{timeout:120000});expect(initial.ok()).toBe(true);
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();await expect(page.getByRole('heading',{name:'نظرة عامة',exact:true})).toBeVisible({timeout:30000});
 const snapshot=await (await page.request.get('/api/v1/bootstrap')).json(),suffix=Date.now().toString(),headers={origin:baseURL!,'X-Fodo-Generation':snapshot.generation};
 const kg=snapshot.units.find((u:{name:string})=>['كجم','كغ','kg','KG','كيلوجرام'].includes(u.name));expect(kg).toBeTruthy();
 const base=()=>({operationId:crypto.randomUUID(),organizationId:snapshot.organizationId,generation:snapshot.generation,businessDate:'2026-10-26',capturedAt:new Date().toISOString(),schemaVersion:1,reason:'اختبار واجهة الجزارة'});
 const post=async(payload:unknown)=>{const response=await page.request.post('/api/v1/butchery',{headers,data:payload});expect(response.ok(),await response.text()).toBe(true);};
 await post({...base(),type:'product.classify',itemId:'beef',meatKind:'beef_input'});
 const first=crypto.randomUUID(),second=crypto.randomUUID();for(const [itemId,name] of [[first,`منتج أول ${suffix}`],[second,`منتج ثان ${suffix}`]])await post({...base(),type:'product.create',itemId,name,meatKind:'beef_product',unitId:kg.id});
 const receipt=await page.request.post('/api/v1/commands',{headers,data:{...base(),type:'receipt.post',locationId:'central',itemId:'beef',quantity:'10',unitCost:'100'}});expect(receipt.ok(),await receipt.text()).toBe(true);
 await page.getByRole('button',{name:'مزامنة الآن',exact:true}).click();
 await page.getByRole('navigation',{name:'التنقل الرئيسي',exact:true}).locator('summary').filter({hasText:'المطابخ والتحضير'}).click();await page.getByRole('button',{name:'المطبخ المركزي والجزارة',exact:true}).click();await page.getByRole('tab',{name:'تجهيز البقري والضاني',exact:true}).click();
 await expect(page.getByRole('heading',{name:'الجزارة والتجهيز',exact:true})).toBeVisible();await page.getByLabel('الموقع',{exact:true}).selectOption('central');
 await page.getByLabel('صنف المدخل',{exact:true}).selectOption('beef');await page.getByLabel('وزن اللحم المستخدم (كجم)',{exact:true}).fill('10');await page.getByLabel('تكاليف التجهيز الإضافية (ج.م)',{exact:true}).fill('100');
 await page.getByLabel('المنتج 1',{exact:true}).selectOption(first);await page.getByLabel('وزن المنتج 1 (كجم)',{exact:true}).fill('6');await page.getByLabel('نسبة التكلفة 1 (%)',{exact:true}).fill('80');await page.getByRole('button',{name:'إضافة منتج للدفعة',exact:true}).click();
 await page.getByLabel('المنتج 2',{exact:true}).selectOption(second);await page.getByLabel('وزن المنتج 2 (كجم)',{exact:true}).fill('3');await page.getByLabel('نسبة التكلفة 2 (%)',{exact:true}).fill('20');await page.getByLabel('فاقد التقطيع (كجم)',{exact:true}).fill('1');await page.getByLabel('المرجع / الملاحظة',{exact:true}).fill(`دفعة ${suffix}`);
 await page.getByRole('button',{name:'حفظ عملية الجزارة',exact:true}).click();await expect(page.getByText('مقبول',{exact:true})).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'السجل والأرصدة',exact:true}).click();await page.locator('.butchery-history summary').filter({hasText:`دفعة ${suffix}`}).click();await expect(page.locator('.butchery-history').filter({hasText:`دفعة ${suffix}`})).toContainText('٨٠%');
 await page.screenshot({path:'test-results/butchery-hosted-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'تحويلات المخزن والمطابخ',exact:true}).click();await expect(page.getByRole('heading',{name:'التحويلات',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'المطبخ المركزي والجزارة',exact:true}).click();await page.getByRole('tab',{name:'تجهيز البقري والضاني',exact:true}).click();await page.getByRole('button',{name:'تعريف أصناف الجزارة',exact:true}).click();await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible({timeout:30000});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'test-results/butchery-hosted-mobile.png',fullPage:true});
 await context.setOffline(true);await page.getByLabel('اسم صنف الجزارة',{exact:true}).fill(`منتج دون اتصال ${suffix}`);await page.getByLabel('نوع صنف الجزارة',{exact:true}).selectOption('lamb_product');await page.getByLabel('المرجع / الملاحظة',{exact:true}).fill('صنف محفوظ دون اتصال');await page.getByRole('button',{name:'حفظ عملية الجزارة',exact:true}).click();await expect(page.getByText('محفوظ محلياً',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'نظرة عامة',exact:true})).toBeVisible();await page.getByRole('button',{name:'القائمة',exact:true}).click();await page.getByRole('button',{name:'المطبخ المركزي والجزارة',exact:true}).click();await page.getByRole('tab',{name:'تجهيز البقري والضاني',exact:true}).click();await expect(page.getByText('محفوظ محلياً',{exact:true})).toBeVisible();
 await context.setOffline(false);await page.getByRole('button',{name:'مزامنة الآن',exact:true}).click();await expect(page.getByText('مقبول',{exact:true})).toHaveCount(2,{timeout:30000});
});
