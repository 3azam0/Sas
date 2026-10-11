'use client';
export const operationLabels={pending:'محفوظ محلياً',acceptedAwaiting:'انتظار تأكيد الخادم',accepted:'مقبول',needsReview:'تحتاج مراجعة',cancelled:'ملغى محلياً',superseded:'تم التصحيح'};
export function OperationStatus({status}:{status:keyof typeof operationLabels}){return <span className={`pill operation-status state-${status}`}>{operationLabels[status]}</span>;}
export function reviewFirst<T extends {status:string}>(rows:T[]){return [...rows].sort((a,b)=>Number(b.status==='needsReview')-Number(a.status==='needsReview'));}
export function DocumentLink({id,view,location,label,available=true}:{id:string;view:string;location?:string;label?:string;available?:boolean}){
 if(!available)return <bdi>{label??id.slice(0,8)}</bdi>;
 return <button className="document-link" type="button" onClick={()=>window.dispatchEvent(new CustomEvent('fodo:document-reference',{detail:{id,view,location}}))}>{label??id.slice(0,8)}</button>;
}
