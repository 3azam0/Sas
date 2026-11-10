import {menuDraftRowSchema} from '@saas/contracts';
import {normalizeNumber} from './opening-import';
import {parseSpreadsheet} from './spreadsheet-import';

const columns=['كود مقترح','القسم','اسم الصنف','الحجم','السعر ج.م','الوصف والاختيارات','المصدر','ملاحظات المراجعة'];

export function parseMenuDrafts(bytes:ArrayBuffer,fileName:string){
 if(bytes.byteLength>1024*1024)throw new Error('ملف المنيو يتجاوز ١ ميجابايت.');
 const rows=parseSpreadsheet(bytes,fileName,2);
 const headerIndex=rows.findIndex(row=>columns.slice(0,5).every((label,i)=>row[i]===label));
 if(headerIndex<0)throw new Error('استخدم ملف المنيو الذي يحتوي على أعمدة الكود والقسم والاسم والحجم والسعر.');
 const headers=rows[headerIndex];
 const drafts=rows.slice(headerIndex+1).map((row,index)=>{
  const value=(label:string)=>row[headers.indexOf(label)]??'';
  const parsed=menuDraftRowSchema.safeParse({
   code:row[0],category:row[1],name:row[2],portion:row[3],sellingPrice:normalizeNumber(row[4]??''),
   description:value(columns[5]),reference:value(columns[6]),note:value(columns[7]),
  });
  if(!parsed.success)throw new Error(`راجع بيانات الصنف في سطر البيع ${index+1}.`);
  return parsed.data;
 });
 if(!drafts.length||drafts.length>200)throw new Error('أضف من ١ إلى ٢٠٠ سطر بيع في الملف.');
 if(new Set(drafts.map(draft=>draft.code)).size!==drafts.length)throw new Error('أكواد البيع في الملف يجب أن تكون مختلفة.');
 return drafts;
}
