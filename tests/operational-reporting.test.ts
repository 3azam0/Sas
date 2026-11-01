import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ReportRow,ReportResponse,Snapshot,StockCardSummary,ButcheryModeSummary} from '@saas/contracts';
import {reportQuerySchema} from '@saas/contracts';
import {stockCardCsv,butcheryCsv} from '../packages/domain/operational-reporting';
import {reportCsv} from '../packages/domain/reporting';
import {ReportPrintSheet} from '../apps/web/src/ReportPrint';
import {useUI} from '../apps/web/src/store';

const row:ReportRow={id:crypto.randomUUID(),date:'2026-10-10',locationId:'main',locationName:'Main',itemId:'raw',name:'Raw',sku:'RAW',category:'Meat',unit:'كجم',quantity:'2',amount:'9007199254740993.123456789012',unitCost:'100',type:'butchery.beef',reference:'=CMD()',supplierId:'',supplierName:'',kitchenId:'',kitchenName:'',stockCard:{sequence:'9007199254740993',before:'13',incoming:'0',outgoing:'2',running:'11'},butchery:{mode:'beef',inputWeight:'2',headCount:null,carcassWeight:null,slaughterLoss:'0',cuttingLoss:'0.2',outputWeight:'1.8',inputCost:'200',processingCost:'20',yieldPercent:'90',carcassYieldPercent:null,cuttingYieldPercent:'90',outputs:[{itemId:'main-product',name:'Product',sku:'PRODUCT',quantity:'1.6',costShare:'100',amount:'220.000000000000',unitCost:'137.500000'},{itemId:'free',name:'أحشاء',sku:'FREE',quantity:'0.2',costShare:'0',amount:'0.000000000000',unitCost:'0.000000'}]}};
const stock:StockCardSummary={itemId:'raw',name:'Raw',sku:'RAW',unit:'كجم',balances:[{locationId:'main',locationName:'Main',unit:'كجم',opening:'10',incoming:'3',outgoing:'2',closing:'11'}]};
const mode:ButcheryModeSummary={mode:'beef',batches:1,headCount:0,inputWeight:'2',carcassWeight:'0',slaughterLoss:'0',cuttingLoss:'0.2',outputWeight:'1.8',inputCost:'200',processingCost:'20',totalCost:'220',yieldPercent:'90',carcassYieldPercent:null,cuttingYieldPercent:'90',unitCost:'122.222222'};
it('exports full stock-card balances, exact sequences and movement values without spreadsheet formulas',()=>{
 const cells=stockCardCsv(stock,[row],()=> 'صرف');expect(cells.some(r=>r.join('|')==='Main|كجم|10|3|2|11')).toBe(true);
 const csv=reportCsv(cells);expect(csv).toContain('9007199254740993.123456789012');expect(csv).toContain('9007199254740993');expect(csv).toContain("'=CMD()");expect(csv).toContain('الرصيد بعد الحركة');
});
it('exports batches and allocated products in separate sections with known zero costs intact',()=>{
 const cells=butcheryCsv([mode],[row]);expect(cells.some(r=>r[0]===row.id&&r[1]==='أحشاء'&&r.at(-1)==='0.000000')).toBe(true);
 const csv=reportCsv(cells);expect(csv).toContain('9007199254740993.123456789012');expect(csv).toContain('التكلفة المخصصة ج.م');expect(csv).toContain('نسبة التكلفة ٪');
 const many=Array.from({length:210},()=>({...row,butchery:{...row.butchery!,outputs:Array.from({length:50},()=>row.butchery!.outputs[0])}}));expect(()=>butcheryCsv([mode],many)).toThrow('١٠٬٠٠٠');
});
it('scopes the processing-mode filter to butchery without changing legacy report query keys',()=>{
 const previous=useUI.getState().reportFilters;
 try{
  useUI.getState().setReportFilters({...previous,kind:'butchery',butcheryMode:'lamb'});expect(useUI.getState().reportFilters.butcheryMode).toBe('lamb');
  useUI.getState().setReportFilters({...useUI.getState().reportFilters,kind:'sales'});expect(useUI.getState().reportFilters.butcheryMode).toBeUndefined();
  const parsed=reportQuerySchema.parse({organizationId:'grills',kind:'inventory',from:'2026-10-01',to:'2026-10-10'});expect(JSON.stringify(parsed)).not.toContain('butcheryMode');
 }finally{useUI.setState({reportFilters:previous});}
});
it('prints per-location balances and every product even when on-screen product details are collapsed',()=>{
 const snapshot:Snapshot={organizationId:'grills',organizationName:'Test',currency:'EGP',access:{organizationId:'grills',userId:'owner',deviceId:crypto.randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()},locations:[{id:'main',name:'Main',kind:'مخزن'}],items:[],balances:[],layers:[],entries:[],acceptedOperationIds:[],fetchedAt:new Date().toISOString()};
 const query=reportQuerySchema.parse({organizationId:'grills',kind:'stockCard',itemId:'raw',from:'2026-10-10',to:'2026-10-10'});
 const zero={received:'0',reversed:'0',returned:'0',returnReference:'0',netReceived:'0',kitchen:'0',waste:'0',countIncrease:'0',countDecrease:'0',sales:'0',salesDeduction:'0',productionInput:'0',productionWaste:'0',estimatedSalesCost:null,estimatedMargin:null,foodCostPercent:null};
 const data:ReportResponse={schemaVersion:1,organizationId:'grills',generation:crypto.randomUUID(),generatedAt:new Date().toISOString(),checkpoint:'1:1',query,previousRange:{from:'2026-10-09',to:'2026-10-09'},current:zero,previous:zero,stock:{value:'0',items:0,low:0},charts:{daily:[],inventory:[],kitchens:[],suppliers:[],waste:[],sales:[],production:[]},stockCard:stock,rows:[row],total:1,page:1};
 const cardHtml=renderToStaticMarkup(createElement(ReportPrintSheet,{snapshot,data,title:'بطاقة صنف',paper:'roll80'}));expect(cardHtml).toContain('رصيد افتتاح الفترة');expect(cardHtml).toContain('الرصيد بعد الحركة');expect(cardHtml).toContain('9007199254740993');expect(cardHtml).not.toContain('NaN');
 const batchHtml=renderToStaticMarkup(createElement(ReportPrintSheet,{snapshot,data:{...data,query:{...query,kind:'butchery'},butchery:{current:[mode],previous:[],ranks:[]}},title:'الجزارة',paper:'roll80'}));expect(batchHtml).toContain('أحشاء');expect(batchHtml).toContain('المنتجات والتكاليف المخصصة');expect(batchHtml).toContain('٠ ج.م');expect(batchHtml).not.toContain('<details');expect(batchHtml).not.toContain('NaN');
});
