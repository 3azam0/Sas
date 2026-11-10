import {zipSync,strToU8} from 'fflate';
import Decimal from 'decimal.js';
export type ExportRows=unknown[][];
const xml=(v:unknown)=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
export const normalizeExportNumber=(v:string)=>v.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٬,\u200e\u200f\u061c]/g,'').replace(/٫/g,'.').trim();
export function exportHeader(row:unknown[]){return row.length>=3&&/^(التاريخ|المادة|الوصفة|الموقع|المسار|التحويل|رقم الدفعة|المنتج|الصنف|البند)$/.test(String(row[0]??''))&&row.every(v=>typeof v==='string');}
function column(i:number){let name='';for(i++;i;i=Math.floor((i-1)/26))name=String.fromCharCode(65+(i-1)%26)+name;return name;}
function excelDigits(value:string){
 const [whole,fraction='']=value.replace(/^-/, '').split('.');
 return (whole+fraction.replace(/0+$/,'')).replace(/^0+/,'').length;
}
function valueCell(value:unknown,header:string){
 if(value===null||value===undefined||value==='')return {type:'blank',value:''};
 const text=String(value);
 const money=/ج\.م|جنيه|سعر|تكلفة|قيمة|مبلغ|نقداً|^الباقي$|^الإجمالي$|^صافي (?:المبيعات|المصروفات|التوريد)/.test(header);
 const number=normalizeExportNumber(money?text.replace(/\s*ج\.م\s*$/,''):text);
 const identifier=!money&&/(رقم|كود|معرف|مرجع|الأصل|التشغيلة)/.test(header);
 if(!identifier&&/(تاريخ|^الإنتاج$|^الصلاحية$)/.test(header)&&/^\d{4}-\d{2}-\d{2}$/.test(text))return {type:'date',value:String((Date.parse(text+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000)};
 const numeric=money||typeof value==='number'||!identifier&&/(كمية|الكمية|تكلفة|التكلفة|قيمة|القيمة|رصيد|الرصيد|الحد|احتياج|المطلوب|المخصوم|النقص|فرق|الفرق|الوارد|الصادر|وزن|رؤوس|الرؤوس|دفعات|الدفعات|المخطط|المتبقي|هالك|الهالك|المردود|نسبة|العمر|مرسل|مستلم|فاقد|اقتراح|متوسط|سعر|الخصم|فعلي|نظري|إنتاج|منجز|مخطط|التحويلات|الجرد|التجهيز|مدخل|ناتج|الناتج|صافي|معلقة|للمراجعة|في الطريق|شراء مفتوح|مسودات|إجمالي|الباقي|معامل)/.test(header);
 if(numeric&&/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(number)&&Number.isFinite(Number(number))){
  // Excel stores 15 digits. Use displayed cents for prices only when the exact value cannot fit.
  const fitted=money&&excelDigits(number)>15?new Decimal(number).toFixed(2):number;
  if(excelDigits(fitted)<=15)return {type:'number',value:fitted,money};
 }
 return {type:'text',value:text};
}
/** A real OOXML workbook. User text always uses inline strings, never formulas. */
export function exportWorkbook(title:string,rows:ExportRows){
 if(rows.length>15000||rows.some(r=>r.length>100))throw Error('الملف كبير جداً؛ ضيّق نطاق التصدير.');
 const first=rows.findIndex(exportHeader),metadata=first>0?rows.slice(0,first):[];if(first>0)rows=rows.slice(first);
 function sheetXml(sheetRows:ExportRows){
 let headers:string[]=[],firstHeader=0;const width=Math.max(1,...sheetRows.map(r=>r.length));
 const body=sheetRows.map((row,r)=>{const heading=exportHeader(row);if(heading){headers=row.map(String);if(!firstHeader)firstHeader=r+1;}return `<row r="${r+1}"${heading?' ht="32" customHeight="1"':''}>${row.map((v,c)=>{const cell=valueCell(v,row.length===2&&c===1?String(row[0]):headers[c]??''),ref=column(c)+(r+1),style=heading?1:cell.type==='number'?(cell.money?4:2):cell.type==='date'?3:0;if(cell.type==='blank')return `<c r="${ref}" s="${style}"/>`;return cell.type==='number'||cell.type==='date'?`<c r="${ref}" s="${style}"><v>${cell.value}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(cell.value)}</t></is></c>`;}).join('')}</row>`;}).join('');
 return {body,firstHeader,width};
 }
 const {body,firstHeader,width}=sheetXml(rows);
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',sheetName=title.replace(/[\\/?*\[\]:]/g,' ').slice(0,31)||'FooDo';
 const files:Record<string,string>={
 '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
 '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="${xml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
 'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
 'xl/styles.xml':`<styleSheet xmlns="${ns}"><numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.######;[Red](#,##0.######);0"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/><numFmt numFmtId="166" formatCode="#,##0.00;[Red](#,##0.00);0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF18334E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5"><xf fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1" readingOrder="2"/></xf><xf fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1" readingOrder="2"/></xf><xf fontId="0" numFmtId="164" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf fontId="0" numFmtId="165" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf fontId="0" numFmtId="166" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
 'xl/worksheets/sheet1.xml':`<worksheet xmlns="${ns}"><dimension ref="A1:${column(width-1)}${Math.max(1,rows.length)}"/><sheetViews><sheetView workbookViewId="0" rightToLeft="1">${firstHeader?`<pane ySplit="${firstHeader}" topLeftCell="A${firstHeader+1}" activePane="bottomLeft" state="frozen"/>`:''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="22"/><cols>${Array.from({length:width},(_,c)=>`<col min="${c+1}" max="${c+1}" width="${c===0?30:22}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData><printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`
 };
 if(metadata.length){
  const name=sheetName==='ملخص المستند'?'سياق التصدير':'ملخص المستند',context=sheetXml(metadata);
  files['[Content_Types].xml']=files['[Content_Types].xml'].replace('</Types>','<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  files['xl/workbook.xml']=files['xl/workbook.xml'].replace('</sheets>','<sheet name="'+xml(name)+'" sheetId="2" r:id="rId3"/></sheets>');
  files['xl/_rels/workbook.xml.rels']=files['xl/_rels/workbook.xml.rels'].replace('</Relationships>','<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>');
  files['xl/worksheets/sheet2.xml']='<worksheet xmlns="'+ns+'"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols><col min="1" max="1" width="42" customWidth="1"/><col min="2" max="'+Math.max(2,context.width)+'" width="36" customWidth="1"/></cols><sheetData>'+context.body+'</sheetData></worksheet>';
 }
 return zipSync(Object.fromEntries(Object.entries(files).map(([path,body])=>[path,strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+body)])),{level:6});
}
