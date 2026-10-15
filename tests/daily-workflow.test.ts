import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {documentFeedback} from '../apps/web/src/document-feedback';
import DailyWorkspace from '../apps/web/src/DailyWorkspace';

it('does not announce confirmed stock when a document was merely sent or captured',()=>{
 for(const state of [undefined,'pending','acceptedAwaiting'] as const){const result=documentFeedback(state);expect(result.tone).toBe('pending');expect(result.title).not.toContain('تم التأكيد');}
 expect(documentFeedback('acceptedAwaiting').detail).toContain('ننتظر تأكيد الرصيد');
 expect(documentFeedback('acceptedAwaiting',true).tone).toBe('success');
 expect(documentFeedback('needsReview').tone).toBe('warning');
 expect(documentFeedback('needsReview').detail).toContain('لم يُحدّث المخزون');
 for(const state of ['cancelled','superseded'] as const)expect(documentFeedback(state).tone).toBe('neutral');
});
it('shows blocked-action reasons and scopes offline attention to the right evidence',()=>{
 const noop=()=>{};
 const html=renderToStaticMarkup(createElement(DailyWorkspace,{locationName:'المخزن الرئيسي',receivingReason:'أضف وحدة مخزون',kitchenReason:'أضف مطبخًا مستلمًا',lowCount:3,pending:2,review:1,online:false,expired:false,receive:noop,supply:noop,inventory:noop,lowStock:noop,sync:noop,reports:noop,setup:noop,guide:noop}));
 expect(html).toContain('أضف وحدة مخزون');expect(html).toContain('أضف مطبخًا مستلمًا');expect(html.match(/disabled=""/g)).toHaveLength(2);
 expect(html).toContain('لكل المواقع');expect(html).toContain('في الموقع الحالي');expect(html).toContain('أنت دون اتصال');
 expect(html).not.toContain('لا توجد عمليات معلقة');
});
