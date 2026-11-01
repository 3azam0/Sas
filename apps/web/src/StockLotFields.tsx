'use client';
import {useId,useRef,useState} from 'react';
import {stockLotSchema,type StockLot} from '../../../packages/contracts/inventory-operations';
/** A separate dialog keeps lot controls usable inside compact horizontal document rows. */
export default function StockLotFields({value,onChange,disabled=false,label='التشغيلة'}:{value?:StockLot;onChange:(value:StockLot|undefined)=>void;disabled?:boolean;label?:string}){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),title=useId(),[error,setError]=useState('');
 const change=(key:keyof StockLot,text:string)=>{setError('');const next={code:value?.code??'',...value,[key]:text||undefined};if(!next.code&&!next.expiresOn&&!next.manufacturedOn)onChange(undefined);else onChange({...next,code:next.code??''});};
 function close(){dialog.current?.close();requestAnimationFrame(()=>trigger.current?.focus());}
 function finish(){if(value&&!stockLotSchema.safeParse(value).success){setError('أدخل رقم التشغيلة وتواريخ صحيحة؛ الصلاحية لا تسبق تاريخ الإنتاج.');return;}close();}
 return <div className="stock-lot-fields"><button ref={trigger} type="button" className="text-button" disabled={disabled} onClick={()=>{setError('');dialog.current?.showModal();dialog.current?.querySelector<HTMLInputElement>('input')?.focus();}}>بيانات {label}{value?.code?' · '+value.code:' · اختياري'}</button>{value?.expiresOn&&<small>الصلاحية: {value.expiresOn}</small>}
 <dialog ref={dialog} className="stock-lot-dialog" aria-labelledby={title} onCancel={e=>{e.preventDefault();e.stopPropagation();close();}} onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();if(e.ctrlKey||e.metaKey)finish();}}}>
 <h3 id={title}>بيانات {label}</h3><p>البيانات تخص سطر المستند الحالي؛ لا تُرحّل مخزوناً.</p><div className="follow-up-controls"><label>رقم التشغيلة<input aria-label={label+' رقم'} maxLength={80} disabled={disabled} value={value?.code??''} onChange={e=>change('code',e.target.value)}/></label><label>تاريخ الإنتاج<input type="date" aria-label={label+' إنتاج'} disabled={disabled} value={value?.manufacturedOn??''} onChange={e=>change('manufacturedOn',e.target.value)}/></label><label>تاريخ الصلاحية<input type="date" aria-label={label+' صلاحية'} disabled={disabled} min={value?.manufacturedOn} value={value?.expiresOn??''} onChange={e=>change('expiresOn',e.target.value)}/></label></div><p>أدخل الرقم عند تسجيل الصلاحية. الصلاحية تنبيه تشغيلي؛ سياسة تقييم المخزون لا تتغير.</p>{error&&<p role="alert" className="error">{error}</p>}<div className="heading-actions"><button className="primary" type="button" onClick={finish}>حفظ بيانات التشغيلة</button><button className="secondary" type="button" onClick={close}>إغلاق بيانات التشغيلة</button></div>
 </dialog></div>;
}
