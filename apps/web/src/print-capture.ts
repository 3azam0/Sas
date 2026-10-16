import type {PrintPaper,PrintOrientation} from './printing';
import type {PrintPage} from './print-bridge';
export type PrintBlock={top:number;bottom:number};
/** Prefer a complete row/chart over cutting through it; oversized blocks still make progress. */
export function printSliceEnd(start:number,maximum:number,end:number,blocks:PrintBlock[]){let cut=Math.min(start+maximum,end);for(const b of [...blocks].sort((a,b)=>a.top-b.top)){if(b.top>start+.5&&b.top<cut&&b.bottom>cut&&b.bottom-b.top<=maximum)cut=b.top;}return cut>start?cut:Math.min(start+maximum,end);}

function copyStyle(source:Element,target:Element,pseudo?:string){const style=getComputedStyle(source,pseudo);for(const property of Array.from(style))(target as HTMLElement).style.setProperty(property,style.getPropertyValue(property));return style;}
async function clonePrintNode(source:Node):Promise<Node>{
 if(!(source instanceof Element))return source.cloneNode(false);
 if(['SCRIPT','STYLE','BUTTON'].includes(source.tagName))return document.createTextNode('');
 const clone=source.cloneNode(false) as Element;copyStyle(source,clone);for(const attr of Array.from(clone.attributes))if(attr.name.startsWith('on'))clone.removeAttribute(attr.name);
 if(source instanceof HTMLImageElement){if(!source.complete||!source.naturalWidth)throw new Error('تعذر تحميل شعار المستند.');const canvas=document.createElement('canvas');canvas.width=source.naturalWidth;canvas.height=source.naturalHeight;canvas.getContext('2d')!.drawImage(source,0,0);clone.setAttribute('src',canvas.toDataURL('image/png'));clone.removeAttribute('srcset');}
 function pseudo(which:'::before'|'::after'){if(source instanceof SVGElement)return;const style=getComputedStyle(source as Element,which),content=style.content;if(style.display==='none'||!content||content==='none'||content==='normal')return;const span=document.createElement('span');copyStyle(source as Element,span,which);span.style.removeProperty('content');if(content.startsWith('attr('))span.textContent=(source as Element).getAttribute(content.slice(5,-1));else try{span.textContent=JSON.parse(content);}catch{span.textContent=content.replace(/^['"]|['"]$/g,'');}clone.appendChild(span);}
 pseudo('::before');for(const child of Array.from(source.childNodes))clone.appendChild(await clonePrintNode(child));pseudo('::after');return clone;
}
export async function capturePrintSheet(sheet:HTMLElement,paper:PrintPaper,orientation:PrintOrientation,widthDots=576):Promise<PrintPage[]>{
 await document.fonts?.ready;for(const img of Array.from(sheet.querySelectorAll('img')))if(!img.complete)await img.decode();
 const rect=sheet.getBoundingClientRect(),height=sheet.scrollHeight,scale=paper==='a4'?2:widthDots/rect.width;
 if(rect.width<=0||height<=0||height*scale>30000||rect.width*height*scale*scale>32000000)throw new Error('المستند كبير جداً. ضيّق التقرير أو اطبع عدداً أقل من السجلات.');
 const style=getComputedStyle(sheet),paddingY=parseFloat(style.paddingTop)*scale;
 const blocks=Array.from(sheet.querySelectorAll('.document-print-table tr,.document-print-header,.document-print-total,.document-print-warning,.document-print-signatures,.document-print-footer,.document-print-metrics>div,.document-print-charts .bi-chart')).map(el=>{const r=el.getBoundingClientRect();return {top:(r.top-rect.top)*scale-paddingY,bottom:(r.bottom-rect.top)*scale-paddingY};});
 const tables=Array.from(sheet.querySelectorAll('.document-print-table')).map(table=>{const head=table.querySelector('thead'),r=table.getBoundingClientRect(),h=head?.getBoundingClientRect();return h&&h.height?{top:(h.top-rect.top)*scale,bottom:(r.bottom-rect.top)*scale,height:h.height*scale}:null;}).filter((t):t is NonNullable<typeof t>=>!!t);
 const clone=await clonePrintNode(sheet) as HTMLElement;clone.style.margin='0';clone.style.boxShadow='none';clone.style.position='static';clone.style.height=height+'px';clone.style.minHeight='0';
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width',String(rect.width));svg.setAttribute('height',String(height));const object=document.createElementNS(svg.namespaceURI,'foreignObject');object.setAttribute('width','100%');object.setAttribute('height','100%');object.appendChild(clone);svg.appendChild(object);
 const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('تعذر تجهيز صورة الطباعة. جرّب Chrome أو Edge في ويندوز.'));image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));});
 const master=document.createElement('canvas');master.width=Math.round(rect.width*scale);master.height=Math.ceil(height*scale);const ctx=master.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,master.width,master.height);ctx.drawImage(image,0,0,master.width,master.height);
 const pages:PrintPage[]=[];const a4Height=Math.round(master.width*(orientation==='portrait'?297/210:210/297)),contentEnd=paper==='a4'?master.height-paddingY:master.height;
 let start=paper==='a4'?paddingY:0;
 while(start<contentEnd){const canvas=document.createElement('canvas');canvas.width=master.width;canvas.height=paper==='a4'?a4Height:Math.min(2048,Math.ceil(contentEnd-start));const context=canvas.getContext('2d')!;context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
  const repeat=paper==='a4'&&pages.length?tables.find(t=>start>t.top+t.height+.5&&start<t.bottom):undefined;
  const header=repeat?Math.ceil(repeat.height):0,margin=paper==='a4'?paddingY:0,limit=canvas.height-margin*2-header;
  const end=printSliceEnd(start,limit,contentEnd,blocks.map(b=>({top:b.top+paddingY,bottom:b.bottom+paddingY}))),take=Math.ceil(end-start);
  if(repeat)context.drawImage(master,0,repeat.top,master.width,header,0,margin,master.width,header);
  context.drawImage(master,0,start,master.width,take,0,margin+header,master.width,take);
  if(paper==='roll80'&&take<canvas.height){const trimmed=document.createElement('canvas');trimmed.width=canvas.width;trimmed.height=take;trimmed.getContext('2d')!.drawImage(canvas,0,0);pages.push({width:trimmed.width,height:trimmed.height,png:trimmed.toDataURL('image/png').split(',')[1]});}
  else{if(paper==='a4'){context.fillStyle='#333';context.font='16px Arial';context.textAlign='center';context.fillText('FooDo · '+(pages.length+1),canvas.width/2,canvas.height-20);}pages.push({width:canvas.width,height:canvas.height,png:canvas.toDataURL('image/png').split(',')[1]});}
  if(pages.length>40)throw new Error('المستند يتجاوز ٤٠ صفحة طباعة. اطبع نطاقاً أصغر.');start=end;
 }
 master.width=0;master.height=0;return pages;
}
