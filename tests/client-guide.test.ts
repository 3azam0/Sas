import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {GuideArticle,GuideExplorer,HelpProvider,HelpButton} from '../apps/web/src/ClientGuide';
import {guideTopics,findGuide,searchGuide,screenGuide} from '../apps/web/src/guide-content';
import {navigationGroups} from '../apps/web/src/navigation';

describe('client task guide',()=>{
 it('resolves all navigation help and related topics without dangling references',()=>{
  const ids=guideTopics.map(topic=>topic.id);expect(new Set(ids).size).toBe(ids.length);
  for(const group of navigationGroups)for(const view of group.views)expect(findGuide(screenGuide[view])).toBeDefined();
  for(const topic of guideTopics){expect(topic.steps.length).toBeGreaterThan(0);for(const related of topic.related)expect(findGuide(related)).toBeDefined();}
 });
 it('searches Arabic normalization, aliases and full-body instructions with multiple terms',()=>{
  expect(searchGuide('إِسْتِلام').map(t=>t.id)).toContain('receiving');
  expect(searchGuide('توريد عبوة').map(t=>t.id)).toContain('receiving');
  expect(searchGuide('لا يسدد النقص').map(t=>t.id)).toContain('sales');
  expect(searchGuide('غير مكتمل').map(t=>t.id)).toContain('reconciliation');
  expect(searchGuide('موضوعغيرموجود')).toEqual([]);expect(searchGuide('  ')).toHaveLength(guideTopics.length);
 });
 it('keeps consumption, transfers and shortages distinct in rendered instructions',()=>{
  const render=(id:Parameters<typeof findGuide>[0])=>renderToStaticMarkup(createElement(GuideArticle,{topic:findGuide(id),choose:()=>{}}));
  expect(render('kitchenSupply')).toContain('هذا تحويل مخزون');
  expect(render('sales')).toContain('الاستلام اللاحق لا يسدد النقص القديم تلقائيًا');
  expect(render('reconciliation')).toContain('«غير مكتمل» لا يعني صفر استهلاك');
  expect(render('counts')).toContain('خانة فارغة تعني لم يُعدّ');
 });
 it('renders read-only help controls without submit/download actions',()=>{
  const html=renderToStaticMarkup(createElement(HelpProvider,{children:createElement('div',null,createElement(HelpButton,{topic:'receiving'}),createElement(GuideExplorer,{initialTopic:'receiving'}))}));
  expect(html).toContain('مساعدة: استلام مواد');expect(html).toContain('aria-haspopup="dialog"');
  expect(html).not.toMatch(/type="submit"|download=|<form/);expect(html).toContain('ابحث في دليل الاستخدام');
 });
});
