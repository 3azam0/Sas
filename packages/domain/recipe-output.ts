import type {RecipeDefinition} from '../contracts';
import {decimal} from './index';
const measure=(name:string)=>{const n=name.trim().toLowerCase().replace(/\s/g,'');if(['kg','كجم','كيلو','كيلوجرام','كيلوغرام'].includes(n))return {dimension:'mass',factor:'1000'};if(['g','جم','جرام','غرام'].includes(n))return {dimension:'mass',factor:'1'};if(['l','لتر'].includes(n))return {dimension:'volume',factor:'1000'};if(['ml','مل','ملليلتر'].includes(n))return {dimension:'volume',factor:'1'};return null;};
/** Sum canonical ingredient quantities once, including sub-recipe quantities in their output units. */
export function ingredientOutput(lines:RecipeDefinition['lines'],outputUnitId:string,units:{id:string;name:string}[]):{quantity:string|null;message:string}{
 const output=measure(units.find(u=>u.id===outputUnitId)?.name??'');
 if(!output)return {quantity:null,message:'اختر وحدة وزن أو حجم لحساب الناتج تلقائياً، أو أدخل الناتج يدوياً للحصص والقطع.'};
 if(!lines.length)return {quantity:null,message:'أضف المكونات وكمياتها لحساب ناتج الدفعة.'};
 let total=decimal('0');for(const line of lines){const unit=measure(units.find(u=>u.id===line.unitId)?.name??'');if(!unit||unit.dimension!==output.dimension)return {quantity:null,message:'لا يمكن جمع وحدات مختلفة مثل الكجم واللتر والقطع؛ راجع الوحدات أو أدخل الناتج يدوياً.'};if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(line.quantity)||!decimal(line.quantity).gt(0))return {quantity:null,message:'أكمل كميات جميع المكونات لحساب الناتج بالكامل.'};total=total.add(decimal(line.quantity).mul(unit.factor).div(output.factor));}
 if(total.decimalPlaces()>6||total.gt('999999999'))return {quantity:null,message:'الناتج خارج دقة الكمية المتاحة؛ اختر وحدة أخرى أو أدخله يدوياً.'};
 return {quantity:total.toString(),message:'مجموع المكونات بالكامل بعد تحويل الوحدات؛ يمكنك تعديل الناتج الفعلي عند وجود فاقد.'};
}
