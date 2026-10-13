import CollapsibleSection from './CollapsibleSection';
import type {RecipeDefinition,Snapshot} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {salesStockOptions} from '../../../packages/domain/recipes';

const number=(v:string)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:6}).format(Number(v));
export default function SalesStockSummary({snapshot,recipeId,definition,outputPerSale,onEdit}:{snapshot:Snapshot;recipeId:string;definition:RecipeDefinition;outputPerSale?:string;onEdit?:()=>void}){
 let options:ReturnType<typeof salesStockOptions>;
 try{options=salesStockOptions(recipeId,definition,snapshot.recipeVersions??[]);}catch{return <p className="form-warning">أكمل المكونات والكميات لعرض قواعد خصم المخزون.</p>;}
 const selected=options.filter(r=>definition.salesStockItemIds?.includes(r.itemId)),costOnly=options.filter(r=>!definition.salesStockItemIds?.includes(r.itemId));
 const unit=snapshot.units?.find(u=>u.id===definition.outputUnitId)?.name??'',quantity=outputPerSale??'1';
 return <CollapsibleSection className="stock-rules" aria-label="قواعد خصم المخزون عند البيع">
  <div className="stock-rules-heading"><div><span className="eyebrow">المخزون عند البيع</span><h3>ما الذي سيُخصم؟</h3></div><span className={'pill '+(selected.length?'good':'neutral')}>{selected.length?`${number(String(selected.length))} مواد للخصم`:'حساب التكلفة فقط'}</span>{onEdit&&<button type="button" className="secondary" onClick={onEdit}>تعديل اختيار الخصم</button>}</div>
  <p>{outputPerSale?'لكل وحدة مباعة':'لكل ١ وحدة ناتج'} · {number(quantity)} {unit}. الخصم عند قبول مبيعات جديدة مرتبطة بهذا الإصدار.</p>
  {selected.length?<ul className="stock-rule-list">{selected.map(r=>{const item=snapshot.items.find(i=>i.id===r.itemId);let amount='—';try{amount=number(decimal(r.quantity).div(definition.outputQuantity).mul(quantity).toFixed(6));}catch{}return <li key={r.itemId}><strong>{item?.name??r.itemId}</strong><span>{amount} {item?.unit}</span><span className="stock-rule-label">يُخصم من المخزون</span></li>;})}</ul>:<p className="stock-rules-empty">لن تُخصم مواد عند البيع بهذا الإصدار. كل المكونات تدخل في حساب التكلفة.</p>}
  {!!costOnly.length&&<details className="cost-only-details"><summary>{number(String(costOnly.length))} مواد لحساب التكلفة فقط</summary><div className="stock-cost-chips">{costOnly.map(r=><span key={r.itemId}>{snapshot.items.find(i=>i.id===r.itemId)?.name??r.itemId}</span>)}</div></details>}
  {definition.outputMode==='stocked'&&<p className="field-hint">يُخصم الناتج المخزني عند بيعه إذا كان محددًا؛ مكونات التحضير تُخصم أثناء الإنتاج.</p>}
  {onEdit&&<small>تعديل الاختيار يحتاج نشر إصدار جديد ثم تحديث ربط صنف البيع. المبيعات السابقة تحتفظ بإصدارها.</small>}
 </CollapsibleSection>;
}
