import Collection,{syncStatusOptions} from './Collection';
import {OperationStatus,reviewFirst} from './OperationStatus';
import type {View} from './store';
import type {ReactNode} from 'react';

export type SyncRecord={id:string;name:string;module:string;view:View;status:keyof typeof import('./OperationStatus').operationLabels;createdAt:string;locationId?:string;error?:string;reference?:boolean};
export default function SyncList({records,locations,open,details}:{records:SyncRecord[];locations:{id:string;name:string}[];open:(row:SyncRecord)=>void;details?:(row:SyncRecord)=>ReactNode}){
 const stamp=(value:string)=>new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Cairo'}).format(new Date(value));
 return <section className="panel"><div className="panel-heading"><div><h2>كل العمليات على هذا الجهاز</h2><p>ابحث في جميع الأقسام وراجع ما يحتاج إلى انتباهك. تعرض هذه القائمة سجلات هذا الجهاز؛ المستندات المقبولة متاحة في أقسامها.</p></div><span className="pill">{new Intl.NumberFormat('ar-EG').format(records.length)} عملية</span></div>
 <Collection rows={reviewFirst([...records].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)))} title="عمليات المزامنة" searchText={row=>row.name+' '+row.id} dateValue={row=>row.createdAt} filters={[{key:'status',label:'حالة المزامنة',value:row=>row.status,options:syncStatusOptions},{key:'module',label:'القسم',value:row=>row.module,options:[...new Set(records.map(row=>row.module))].map(value=>({value,label:value}))},{key:'location',label:'الموقع',value:row=>row.locationId??'organization',options:[{value:'organization',label:'إعدادات المؤسسة'},...locations.map(row=>({value:row.id,label:row.name}))]}]} rowIds={row=>[row.id]}>
 {pageRows=><div className="table-scroll"><table><thead><tr><th>العملية / المرجع</th><th>القسم / الموقع</th><th>الحالة</th><th>وقت الحفظ</th><th>الإجراء</th></tr></thead><tbody>{pageRows.map(row=><tr key={row.id} id={`operation-${row.id}`} tabIndex={-1}><td><strong>{row.name}</strong><small className="setup-subline" dir="ltr">{row.id.slice(0,8)}</small>{row.error&&<p className="error">{row.error}</p>}{details?.(row)}</td><td>{row.module}<small className="setup-subline">{locations.find(location=>location.id===row.locationId)?.name??'المؤسسة'}</small></td><td><OperationStatus status={row.status}/></td><td>{stamp(row.createdAt)}</td><td><button type="button" className="secondary" onClick={()=>open(row)}>فتح ومراجعة</button></td></tr>)}</tbody></table></div>}
 </Collection></section>;
}
