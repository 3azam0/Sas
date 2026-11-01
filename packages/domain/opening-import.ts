import {quantitySchema,type Item} from '@saas/contracts';
export const normalizeNumber=(value:string)=>value.trim().replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/٫/g,'.');
export type CSVMapping={sku:number;quantity:number;unitCost:number;unit:number};
export function parseOpeningCSV(text:string):string[][]{
 if(new TextEncoder().encode(text).length>1024*1024)throw new Error('الملف يتجاوز ١ ميجابايت.');
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;
 function cell(){row.push(field.trim());field='';closed=false;}
 function end(){cell();if(row.some(v=>v!==''))rows.push(row);row=[];if(rows.length>201)throw new Error('الحد الأقصى ٢٠٠ سطر بيانات.');}
 const source=text.replace(/^\uFEFF/,'');
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(quoted){if(c==='"'){if(source[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c===','){cell();continue;}
  if(c==='\n'||c==='\r'){if(c==='\r'&&source[i+1]==='\n')i++;end();continue;}
  if(c==='"'){if(field||closed)throw new Error('تنسيق علامات الاقتباس في CSV غير صالح.');quoted=true;continue;}
  if(closed&&!/\s/.test(c))throw new Error('تنسيق CSV غير صالح بعد علامة الاقتباس.');
  field+=c;
 }
 if(quoted)throw new Error('علامة اقتباس غير مغلقة في CSV.');
 if(field||row.length)end();
 if(rows.length<2)throw new Error('أضف عنوان الأعمدة وسطر بيانات واحداً على الأقل.');
 if(new Set(rows[0]).size!==rows[0].length||rows[0].some(v=>!v))throw new Error('عناوين الأعمدة يجب أن تكون غير فارغة ومختلفة.');
 return rows;
}
export function mapOpeningCSV(rows:string[][],mapping:CSVMapping,items:Item[]){
 const used=new Set<string>();const errors:string[]=[];
 if([mapping.sku,mapping.quantity,mapping.unitCost].some(v=>!Number.isInteger(v)||v<0||v>=rows[0].length)||new Set([mapping.sku,mapping.quantity,mapping.unitCost]).size!==3||mapping.unit>=rows[0].length||mapping.unit< -1||!Number.isInteger(mapping.unit)||[mapping.sku,mapping.quantity,mapping.unitCost].includes(mapping.unit))throw new Error('اختر عموداً مختلفاً لكل حقل.');
 const lines:{itemId:string;unitId:string;quantity:string;unitCost:string}[]=[];
 for(const [index,row] of rows.slice(1).entries()){
  const prefix=`السطر ${index+2}: `;
  if(row.length!==rows[0].length){errors.push(prefix+'عدد الأعمدة غير مطابق.');continue;}
  const item=items.find(i=>i.sku.toUpperCase()===row[mapping.sku].toUpperCase());
  if(!item||item.active===false){errors.push(prefix+'كود المادة غير متاح أو غير نشط.');continue;}
  if(used.has(item.id)){errors.push(prefix+'المادة مكررة.');continue;}used.add(item.id);
  const quantity=normalizeNumber(row[mapping.quantity]),unitCost=normalizeNumber(row[mapping.unitCost]);
  if(!quantitySchema.safeParse(quantity).success||!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(unitCost)){errors.push(prefix+'الكمية موجبة والتكلفة غير سالبة، حتى ٦ منازل عشرية.');continue;}
  if(mapping.unit>=0&&row[mapping.unit]!==item.unit){errors.push(prefix+`الوحدة يجب أن تكون ${item.unit}.`);continue;}
  lines.push({itemId:item.id,unitId:item.unitId??item.unit,quantity,unitCost});
 }
 return {lines,errors};
}
