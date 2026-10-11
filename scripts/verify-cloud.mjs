// Read-only hosted browser checks. Uses an isolated browser and never posts stock.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const origin=process.env.FODO_CLOUD_ORIGIN||'https://fodo.am-agent2026.workers.dev';
const owner=JSON.parse(await readFile(process.env.FODO_OWNER_CREDENTIALS||'.cloud-build/initial-owner.json','utf8'));
const client=JSON.parse(await readFile(process.env.FODO_CLIENT_PROFILE||'docs/clients/wahat-awlad-saed.json','utf8'));
await mkdir('.cloud-build/screenshots',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const result={origin,checks:[],errors:[]};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',e=>result.errors.push(e.message));
 await page.goto(origin,{waitUntil:'networkidle'});await page.getByLabel('البريد الإلكتروني',{exact:true}).fill(owner.email);await page.getByLabel('كلمة المرور',{exact:true}).fill(owner.password);await page.getByRole('button',{name:'تسجيل الدخول',exact:true}).click();
 await expect(page.getByRole('heading',{name:'نظرة عامة',exact:true})).toBeVisible({timeout:30000});await expect(page.getByText('التطبيق جاهز للفتح دون اتصال',{exact:false})).toBeVisible({timeout:30000});result.checks.push('Login and offline shell');
 const profile=page.getByRole('dialog',{name:'بيانات المؤسسة',exact:true}),organizationButton=page.getByRole('button',{name:'المؤسسة الحالية',exact:true});
 await expect(profile).toHaveCount(0);await expect(page.getByRole('region',{name:'بيانات المؤسسة'})).toHaveCount(0);await organizationButton.click();await expect(profile).toBeVisible();
 await expect(profile.getByRole('heading',{name:client.name,exact:true})).toBeVisible();
 for(const field of ['nameEn','address','phone','additionalPhone','email'])await expect(profile.getByText(client.profile[field],{exact:true})).toBeVisible();
 await expect(profile.getByRole('link',{name:'واتساب',exact:true})).toHaveAttribute('href','https://wa.me/'+client.profile.whatsapp.slice(1));
 await expect(profile.getByRole('link',{name:'الموقع على الخريطة',exact:true})).toHaveAttribute('href',client.profile.mapUrl);
 const loadedLogos=()=>page.getByRole('img',{name:'شعار '+client.name}).evaluateAll(images=>images.length===2&&images.every(image=>image.complete&&image.naturalWidth>0));
 await expect.poll(loadedLogos).toBe(true);await page.screenshot({path:'.cloud-build/screenshots/client-profile-desktop.png',animations:'disabled'});await page.keyboard.press('Escape');await expect(profile).toHaveCount(0);await expect(organizationButton).toBeFocused();await page.screenshot({path:'.cloud-build/screenshots/client-desktop.png',fullPage:true,animations:'disabled'});result.checks.push('Client details open on request; Escape restores focus; home has no profile card');
 await page.setViewportSize({width:390,height:844});await organizationButton.click();await expect(profile).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'.cloud-build/screenshots/client-profile-mobile.png',animations:'disabled'});await page.getByRole('button',{name:'إغلاق بيانات المؤسسة',exact:true}).click();await expect(profile).toHaveCount(0);await expect(organizationButton).toBeFocused();await page.screenshot({path:'.cloud-build/screenshots/client-mobile.png',fullPage:true,animations:'disabled'});await page.setViewportSize({width:1440,height:1000});result.checks.push('Mobile profile dialog without page overflow and close-button focus restoration');
 const forbidden=/نسخة تطوير|بيانات تجريبية|صافي تكلفة تطوير|قيد التطوير|أوافق على مسح معاملات التطوير/;
 for(const name of ['المخزون','إعداد المخزون','الموردون','المشتريات','الوصفات والتكاليف','المبيعات']){
  await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('heading',{name,exact:true,level:1})).toBeVisible();if(forbidden.test(await page.locator('body').innerText()))throw new Error(`Development note visible in ${name}`);
 }
 await page.getByRole('tab',{name:'الاستهلاك النظري',exact:true}).click();await expect(page.getByRole('heading',{name:'الاستهلاك النظري وتكلفة المبيعات'})).toBeVisible();result.checks.push('Operational pages and calculation-only sales');
 await page.screenshot({path:'.cloud-build/screenshots/desktop.png',fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'المخزون',exact:true}).click();await expect(page.getByText('أرز الهرم',{exact:true}).first()).toBeVisible();await page.screenshot({path:'.cloud-build/screenshots/mobile.png',fullPage:false,animations:'disabled'});result.checks.push('Mobile inventory');
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'المخزون',exact:true}).click();await expect(page.getByRole('heading',{name:'المخزون',exact:true,level:1})).toBeVisible();await expect(page.getByText('أرز الهرم',{exact:true}).first()).toBeVisible();result.checks.push('Offline reload preserves tenant catalog');
 await page.getByRole('button',{name:'نظرة عامة',exact:true}).click();await expect(profile).toHaveCount(0);await organizationButton.click();await expect(profile.getByRole('heading',{name:client.name,exact:true})).toBeVisible();await expect.poll(loadedLogos).toBe(true);await page.keyboard.press('Escape');await expect(profile).toHaveCount(0);result.checks.push('Offline client details dialog and cached logo');
 await context.setOffline(false);await page.getByRole('button',{name:'مركز المزامنة',exact:true}).click();await page.getByRole('button',{name:'تسجيل الخروج',exact:true}).click();await expect(page.getByRole('button',{name:'تسجيل الدخول',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('button',{name:'تسجيل الدخول',exact:true})).toBeVisible();result.checks.push('Logout locks saved workspace across reload');
 if(result.errors.length)throw new Error(result.errors.join('; '));
}finally{await browser.close();await writeFile('.cloud-build/browser-verification.json',JSON.stringify(result,null,2));}
console.log(JSON.stringify(result,null,2));
