import {describe,it,expect} from 'vitest';
import {createElement,type ComponentType} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {Snapshot,ReceiptDocument,KitchenIssueDocument,ReportResponse,PeriodMetrics} from '@saas/contracts';
import {reportQuerySchema} from '@saas/contracts';
import {ReceiptPrintSheet} from '../apps/web/src/Receiving';
import {KitchenIssuePrintSheet} from '../apps/web/src/KitchenIssues';
import {ReportPrintSheet} from '../apps/web/src/ReportPrint';
import {rollPageHeight,printPageRule,validPrintPaper} from '../apps/web/src/printing';

const n=(v:number)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:6}).format(v);
const snapshot={organizationId:'grills',organizationName:'واحة أولاد سعد',locations:[{id:'main',name:'المخزن الرئيسي'}],items:[{id:'rice',name:'أرز مصري فاخر طويل الاسم للاختبار',sku:'RICE-001',unit:'كجم',unitId:'kg',category:'حبوب'}],units:[{id:'kg',name:'كجم'}],suppliers:[],receipts:[]} as unknown as Snapshot;
const document:ReceiptDocument={operationId:'receipt',organizationId:'grills',locationId:'main',type:'receipt.document',businessDate:'2026-10-16',reason:'',schemaVersion:1,currency:'EGP',capturedAt:'2026-10-16T08:00:00Z',lines:Array.from({length:27},(_,index)=>({lineId:'line-'+index,itemId:'rice',unitId:'kg',quantity:'20',unitCost:'12.5',enteredQuantity:'2',receivingUnit:{unitId:'bag',name:'شيكارة',baseName:'كجم',factor:'10'}}))};
const receipt={id:'receipt',scope:'grills',document,status:'pending' as const,createdAt:document.capturedAt};
const metrics:PeriodMetrics={received:'9876',reversed:'0',returned:'0',returnReference:'0',netReceived:'9876',kitchen:'0',waste:'0',countIncrease:'0',countDecrease:'0',sales:'100',salesDeduction:'20',productionInput:'0',productionWaste:'0',estimatedSalesCost:null,estimatedMargin:null,foodCostPercent:null,netExpenses:'0',estimatedOperatingResult:null};
const report:ReportResponse={schemaVersion:1,organizationId:'grills',generation:'generation',generatedAt:document.capturedAt,checkpoint:'check',query:reportQuerySchema.parse({organizationId:'grills',generation:'00000000-0000-4000-8000-000000000001',kind:'purchasing',from:'2026-10-01',to:'2026-10-16',page:2,pageSize:10}),previousRange:{from:'2026-09-15',to:'2026-09-30'},current:metrics,previous:metrics,stock:{value:'50',items:1,low:0},charts:{daily:[],inventory:[],kitchens:[],suppliers:[],waste:[],sales:[],production:[]},rows:[{id:'row',date:'2026-10-16',locationId:'main',locationName:'المخزن الرئيسي',itemId:'rice',name:'أرز',sku:'RICE',category:'حبوب',unit:'كجم',quantity:'2',amount:'25',unitCost:'12.5',type:'receipt.post',reference:'REF-001',supplierId:'',supplierName:'',kitchenId:'',kitchenName:''}],total:25,page:2};
const render=<P extends object>(component:ComponentType<P>,props:P)=>renderToStaticMarkup(createElement(component,props));

