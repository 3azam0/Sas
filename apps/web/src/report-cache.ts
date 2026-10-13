import {reportQuerySchema,type ReportQuery,type ReportResponse,type Snapshot} from '@saas/contracts';
import {local} from './offline';

const prefix=(scope:string)=>'report:v2:'+scope+':';
export function reportKey(query:ReportQuery){return prefix(query.organizationId)+JSON.stringify(reportQuerySchema.parse(query));}
function matches(data:ReportResponse,query:ReportQuery){return data?.schemaVersion===1&&data.organizationId===query.organizationId&&data.generation===query.generation&&reportKey(data.query)===reportKey(query);}
export async function cachedReport(query:ReportQuery){const saved=await local.preferences.get(reportKey(query));if(!saved)return undefined;try{const data=JSON.parse(saved.value) as ReportResponse;return matches(data,query)?data:undefined;}catch{return undefined;}}
export async function cacheReport(data:ReportResponse,query:ReportQuery){
 if(!matches(data,query))throw new Error('التقرير لا يطابق المؤسسة أو الفلاتر المطلوبة.');
 await local.transaction('rw',[local.preferences,local.snapshots],async()=>{
  const snapshot=await local.snapshots.get(query.organizationId);if(snapshot?.generation!==query.generation)throw new Error('تغيرت نسخة بيانات المؤسسة. حدّث التقرير.');
  await local.preferences.put({key:reportKey(query),value:JSON.stringify(data)});
  const saved=await local.preferences.where('key').startsWith(prefix(query.organizationId)).toArray();
  const ranked=saved.map(row=>{try{return {row,data:JSON.parse(row.value) as ReportResponse};}catch{return {row,data:null};}}).sort((a,b)=>(b.data?.generatedAt??'').localeCompare(a.data?.generatedAt??''));
  let kept=0;for(const entry of ranked)if(entry.data?.generation!==query.generation||kept++>=24)await local.preferences.delete(entry.row.key);
 });
}
export async function latestCachedReport(query:ReportQuery){const rows=await local.preferences.where('key').startsWith(prefix(query.organizationId)).toArray();return rows.flatMap(row=>{try{const data=JSON.parse(row.value) as ReportResponse;return data.schemaVersion===1&&data.generation===query.generation&&data.query.kind===query.kind&&data.query.locationId===query.locationId?[data]:[];}catch{return [];}}).sort((a,b)=>b.generatedAt.localeCompare(a.generatedAt))[0];}
export async function fetchReport(snapshot:Snapshot,query:ReportQuery,signal?:AbortSignal){
 const response=await fetch('/api/v1/reports',{method:'POST',headers:{'Content-Type':'application/json','X-Fodo-Generation':snapshot.generation??''},body:JSON.stringify(query),signal});
 const data=await response.json();if(!response.ok)throw new Error(data.message??'تعذر تحميل التقرير. التقرير المحفوظ يبقى متاحاً.');
 await cacheReport(data,query);return data as ReportResponse;
}
