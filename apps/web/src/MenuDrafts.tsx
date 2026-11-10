'use client';

import {formatMoney} from './money-format';
import {useState} from 'react';
import {menuDraftImportSchema,type MenuDraft,type MenuDraftRow,type PointOfSale,type Snapshot} from '@saas/contracts';
import {parseMenuDrafts} from '../../../packages/domain/menu-drafts';
import CollapsibleSection from './CollapsibleSection';
import Collection from './Collection';

type Props={
 snapshot:Snapshot;
 terminal?:PointOfSale;
 disabled:boolean;
 synchronize:()=>Promise<void>;
 link:(draft:MenuDraft)=>void;
};


export default function MenuDrafts({snapshot,terminal,disabled,synchronize,link}:Props){
 const [selected,setSelected]=useState<{name:string;rows:MenuDraftRow[]}|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const drafts=(snapshot.menuDrafts??[]).filter(draft=>
  (!terminal||(draft.source===terminal.source&&draft.kitchenId===terminal.kitchenId))&&
  !snapshot.menuItems?.some(item=>item.source===draft.source&&item.code===draft.code));
 const canLink=!!snapshot.recipeVersions?.length;

 async function choose(file?:File){
  setError('');setNotice('');setSelected(null);
  if(!file)return;
  if(file.size>1024*1024){setError('ملف المنيو يتجاوز ١ ميجابايت.');return;}
  setBusy(true);
  try{setSelected({name:file.name,rows:parseMenuDrafts(await file.arrayBuffer(),file.name)});}
  catch(e){setError(e instanceof Error?e.message:'تعذرت قراءة الملف.');}
  finally{setBusy(false);}
 }

 async function upload(){
  if(!selected||!terminal||disabled||busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const command=menuDraftImportSchema.parse({
    type:'menu.drafts.import',organizationId:snapshot.organizationId,generation:snapshot.generation,
    operationId:crypto.randomUUID(),posId:terminal.id,posRevision:terminal.revision,rows:selected.rows,
   });
   const response=await fetch('/api/v1/menu',{
    method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':command.generation},
    body:JSON.stringify(command),
   });
   const result=await response.json();
   if(!response.ok)throw new Error(result.message??'تعذر استيراد المسودات.');
   setSelected(null);
   setNotice(`حُفظ ${result.imported} سطر جديد. ${result.skipped} سطر موجود بالفعل.`);
   await synchronize();
  }catch(e){setError(e instanceof Error?e.message:'تعذر استيراد المسودات.');}
  finally{setBusy(false);}
 }

 return <CollapsibleSection className="panel">
  <div className="panel-heading">
   <div><h2>{terminal?`مسودات منيو ${terminal.name}`:'مسودات المنيو'} <span className="heading-count">{drafts.length}</span></h2>
    <p>تظهر المسودات للمراجعة. اربط الوصفة والكمية ثم فعّل الصنف لعرضه في الكاشير.</p>
   </div>
  </div>
  <div className="sales-tabs">
   {terminal?<label>ملف مسودات المنيو
    <input type="file" accept=".xlsx,.csv" aria-label="ملف مسودات المنيو" disabled={disabled||busy}
     onChange={event=>{void choose(event.currentTarget.files?.[0]);event.currentTarget.value='';}}/>
   </label>:<p>اختر منيو نقطة البيع بالأعلى لتحديد مطبخ الملف.</p>}
   {selected&&<div>
    <p>{selected.name} · {selected.rows.length} سطر إلى منيو {terminal?.name}</p>
    <button type="button" className="primary" disabled={disabled||busy} onClick={()=>void upload()}>استيراد المسودات</button>
   </div>}
  </div>
  {error&&<p role="alert" className="error recipe-explanation">{error}</p>}
  {notice&&<p role="status" className="recipe-explanation">{notice}</p>}
  <Collection rows={drafts} title="مسودات المنيو" emptyText="لا توجد مسودات في القائمة."
   searchText={draft=>`${draft.code} ${draft.name} ${draft.category} ${draft.portion}`}>
   {page=><div className="table-scroll"><table aria-label="مسودات المنيو"><thead>
    <tr><th>الصنف</th><th>الكود</th><th>الفئة</th><th>الحجم</th><th>سعر البيع</th><th>المطبخ</th><th>الإجراء</th></tr>
   </thead><tbody>{page.map(draft=><tr key={draft.source+':'+draft.code}>
    <td><strong>{draft.name}</strong>{draft.note&&<small className="setup-subline">{draft.note}</small>}</td>
    <td dir="ltr">{draft.code}</td><td>{draft.category}</td><td>{draft.portion}</td>
    <td>{formatMoney(draft.sellingPrice)} ج.م</td>
    <td>{snapshot.kitchens?.find(kitchen=>kitchen.id===draft.kitchenId)?.name??draft.kitchenId}</td>
    <td><button className="text-button" type="button" disabled={disabled||!canLink} onClick={()=>link(draft)}>ربط الوصفة</button></td>
   </tr>)}</tbody></table></div>}
  </Collection>
 </CollapsibleSection>;
}
