import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

async function enter(page:Page){
 await page.goto('/');await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();
 await expect(page.getByRole('heading',{name:'نظرة عامة',exact:true})).toBeVisible();
 await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'مركز المزامنة',exact:false}).first().click();
}
async function waste(page:Page,quantity:string,reason:string){
 await page.getByRole('button',{name:'تسجيل هالك',exact:true}).click();
 await page.getByLabel('المادة',{exact:true}).selectOption('rice');
 await page.getByLabel('الكمية (كجم)',{exact:true}).fill(quantity);
 await page.getByLabel('سبب الهالك',{exact:true}).fill(reason);
 await page.getByRole('button',{name:'حفظ العملية',exact:true}).click();
}

test('renewing an expired session preserves queued work and posts it once',async({page,context})=>{
 await enter(page);const before=await (await page.request.get('/api/v1/bootstrap')).json();
 const health=await (await page.request.get('/api/v1/health')).json();
 await expect(page.getByTestId('build-version')).toHaveText(`Fodo ${health.buildVersion}`);
 await context.setOffline(true);await waste(page,'1','renewal queued rice');
 await expect(page.getByText('محفوظة محلياً',{exact:true})).toBeVisible();
 await page.evaluate(()=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open('restaurant-saas-v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('snapshots','readwrite');const store=tx.objectStore('snapshots');const get=store.get('grills');get.onsuccess=()=>{const snapshot=get.result;snapshot.access.expiresAt=new Date(Date.now()-1000).toISOString();store.put(snapshot);};tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}));
 await page.reload();await page.getByRole('button',{name:'مركز المزامنة',exact:false}).first().click();
 await expect(page.getByRole('button',{name:'تجديد الجلسة الآن',exact:true})).toBeVisible();
 await context.clearCookies();await context.setOffline(false);
 await page.getByRole('button',{name:'مزامنة الآن',exact:true}).last().click();
 await expect(page.locator('.alert.error[role="alert"]')).toContainText('انتهت الجلسة');
 await expect(page.getByText('محفوظة محلياً',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'تجديد الجلسة',exact:true}).click();
 await expect(page.getByText('مقبولة',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'مزامنة الآن',exact:true}).last().click();
 const after=await (await page.request.get('/api/v1/bootstrap')).json();
 const quantity=(s:any)=>Number(s.balances.find((b:any)=>b.locationId==='central'&&b.itemId==='rice').quantity);
 expect(quantity(after)).toBe(quantity(before)-1);
 expect(after.entries.filter((e:any)=>e.reason==='renewal queued rice')).toHaveLength(1);
});

test('review actions retain rejected history while correction posts a new operation',async({page})=>{
 await enter(page);await waste(page,'999999','review correction rice');
 await expect(page.getByText('تحتاج مراجعة',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'إعادة المحاولة',exact:true}).click();
 await expect(page.getByText('تحتاج مراجعة',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'تصحيح العملية',exact:true}).click();
 await page.getByLabel('الكمية (كجم)',{exact:true}).fill('1');
 await page.getByRole('button',{name:'حفظ العملية',exact:true}).click();
 await expect(page.getByText('تم التصحيح',{exact:true})).toBeVisible();
 await expect(page.getByText('مقبولة',{exact:true})).toBeVisible();
 await waste(page,'999999','review cancelled rice');
 await expect(page.getByText('تحتاج مراجعة',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'إلغاء المرفوضة',exact:true}).click();
 await expect(page.getByText('ملغاة',{exact:true})).toBeVisible();
 const after=await (await page.request.get('/api/v1/bootstrap')).json();
 expect(after.entries.filter((e:any)=>e.reason==='review correction rice')).toHaveLength(1);
 expect(after.entries.filter((e:any)=>e.reason==='review cancelled rice')).toHaveLength(0);
});

test('exported offline work can be previewed and restored without duplicate posting',async({page,context})=>{
 await enter(page);await context.setOffline(true);await waste(page,'1','restore queued rice');
 const downloadEvent=page.waitForEvent('download');
 await page.getByRole('button',{name:'تصدير نسخة استرداد',exact:true}).click();
 const download=await downloadEvent;const buffer=await readFile((await download.path())!);
 // Simulate loss of just the device outbox after a successful export.
 await page.evaluate(()=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open('restaurant-saas-v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('commands','readwrite');tx.objectStore('commands').clear();tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}));
 await page.reload();await page.getByRole('button',{name:'مركز المزامنة',exact:false}).first().click();
 await page.getByRole('button',{name:'استعادة ملف',exact:true}).click();
 await page.getByLabel('ملف الاسترداد',{exact:true}).setInputFiles({name:'recovery.json',mimeType:'application/json',buffer});
 await expect(page.locator('.recovery-preview')).toContainText('عمليات جديدة: 1');
 await page.getByRole('button',{name:'تأكيد الاسترداد',exact:true}).click();
 await expect(page.getByText('محفوظة محلياً',{exact:true})).toBeVisible();
 await context.setOffline(false);await page.getByRole('button',{name:'مزامنة الآن',exact:true}).last().click();
 await expect(page.getByText('مقبولة',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'استعادة ملف',exact:true}).click();
 await page.getByLabel('ملف الاسترداد',{exact:true}).setInputFiles({name:'recovery.json',mimeType:'application/json',buffer});
 await expect(page.locator('.recovery-preview')).toContainText('موجودة على هذا الجهاز: 1');
 await page.getByRole('button',{name:'تأكيد الاسترداد',exact:true}).click();
 const after=await (await page.request.get('/api/v1/bootstrap')).json();
 expect(after.entries.filter((e:any)=>e.reason==='restore queued rice')).toHaveLength(1);
});
