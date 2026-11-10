'use client';
import {forwardRef,useState,type InputHTMLAttributes} from 'react';
import {decimal} from '@saas/domain';
import {normalizeNumber} from '../../../packages/domain/opening-import';
import {FormInput} from './FormControls';
export function quantityUnits(base:string,packs:{id:string;name:string;factor:string}[]=[]){
 const n=base.trim().toLowerCase().replace(/\s/g,'');const gram=['g','جم','جرام','غرام'].includes(n),kg=['kg','كجم','كيلو','كيلوجرام','كيلوغرام'].includes(n),ml=['ml','مل','ملليلتر'].includes(n),litre=['l','لتر'].includes(n);
 return [{id:'base',name:base||'وحدة المخزون',factor:'1'},...(gram?[{id:'kg',name:'كجم',factor:'1000'}]:kg?[{id:'g',name:'جرام',factor:'0.001'}]:ml?[{id:'l',name:'لتر',factor:'1000'}]:litre?[{id:'ml',name:'مل',factor:'0.001'}]:[]),...packs.filter(p=>/^(?:[1-9]\d*|0)(?:\.\d+)?$/.test(p.factor)&&decimal(p.factor).gt(0)).map(p=>({...p,id:'pack:'+p.id}))];
}
export function quantityInBase(input:string,factor:string){if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(input))return '';const value=decimal(input).mul(factor);return value.decimalPlaces()<=6&&value.lte('999999999.999999')?value.toString():'';}
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'> & {value:string;unitName:string;packs?:{id:string;name:string;factor:string}[];onValue:(value:string)=>void;validateAs?:'positive'|'nonnegative';unitLabel?:string;onUnitChange?:(id:string)=>void};
/** Values passed to business forms always stay in the item's canonical stock unit. */
const UnitQuantityInput=forwardRef<HTMLInputElement,Props>(function UnitQuantityInput({value,unitName,packs,onValue,validateAs,unitLabel,onUnitChange,...props},ref){
 const [selection,setSelection]=useState('base'),[invalid,setInvalid]=useState<string|null>(null),[editing,setEditing]=useState<{text:string;canonical:string}|null>(null),options=quantityUnits(unitName,packs),unit=options.find(u=>u.id===selection)??options[0];
 const converted=(()=>{try{return value?decimal(value).div(unit.factor).toDecimalPlaces(6).toString():'';}catch{return '';}})(),display=editing?.canonical===value?editing.text:converted,label=String(props['aria-label']??'الكمية');
 return <span className="quantity-unit-input"><span className="quantity-unit-controls"><FormInput {...props} ref={ref} validateAs={validateAs} value={display} aria-invalid={invalid?true:props['aria-invalid']} onChange={e=>{const input=normalizeNumber(e.target.value);const canonical=quantityInBase(input,unit.factor);setEditing({text:input,canonical});setInvalid(input&&!canonical?'راجع الكمية ودقة التحويل؛ الحد ٦ منازل عشرية لوحدة المخزون.':null);onValue(canonical);}}/><select aria-label={unitLabel??'وحدة إدخال '+label} value={unit.id} disabled={props.disabled} onChange={e=>{setSelection(e.target.value);setEditing(null);setInvalid(null);onUnitChange?.(e.target.value);}}>{options.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></span>{unit.id!=='base'&&<small className="quantity-unit-hint">{value||'—'} {unitName} للمخزون · السعر والتكلفة لكل {unitName}</small>}{invalid&&<small role="alert" className="field-error">{invalid}</small>}</span>;
});
export default UnitQuantityInput;
export function NamedUnitQuantityInput({name,defaultValue='',...props}:Omit<Props,'value'|'onValue'> & {name:string;defaultValue?:string}){const [value,setValue]=useState(defaultValue);return <><input type="hidden" name={name} value={value}/><UnitQuantityInput {...props} value={value} onValue={setValue}/></>;}