describe('A4 and 80 mm printing',()=>{
 it('uses valid rectangular roll sizes, bounds long documents and tolerates stale preferences',()=>{
  expect(validPrintPaper('roll80')).toBe('roll80');expect(validPrintPaper('old-value')).toBe('a4');
  expect(printPageRule('a4','landscape')).toContain('size: A4 landscape');
  expect(printPageRule('a4','portrait')).toContain('size: A4 portrait');
  expect(rollPageHeight(960)).toBe(256);expect(rollPageHeight(0)).toBe(50);expect(rollPageHeight(Infinity)).toBe(50);expect(rollPageHeight(100000)).toBe(1000);
  expect(printPageRule('roll80','portrait',256)).toContain('size: 80mm 256mm');expect(printPageRule('roll80','portrait',10000)).toContain('80mm 1000mm');
 });
 it('prints every receiving line with base-unit cost, pack conversion, optional supplier and provisional state',()=>{
  const html=render(ReceiptPrintSheet,{snapshot,row:receipt});
  expect(html.match(/data-label="كمية المخزون"/g)).toHaveLength(27);expect(html).toContain('شيكارة');expect(html).toContain(n(20));expect(html).toContain(n(12.5));expect(html).toContain(n(6750));expect(html).toContain('بدون مورد محدد');expect(html).toContain('غير مقبول بعد');expect(html).toContain('RICE-001');
  const accepted=render(ReceiptPrintSheet,{snapshot:{...snapshot,receipts:[{document,amount:'6750',postedAt:document.capturedAt}]},row:{...receipt,status:'accepted'}});expect(accepted).not.toContain('غير مقبول بعد');expect(accepted).toContain('إجمالي الاستلام');
 });
 it('keeps kitchen transfers distinct from consumption and never invents pending costs',()=>{
  const d:KitchenIssueDocument={...document,type:'kitchen.transfer',reference:'',notes:'اختبار',kitchen:'مطبخ ١',kitchenId:'kitchen',lines:[{lineId:'line',itemId:'rice',unitId:'kg',quantity:'2'}]};
  const row={id:'issue',scope:'grills',document:d,status:'pending' as const,createdAt:d.capturedAt};
  const pending=render(KitchenIssuePrintSheet,{snapshot,row});expect(pending).toContain('لا يحتسب استهلاكاً');expect(pending).toContain('تُثبت بعد قبول المزامنة');expect(pending).toContain('غير مقبول بعد');
  const posted={document:d,amount:'25',method:'moving_average' as const,actor:'owner',postedAt:d.capturedAt,lines:[{lineId:'line',itemId:'rice',name:'أرز عند القبول',sku:'RICE-001',unit:'كجم',quantity:'2',amount:'25'}]};
  const accepted=render(KitchenIssuePrintSheet,{snapshot,row:{...row,status:'accepted',posted}});expect(accepted).toContain('أرز عند القبول');expect(accepted).toContain(n(12.5));expect(accepted).toContain(n(25));expect(accepted).not.toContain('غير مقبول بعد');
 });
 it('separates full-filter report totals from the current detail page and labels cached copies',()=>{
  const html=render(ReportPrintSheet,{snapshot,data:report,title:'المشتريات والمرتجعات',paper:'roll80',cached:true});
  expect(html).toContain('إجماليات كامل النطاق المصفّى');expect(html).toContain(n(9876));expect(html).toContain('تفاصيل الصفحة الحالية فقط');expect(html).toContain('١١–١١');expect(html).toContain('٢٥');expect(html).toContain('نسخة تقرير محفوظة');expect(html).toContain('REF-001');expect(html).not.toContain('رسوم التقرير');
 });
 it('preserves missing estimates and shortages on narrow paper while retaining known zero values',()=>{
  const sales={...report,query:{...report.query,kind:'sales' as const},shortages:[{itemId:'rice',name:'أرز ناقص',unit:'كجم',required:'5',deducted:'2',missing:'3'}]};
  const html=render(ReportPrintSheet,{snapshot,data:sales,title:'المبيعات',paper:'roll80'});expect(html).toContain('غير مكتمل');expect(html).toContain('النقص المسجل');expect(html).toContain('أرز ناقص');expect(html).toContain('لا يسدد هذا النقص');
  const zero=render(ReportPrintSheet,{snapshot,data:{...sales,rows:[],current:{...metrics,estimatedSalesCost:'0',estimatedMargin:'100',foodCostPercent:'0'}},title:'المبيعات',paper:'roll80'});expect(zero).not.toContain('غير مكتمل');expect(zero).toContain('لا توجد سجلات مطابقة');
 });
 it('retains reconciliation missing values and reasons instead of claiming zero actual use',()=>{
  const comparison={opening:'10',closing:null,theoretical:'2',selectedRequired:'1',recorded:'1',shortage:'0',waste:'0',productionInput:'0',netSupply:'0',countDifference:'0',actual:null,variance:null,variancePercent:null,varianceCost:null,theoreticalCost:null,actualCost:null,recordedCost:'10',wasteCost:'0',status:'incomplete' as const,issues:['الجرد الختامي مفقود'],openingCountId:'count',closingCountId:null};
  const data={...report,query:{...report.query,kind:'reconciliation' as const},rows:[{...report.rows[0],unitCost:null,comparison}]};
  const html=render(ReportPrintSheet,{snapshot,data,title:'مطابقة الاستهلاك',paper:'roll80'});expect(html).toContain('الجرد الختامي مفقود');expect(html).toContain('غير مكتمل');expect(html).toContain('data-label="الفعلي من الجرد"><div class="document-print-value">—</div>');
 });
});
