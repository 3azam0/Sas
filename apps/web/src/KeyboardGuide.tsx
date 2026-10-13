'use client';
import {useEffect,useRef} from 'react';
import KeyboardShortcuts from './KeyboardShortcuts';
export default function KeyboardGuide({close}:{close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),button=useRef<HTMLButtonElement>(null),trigger=useRef<HTMLElement|null>(typeof document!=='undefined'&&document.activeElement instanceof HTMLElement?document.activeElement:null);
 useEffect(()=>{dialog.current?.showModal();button.current?.focus();return()=>{if(trigger.current?.isConnected)trigger.current.focus({preventScroll:true});};},[]);
 return <dialog ref={dialog} className="modal keyboard-guide-modal" aria-labelledby="keyboard-guide-title" onCancel={event=>{event.preventDefault();close();}}>
  <div className="modal-header"><div><h2 id="keyboard-guide-title">اختصارات لوحة المفاتيح</h2><p>أدخل البيانات وتنقّل بين الحقول بسهولة.</p></div><button ref={button} type="button" className="icon-button" aria-label="إغلاق دليل لوحة المفاتيح" onClick={close}>×</button></div>
  <div className="modal-body keyboard-guide-body"><KeyboardShortcuts/><p className="notice">اضغط على حقل المادة لعرض القائمة، أو اكتب اسمها أو كودها لتصفية النتائج. اختر بالأسهم وEnter للانتقال للحقل التالي. Tab أو Escape يحفظ الاختيار الحالي دون اعتماد نص البحث. في الملاحظات متعددة الأسطر، Enter يضيف سطرًا جديدًا.</p><p className="field-hint">في صرف المخزون، Enter بعد الكمية يضيف المادة إلى القائمة. في استلام المواد، Enter بعد الكمية ينتقل للتكلفة، ثم Enter يضيف المادة ويعيدك إلى البحث. تبقى البيانات المدخلة في النموذج عند ظهور خطأ، وينتقل التركيز إلى الحقل المطلوب.</p></div>
  <div className="modal-footer"><button type="button" className="secondary" onClick={close}>إغلاق الدليل</button></div>
 </dialog>;
}
