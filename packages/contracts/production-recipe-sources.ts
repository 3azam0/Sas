export type ProductionRecipeSource = {
 code:string;
 name:string;
 sourceRow:number;
 workbook:string;
 kitchen:string;
 ingredients:{
  row:number;
  name:string;
  unit:string|null;
  quantity:string|null;
  stockMatch?:{itemId:string;itemName:string;unitId:string};
 }[];
 yield:{quantity:string;unit:string|null;note:string}|null;
 notes:{row:number;text:string}[];
};
