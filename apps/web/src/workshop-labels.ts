import type {WorkshopCommand} from '../../../packages/contracts/butchery';
export const workshopTitles:Record<WorkshopCommand['type'],string>={
 'inventory.count':'جرد فعلي',
 'production.loss':'تسجيل فاقد',
 'product.create':'تعريف صنف جزارة','butchery.process':'دفعة جزارة','transfer.dispatch':'إرسال تحويل','transfer.receive':'استلام تحويل',
 'catalog.create':'تعريف صنف','production.create':'إنشاء دفعة','production.issue':'إصدار مواد','production.return':'مرتجع مواد','production.receive':'استلام إنتاج','production.cost':'تكلفة تشغيل','production.close':'إغلاق دفعة','production.cancel':'إلغاء دفعة','production.reverse':'عكس استلام'
};
