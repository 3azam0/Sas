import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {FinancialCards} from '../apps/web/src/Reports';
import type {PeriodMetrics} from '@saas/contracts';
const metrics:PeriodMetrics={received:'0',reversed:'0',returned:'0',returnReference:'0',netReceived:'0',kitchen:'0',waste:'0',countIncrease:'0',countDecrease:'0',sales:'50',salesDeduction:'20',productionInput:'0',productionWaste:'0',estimatedSalesCost:'20',estimatedMargin:'30',foodCostPercent:'40',salesCorrections:'50',netExpenses:'40',estimatedOperatingResult:'-10'};
it('shows corrections, expenses and a clearly estimated result while retaining negative results',()=>{
 const html=renderToStaticMarkup(createElement(FinancialCards,{current:metrics}));
 expect(html).toContain('مرتجعات وإلغاءات المبيعات');expect(html).toContain('صافي مصروفات التشغيل');expect(html).toContain('تكلفة الوصفات التقديرية');expect(html).toContain('النتيجة التقديرية بعد المصروفات');expect(html).toContain('ليست صافي ربح');expect(html).toContain(new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(-10));
});
it('keeps missing costs incomplete and known zero results priced',()=>{
 const missing=renderToStaticMarkup(createElement(FinancialCards,{current:{...metrics,estimatedSalesCost:null,estimatedOperatingResult:null}}));expect(missing.match(/غير مكتمل/g)).toHaveLength(2);
 const zero=renderToStaticMarkup(createElement(FinancialCards,{current:{...metrics,estimatedSalesCost:'0',estimatedOperatingResult:'0'}}));expect(zero).not.toContain('غير مكتمل');
});
