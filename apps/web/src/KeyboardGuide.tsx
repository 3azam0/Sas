'use client';
import {useEffect,useRef} from 'react';
const shortcuts=[
 ['Tab','الانتقال إلى الحقل أو الزر التالي.'],
 ['Shift + Tab','العودة إلى الحقل أو الزر السابق.'],
 ['Enter','الانتقال إلى الحقل التالي. على زر محدد، ينفّذ إجراء الزر.'],
 ['Shift + Enter','العودة إلى الحقل السابق.'],
 ['↑ / ↓','التنقل بين نتائج البحث أو خيارات القائمة.'],
 ['Space','تحديد مربع الاختيار أو إلغاء تحديده، أو تشغيل الزر المحدد.'],
 ['Ctrl / ⌘ + Enter','حفظ أو تأكيد النموذج بعد التحقق من الحقول؛ يعمل فقط عندما يكون زر التأكيد متاحًا.'],
 ['Alt + Insert','إضافة سطر مادة أو مكوّن أو عبوة شراء، عندما يوجد زر إضافة داخل النموذج.'],
 ['Esc','إغلاق نتائج البحث أولًا، ثم إغلاق النموذج أو إلغاؤه عندما لا يكون الحفظ جاريًا.']
];
export default function KeyboardGuide({close}:{close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),button=useRef<HTMLButtonElement>(null),trigger=useRef<HTMLElement|null>(typeof document!=='undefined'&&document.activeElement instanceof HTMLElement?document.activeElement:null);
 useEffect(()=>{dialog.current?.showModal();button.current?.focus();return()=>{if(trigger.current?.isConnected)trigger.current.focus({preventScroll:true});};},[]);
 return <dialog ref={dialog} className="modal keyboard-guide-modal" aria-labelledby="keyboard-guide-title" onCancel={event=>{event.preventDefault();close();}}>
  <div className="modal-header"><div><h2 id="keyboard-guide-title">اختصارات لوحة المفاتيح</h2><p>أدخل البيانات وتنقّل بين الحقول بسهولة.</p></div><button ref={button} type="button" className="icon-button" aria-label="إغلاق دليل لوحة المفاتيح" onClick={close}>×</button></div>
  <div className="modal-body keyboard-guide-body"><table><thead><tr><th>المفتاح</th><th>الاستخدام</th></tr></thead><tbody>{shortcuts.map(([key,description])=><tr key={key}><td><kbd>{key}</kbd></td><td>{description}</td></tr>)}</tbody></table><p className="notice">اكتب اسم المادة أو كودها لفتح نتائج البحث، ثم اختر بالأسهم وEnter. في الملاحظات متعددة الأسطر، Enter يضيف سطرًا جديدًا.</p><p className="field-hint">في صرف المطابخ، Enter بعد الكمية ينتقل للمادة التالية أو يضيف سطرًا. تبقى البيانات المدخلة في النموذج عند ظهور خطأ، وينتقل التركيز إلى الحقل المطلوب.</p></div>
  <div className="modal-footer"><button type="button" className="secondary" onClick={close}>إغلاق الدليل</button></div>
 </dialog>;
}
