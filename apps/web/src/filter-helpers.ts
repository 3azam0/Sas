import {decimal} from '@saas/domain';
import {egyptDate} from '../../../packages/domain/reporting';
export type DatePreset='today'|'week'|'month'|'thirty';
export function presetRange(preset:DatePreset,today=egyptDate()){
 const days=preset==='today'?1:preset==='week'?7:30;
 return {from:preset==='month'?today.slice(0,8)+'01':new Date(Date.parse(today+'T12:00:00Z')-(days-1)*86400000).toISOString().slice(0,10),to:today};
}
export function stockStatus(quantity:string,minimum:string,active=true){
 if(!active)return {label:'غير نشط',tone:'neutral'};
 if(decimal(quantity).eq(0))return {label:'رصيد صفر',tone:'warning'};
 if(decimal(quantity).lt(minimum))return {label:'تحت الحد الأدنى',tone:'warning'};
 return {label:'متوفر',tone:'good'};
}
export function matchesStockFilter(filter:string,quantity:string,minimum:string,active=true){
 if(filter==='zero')return decimal(quantity).eq(0);
 if(filter==='available')return active&&decimal(quantity).gt(0);
 if(filter==='low')return active&&decimal(quantity).lt(minimum);
 if(filter==='inactive')return !active;
 return true;
}
export const stockFilterOptions=[{value:'all',label:'كل المواد'},{value:'available',label:'متوفر برصيد'},{value:'zero',label:'رصيد صفر'},{value:'low',label:'تحت الحد الأدنى'},{value:'inactive',label:'غير نشط'}];
