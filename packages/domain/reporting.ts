import type {ReportFilters} from '@saas/contracts';

export function egyptDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function previousReportRange(from:string,to:string){const days=(Date.parse(to)-Date.parse(from))/86400000+1;return {from:new Date(Date.parse(from)-days*86400000).toISOString().slice(0,10),to:new Date(Date.parse(from)-86400000).toISOString().slice(0,10)};}
export function initialReportFilters(now=new Date()):ReportFilters{const today=egyptDate(now);return {kind:'inventory',from:today.slice(0,8)+'01',to:today,locationId:'',category:'',itemId:'',supplierId:'',kitchenId:'',posId:'',search:'',sort:'amount_desc',page:1,pageSize:25};}
/** Neutralize spreadsheet formulas without losing signed numeric quantities. */
export function reportCsv(rows:unknown[][]){const cell=(v:unknown)=>{let text=String(v??'');if(/^[\s]*[=+@-]/.test(text)&&!/^-[0-9]+(?:\.[0-9]+)?$/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};return '\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n');}
