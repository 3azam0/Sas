const format = new Intl.NumberFormat('ar-EG', {minimumFractionDigits:2, maximumFractionDigits:2});

export function formatMoney(value:string|number|null|undefined){
 return value==null||value===''?'—':format.format(Number(value));
}
