import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {getSnapshot,postCommand,postKitchenIssue} from '@saas/server';
import {postDocumentCorrection} from '../../packages/server/document-corrections';
import {counterPOSFixture} from '../fixtures/counter-pos';

test.use({serviceWorkers:'block'});

test('retries a kitchen quantity correction and edits the same posted document',async({page})=>{
 test.setTimeout(240000);
 const fixture=await counterPOSFixture();
 const {db}=fixture;
 const access={...fixture.access,role:'owner' as const};
 const generation=fixture.snapshot.generation!;
 const issued='2026-11-06',operationId=randomUUID();
 try{
  await postCommand(db,access,{organizationId:access.organizationId,operationId:randomUUID(),locationId:'main',
   type:'receipt.post',itemId:'rice',quantity:'15',unitCost:'10',reason:'Isolated test stock',
   businessDate:issued,capturedAt:new Date().toISOString(),schemaVersion:1,generation});
  await postKitchenIssue(db,access,{organizationId:access.organizationId,operationId,locationId:'main',
   type:'kitchen.transfer',destinationLocationId:'k1',kitchenId:'k1',kitchen:'المطبخ البحري',
   businessDate:issued,capturedAt:new Date().toISOString(),generation,schemaVersion:1,currency:'EGP',
   notes:'',reference:'تصحيح اختباري',lines:[{lineId:randomUUID(),itemId:'rice',unitId:'kg',quantity:'10'}]});
  const ids:string[]=[];
  const bundle=process.env.FODO_HOSTED_BUNDLE_DIR;
  if(bundle){
   const [script,style]=await Promise.all([readFile(join(bundle,'frontend.js')),readFile(join(bundle,'frontend.css'))]);
   await page.route('**/*',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ar" dir="rtl"><link rel="stylesheet" href="/frontend.css"><div id="root"></div><script type="module" src="/frontend.js"></script></html>'});
    if(path==='/frontend.js')return route.fulfill({contentType:'application/javascript',body:script});
    if(path==='/frontend.css')return route.fulfill({contentType:'text/css',body:style});
    return route.fulfill({status:404,body:''});
   });
   await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{ok:true}}));
  }
  await page.route('**/api/v1/demo-session',route=>route.fulfill({json:{ok:true}}));
  await page.route('**/api/v1/bootstrap',async route=>route.fulfill({json:await getSnapshot(db,access)}));
  await page.route('**/api/v1/document-corrections',async route=>{
   const command=route.request().postDataJSON();
   ids.push(command.operationId);
   const result=await postDocumentCorrection(db,access,command);
   if(ids.length===1)await route.abort('connectionreset');
   else await route.fulfill({json:result});
  });
  await page.goto('/');
  if(bundle){
   await page.getByLabel('البريد الإلكتروني',{exact:true}).fill('qa@example.test');
   await page.getByLabel('كلمة المرور',{exact:true}).fill('local-test-password');
   await page.locator('form.auth-form button[type=submit]').click();
  }else await page.getByRole('button',{name:'فتح مجموعة المشاوي',exact:true}).click();
  const nav=page.getByRole('navigation',{name:'التنقل الرئيسي'});
  const kitchen=nav.getByRole('button',{name:'المطابخ',exact:true});
  const document=page.locator('#operation-'+operationId);
  const open=async()=>{
   if(!await kitchen.isVisible())await nav.locator('summary').filter({hasText:'المطابخ والتحضير'}).click();
   await kitchen.click();
   await page.getByLabel('الموقع',{exact:true}).selectOption('main');
   await document.locator(':scope > summary').click();
   await document.getByRole('button',{name:'تصحيح كمية أرز',exact:true}).click();
  };
  await expect(nav).toBeVisible({timeout:60000});
  await open();
  const form=page.getByRole('dialog',{name:'تصحيح كمية الصرف'});
  await form.getByLabel('الكمية الصحيحة').fill('٤');
  await form.getByLabel('سبب التصحيح').fill('خطأ في إدخال الكمية');
  await expect(form.getByText(/المطبخ البحري −٦/)).toBeVisible();
  await form.getByRole('button',{name:'تأكيد تصحيح الكمية',exact:true}).click();
  await expect(form.getByRole('alert')).toContainText('الطلب محفوظ');
  await page.reload();
  await expect(nav).toBeVisible({timeout:60000});
  await open();
  await form.getByRole('button',{name:'إعادة تأكيد التصحيح',exact:true}).click();
  await expect(page.getByText('تم تصحيح الكمية على الخادم.',{exact:true})).toBeVisible();
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  const row=document.getByRole('row').filter({has:page.getByRole('cell',{name:'أرز',exact:true})});
  await expect(row.getByRole('cell',{name:'٤',exact:true})).toBeVisible();
  const snapshot=await getSnapshot(db,access);
  expect(snapshot.kitchenIssues?.find(issue=>issue.document.operationId===operationId)?.quantityRevisions).toHaveLength(1);
  expect(Number(snapshot.balances.find(balance=>balance.locationId==='main'&&balance.itemId==='rice')?.quantity)).toBe(11);

  await postCommand(db,access,{organizationId:access.organizationId,operationId:randomUUID(),locationId:'main',
   type:'receipt.post',itemId:'pepper',quantity:'5',unitCost:'10',reason:'Isolated test stock',
   businessDate:issued,capturedAt:new Date().toISOString(),schemaVersion:1,generation});
  const savedDocument=snapshot.kitchenIssues!.find(issue=>issue.document.operationId===operationId)!.document;
  const later={...savedDocument,operationId:randomUUID(),reference:'Later stock movement',
   lines:savedDocument.lines.map(line=>({...line,lineId:randomUUID(),quantity:'1'}))};
  await postKitchenIssue(db,access,later);
  await postDocumentCorrection(db,access,{operationId:randomUUID(),organizationId:access.organizationId,generation,
   sourceId:later.operationId,reason:'Reverse unrelated movement',kind:'kitchen_void',businessDate:issued});
  await page.reload();
  await expect(nav).toBeVisible({timeout:60000});
  if(!await kitchen.isVisible())await nav.locator('summary').filter({hasText:'المطابخ والتحضير'}).click();
  await kitchen.click();
  await page.getByLabel('الموقع',{exact:true}).selectOption('main');
  await document.locator(':scope > summary').click();
  await document.getByRole('button',{name:'تعديل المستند',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'تعديل مستند صرف المطبخ'});
  await editor.getByLabel('سبب التعديل').fill('تصحيح الأصناف المسجلة');
  await editor.getByRole('button',{name:'حذف أرز من مستند الصرف',exact:true}).click();
  await editor.getByRole('combobox',{name:'مادة الصرف'}).fill('توابل');
  await editor.getByRole('option',{name:/توابل/}).click();
  await editor.getByLabel('كمية الصرف',{exact:true}).fill('٢');
  await editor.getByRole('button',{name:/إضافة للقائمة/}).click();
  await expect(editor.getByText('مراجعة تعديلات المستند',{exact:true})).toBeVisible();
  await editor.getByRole('button',{name:'حفظ تعديلات المستند',exact:true}).click();
  await expect(page.getByText('تم حفظ تعديلات المستند على الخادم.',{exact:true})).toBeVisible();
  await expect(document.getByRole('cell',{name:'توابل',exact:true})).toBeVisible();
  const edited=(await getSnapshot(db,access)).kitchenIssues!.find(issue=>issue.document.operationId===operationId)!;
  expect(edited.revision).toBe(2);
  expect(edited.document.lines).toMatchObject([{itemId:'pepper',quantity:'2'}]);
  expect(edited.documentRevisions).toHaveLength(1);
  await document.getByText('سجل تعديلات المستند (٢)',{exact:true}).click();
  await expect(document.getByText('تصحيح الأصناف المسجلة',{exact:true})).toBeVisible();
  await expect(document.getByText('خطأ في إدخال الكمية',{exact:true})).toBeVisible();
  await expect(document.getByText(/أرز · حذف/)).toBeVisible();
 }finally{await db.close();}
});
