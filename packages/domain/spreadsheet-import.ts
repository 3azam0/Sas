import {strFromU8,unzipSync} from 'fflate';
import {parseOpeningCSV} from './opening-import';

const xmlText=(value:string)=>value.replace(/<[^>]+>/g,'').replace(/&#(x?[0-9a-f]+);|&(amp|lt|gt|quot|apos);/gi,(_all,named:number|string,entity:string)=>{
 if(named){const text=String(named),code=text[0].toLowerCase()==='x'?Number.parseInt(text.slice(1),16):Number.parseInt(text,10);return Number.isFinite(code)?String.fromCodePoint(code):'';}
 return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[entity.toLowerCase()]??'';
});
const attribute=(source:string,name:string)=>new RegExp(`\\b${name}="([^"]*)"`).exec(source)?.[1]??'';
const columnIndex=(reference:string)=>{const letters=/^[A-Z]+/i.exec(reference)?.[0]?.toUpperCase()??'';let value=0;for(const letter of letters)value=value*26+letter.charCodeAt(0)-64;return Math.max(0,value-1);};
const cellText=(body:string,type:string,shared:string[])=>{
 const raw=/<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1]??'';
 if(type==='s')return shared[Number(raw)]??'';
 if(type==='inlineStr')return [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(match=>xmlText(match[1])).join('');
 if(type==='str')return xmlText(raw);
 return xmlText(raw);
};

/** Read the first worksheet from a modern .xlsx file without executing formulas or macros. */
export function parseXLSX(bytes:Uint8Array):string[][]{
 if(bytes.byteLength>5*1024*1024)throw new Error('ملف Excel يتجاوز ٥ ميجابايت.');
 let archive:ReturnType<typeof unzipSync>;try{archive=unzipSync(bytes);}catch{throw new Error('ملف Excel غير صالح أو تالف.');}
 const sheetFile=Object.keys(archive).filter(path=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(path)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))[0];
 if(!sheetFile)throw new Error('لم يتم العثور على ورقة عمل داخل ملف Excel.');
 const sharedFile=archive['xl/sharedStrings.xml'];
 const shared=sharedFile?[...strFromU8(sharedFile).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match=>[...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(part=>xmlText(part[1])).join('')):[];
 const rows:string[][]=[];
 for(const rowMatch of strFromU8(archive[sheetFile]).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
  const row:string[]=[];let fallback=0;
  for(const cell of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g)){
   const attrs=cell[1]??cell[3]??'',index=attribute(attrs,'r')?columnIndex(attribute(attrs,'r')):fallback;
   if(index>99)throw new Error('يدعم الاستيراد حتى ١٠٠ عمود.');
   while(row.length<index)row.push('');row[index]=cellText(cell[2]??'',attribute(attrs,'t'),shared).trim();fallback=index+1;
  }
  while(row.length&&row.at(-1)==='')row.pop();if(row.some(value=>value!==''))rows.push(row);
  if(rows.length>201)throw new Error('الحد الأقصى ٢٠٠ سطر بيانات.');
 }
 if(rows.length<2)throw new Error('أضف عنوان الأعمدة وسطر بيانات واحداً على الأقل.');
 const width=rows[0].length;if(!width||new Set(rows[0]).size!==width||rows[0].some(value=>!value))throw new Error('عناوين الأعمدة يجب أن تكون غير فارغة ومختلفة.');
 return rows.map(row=>{while(row.length<width)row.push('');return row;});
}

export function parseSpreadsheet(bytes:ArrayBuffer,fileName:string):string[][]{
 const lower=fileName.toLowerCase();
 if(lower.endsWith('.csv'))return parseOpeningCSV(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(lower.endsWith('.xlsx'))return parseXLSX(new Uint8Array(bytes));
 if(lower.endsWith('.xls'))throw new Error('صيغة XLS القديمة غير مدعومة. احفظ الملف بصيغة XLSX ثم أعد المحاولة.');
 throw new Error('اختر ملف Excel بصيغة XLSX أو ملف CSV بترميز UTF-8.');
}
