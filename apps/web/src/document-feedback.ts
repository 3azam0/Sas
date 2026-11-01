export type DocumentStage='pending'|'acceptedAwaiting'|'accepted'|'needsReview'|'cancelled'|'superseded';
export function documentFeedback(status:DocumentStage|undefined,confirmed=false){
 if(confirmed||status==='accepted')return {tone:'success',title:'تم التأكيد وتحديث المخزون',detail:'قُبل المستند وأصبح أثره ظاهرًا في الرصيد المؤكد.'};
 if(status==='needsReview')return {tone:'warning',title:'المستند محفوظ ويحتاج مراجعة',detail:'لم يُحدّث المخزون بهذا المستند. افتح مركز المزامنة لمعرفة السبب وتصحيحه.'};
 if(status==='cancelled'||status==='superseded')return {tone:'neutral',title:status==='cancelled'?'أُلغي المستند المحلي':'تم تصحيح المستند',detail:'راجع السجل لمعرفة الحالة والمستند المرتبط.'};
 return {tone:'pending',title:'محفوظ على الجهاز — بانتظار المزامنة',detail:status==='acceptedAwaiting'?'تم إرسال المستند؛ ننتظر تأكيد الرصيد من الخادم.':'لم يتغير الرصيد المؤكد بعد. تتم المزامنة عند توفر الاتصال.'};
}
