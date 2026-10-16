export type PrintPaper='a4'|'roll80';
export type PrintOrientation='portrait'|'landscape';
export const printPreferenceKey='foodo.print.paper';
export function validPrintPaper(value:unknown):PrintPaper{return value==='roll80'?'roll80':'a4';}
/** CSS requires two lengths for a custom rectangular page; `80mm auto` is invalid. */
export function rollPageHeight(contentPixels:number){return Math.max(50,Math.min(1000,Math.ceil((Number.isFinite(contentPixels)?Math.max(0,contentPixels):0)*25.4/96)+2));}
export function printPageRule(paper:PrintPaper,orientation:PrintOrientation,rollHeight=297){return `@page { size: ${paper==='roll80'?`80mm ${Math.max(50,Math.min(1000,Math.ceil(rollHeight)||297))}mm`:`A4 ${orientation==='landscape'?'landscape':'portrait'}`}; margin: 0; }`;}
