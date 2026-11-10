'use client';

import type {ProductionRecipeSource, Recipe, RecipeDefinition, Snapshot} from '@saas/contracts';
import {quantitySchema} from '@saas/contracts';
import CollapsibleSection from './CollapsibleSection';
import Collection from './Collection';
import {FormInput, matchesSearch} from './FormControls';
import {useState} from 'react';

const key=(value:string)=>value.normalize('NFKC').replace(/[\u064b-\u065fـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ').trim();

export function sourceIngredients(source:ProductionRecipeSource,snapshot:Snapshot):RecipeDefinition['lines']{
 const used=new Set<string>();
 return source.ingredients.map(line=>{
  const stockMatch=line.stockMatch;
  const matches=line.unit?snapshot.items.filter(item=>{
   if(item.active===false)return false;
   if(stockMatch)return item.id===stockMatch.itemId&&item.unitId===stockMatch.unitId&&item.name===stockMatch.itemName;
   const unit=snapshot.units?.find(unit=>unit.id===item.unitId);
   return key(item.name)===key(line.name)&&key(unit?.name??'')===key(line.unit??'');
  }):[];
  const match=matches.length===1&&!used.has(matches[0].id)?matches[0]:undefined;
  const quantity=quantitySchema.safeParse(line.quantity);
  const item=match&&quantity.success&&!(line.unit==='جم'&&Number(quantity.data)<1)?match:undefined;
  if(item)used.add(item.id);
  return {kind:'material',lineId:crypto.randomUUID(),itemId:item?.id??'',unitId:item?.unitId??'',inputUnit:'base',enteredQuantity:item&&quantity.success?quantity.data:'',quantity:item&&quantity.success?quantity.data:''};
 });
}

export function SourceYield({source}:{source:ProductionRecipeSource}){
 if(!source.yield)return <>ناتج الدفعة غير محدد في الملف</>;
 return <>ناتج الملف: <bdi>{source.yield.quantity}</bdi> {source.yield.unit??'· الوحدة غير مذكورة'}</>;
}

export default function ProductionRecipeSources({sources,recipes,pending,readOnly,open}:{sources:ProductionRecipeSource[];recipes:Recipe[];pending:Set<string>;readOnly:boolean;open:(source:ProductionRecipeSource,existing?:Recipe)=>void}){
 const [search,setSearch]=useState(''),[selected,setSelected]=useState('');
 if(!sources.length)return null;
 const filtered=sources.filter(source=>matchesSearch(`${source.name} ${source.code} ${source.kitchen}`,search));
 return <CollapsibleSection className="panel" defaultOpen={false}>
  <div className="panel-heading"><div><h2>وصفات التحضير المستوردة</h2><p>مسودات المصدر · المطبخ القبلي · {sources.length} وصفة</p></div></div>
  <p>راجع مواد المخزون وناتج الدفعة قبل حفظ وصفة تشغيلية. مسودات المصدر لا تظهر عند فتح دفعة إنتاج.</p>
  <label><span className="form-label">بحث الوصفات المستوردة</span><FormInput value={search} onChange={event=>setSearch(event.target.value)}/></label>
  <Collection rows={filtered} title="وصفات التحضير المستوردة" sortText={source=>source.name} pageResetKey={search}>{page=>page.map(source=>{
   const existing=recipes.find(recipe=>recipe.definition.code===source.code);
   return <div className="recipe-list-row" key={source.code}>
    <button type="button" className="text-button" aria-expanded={selected===source.code} onClick={()=>setSelected(selected===source.code?'':source.code)}><strong>{source.name}</strong><small>{source.workbook} · صف {source.sourceRow} · {source.ingredients.length} مكون</small></button>
    <span className={'pill '+(existing?'good':'warning')}>{existing?(existing.state==='published'?'منشورة':'مسودة وصفة'):pending.has(source.code)?'قيد المزامنة':'تحتاج مراجعة'}</span>
    {selected===source.code&&<div className="recipe-explanation">
     <p><SourceYield source={source}/></p>
     <ul>{source.ingredients.map(line=><li key={line.row}>{line.name} · <bdi>{line.quantity??'الكمية غير مذكورة'}</bdi> {line.unit??'· الوحدة غير مذكورة'}{line.stockMatch&&<small> · مطابقة الاستيراد: {line.stockMatch.itemName}</small>}</li>)}</ul>
     {source.notes.length>0&&<ul>{source.notes.map((note,index)=><li key={`${note.row}-${index}`}>صف {note.row}: {note.text}</li>)}</ul>}
     <button type="button" className="secondary" disabled={!existing&&(readOnly||pending.has(source.code))} onClick={()=>open(source,existing)}>{existing?'فتح الوصفة':'إعداد مسودة وصفة'}</button>
    </div>}
   </div>;
  })}</Collection>
 </CollapsibleSection>;
}
