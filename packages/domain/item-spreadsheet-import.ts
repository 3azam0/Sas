import {normalizeNumber} from './opening-import';

type Unit={id:string;name:string};
type ExistingItem={name:string};
export type ImportedItem={name:string;category:string;unitId:string;unitName:string;minimum:string;sourceRow:number};
const key=(value:string)=>value.trim().toLocaleLowerCase().replace(/[\s_-]+/g,'');
const aliases={
 name:['name','item','itemname','اسم','المادة','اسمالمادة'],
 category:['category','group','الفئة','التصنيف'],
 unit:['unit','stockunit','الوحدة','وحدةالمخزون'],
 minimum:['minimum','minimumstock','min','الحد','الحدالأدنى','حدالتنبيه']
} as const;

export function mapItemSpreadsheet(rows:string[][],units:Unit[],existing:ExistingItem[]){
 const header=rows[0].map(key),index=(field:keyof typeof aliases)=>header.findIndex(value=>(aliases[field] as readonly string[]).includes(value));
 const columns={name:index('name'),category:index('category'),unit:index('unit'),minimum:index('minimum')};
 if(columns.name<0||columns.unit<0)throw new Error('يجب أن يحتوي الملف على عمودي «المادة» و«الوحدة».');
 const errors:string[]=[],items:ImportedItem[]=[],names=new Set(existing.map(item=>key(item.name)));
 for(const [offset,row] of rows.slice(1).entries()){
  const sourceRow=offset+2,prefix=`السطر ${sourceRow}: `;if(row.every(value=>!value.trim()))continue;
  const name=row[columns.name]?.trim()??'',category=columns.category>=0?row[columns.category]?.trim()||'مواد غذائية':'مواد غذائية',unitText=row[columns.unit]?.trim()??'',minimum=normalizeNumber(columns.minimum>=0?row[columns.minimum]?.trim()||'0':'0');
  const unit=units.find(value=>key(value.name)===key(unitText)||key(value.id)===key(unitText));
  if(name.length<2||name.length>100){errors.push(prefix+'اسم المادة يجب أن يكون من حرفين إلى ١٠٠ حرف.');continue;}
  if(category.length<2||category.length>100){errors.push(prefix+'الفئة يجب أن تكون من حرفين إلى ١٠٠ حرف.');continue;}
  if(!unit){errors.push(prefix+`وحدة المخزون «${unitText||'فارغة'}» غير موجودة.`);continue;}
  if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(minimum)){errors.push(prefix+'حد التنبيه يجب أن يكون صفراً أو رقماً موجباً حتى ٦ منازل عشرية.');continue;}
  const normalized=key(name);if(names.has(normalized)){errors.push(prefix+'اسم المادة مكرر في الملف أو موجود مسبقاً.');continue;}names.add(normalized);
  items.push({name,category,unitId:unit.id,unitName:unit.name,minimum,sourceRow});
 }
 if(!items.length&&!errors.length)errors.push('لا توجد صفوف مواد داخل الملف.');
 return {items,errors};
}
