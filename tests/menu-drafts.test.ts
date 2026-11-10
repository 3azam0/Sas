import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {strToU8,zipSync} from 'fflate';
import type {Access} from '@saas/contracts';
import {createDatabase,getSnapshot,postMenuItem,postRecipe,postSetupCommand,seed} from '@saas/server';
import {parseMenuDrafts} from '../packages/domain/menu-drafts';

it('imports branch menu drafts atomically and keeps them separate from sales until a recipe is linked',async()=>{
 const db=await createDatabase();
 try{
  await seed(db,'moving_average',false);
  const access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),role:'owner',expiresAt:'2099-01-01T00:00:00Z'};
  const snapshot=await getSnapshot(db,access);
  const base={organizationId:access.organizationId,generation:snapshot.generation};
  const envelope=()=>({...base,operationId:randomUUID(),capturedAt:new Date().toISOString(),schemaVersion:1,expectedRevision:0});
  await postSetupCommand(db,access,{...envelope(),type:'kitchen.save',record:{id:'qibli',name:'المطبخ القبلي',locationId:'qibli-stock',active:true}});
  await postSetupCommand(db,access,{...envelope(),type:'pos.save',record:{id:'qibli-pos',name:'قبلي',source:'POS',kitchenId:'qibli',active:true}});
  const data=[
   {code:'QBL-001',name:'كفتة ضاني',portion:'ربع',category:'مشويات',sellingPrice:'215'},
   {code:'QBL-002',name:'كفتة ضاني',portion:'كيلو',category:'مشويات',sellingPrice:'830'},
  ];
  const command={...base,type:'menu.drafts.import',operationId:randomUUID(),posId:'qibli-pos',posRevision:1,rows:data};
  await expect(postMenuItem(db,{...access,role:'viewer'},command)).rejects.toMatchObject({code:'READ_ONLY_ACCOUNT'});
  await expect(postMenuItem(db,access,{...command,posRevision:2})).rejects.toMatchObject({code:'INVALID_POS'});
  const result=await postMenuItem(db,access,command);
  expect(result).toMatchObject({imported:2,skipped:0});
  expect(await postMenuItem(db,access,command)).toEqual(result);
  expect(await postMenuItem(db,access,{...command,operationId:randomUUID()})).toMatchObject({imported:0,skipped:2});
  await expect(postMenuItem(db,access,{...command,operationId:randomUUID(),rows:[
   {...data[0],code:'QBL-003'},
   {...data[1],sellingPrice:'890'},
  ]})).rejects.toMatchObject({code:'DUPLICATE_MENU_DRAFT'});
  const after=await getSnapshot(db,access);
  expect(after.menuItems).toEqual([]);
  expect(after.balances).toEqual(snapshot.balances);
  expect(after.menuDrafts?.map(d=>[d.code,d.kitchenId,d.sellingPrice])).toEqual([
   ['QBL-001','qibli','215'],['QBL-002','qibli','830'],
  ]);

  const record={id:randomUUID(),code:data[0].code,source:'POS',name:'كفتة ضاني · ربع',
   sellingPrice:'215',category:'مشويات',versionId:randomUUID(),outputPerSale:'0.25',active:false,kitchenIds:['qibli']};
  await expect(postMenuItem(db,access,{...envelope(),type:'menu.save',record})).rejects.toMatchObject({code:'INVALID_RECIPE'});
  await postSetupCommand(db,access,{...envelope(),type:'unit.save',record:{id:'kg',name:'كجم'}});
  await postSetupCommand(db,access,{...envelope(),type:'item.save',record:{
   id:'kofta',name:'كفتة جاهزة',sku:'KOFTA',category:'مشويات',unitId:'kg',minimum:'0',purchaseUnits:[],active:true,
  }});
  const recipeId=randomUUID(),versionId=randomUUID();
  await postRecipe(db,access,{...envelope(),recipeId,type:'recipe.save',definition:{
   code:'RECIPE-Q',name:'كفتة ضاني',outputMode:'non_stocked',outputUnitId:'kg',outputQuantity:'1',
   effectiveDate:'2026-11-05',salesStockItemIds:['kofta'],
   lines:[{lineId:randomUUID(),kind:'material',itemId:'kofta',unitId:'kg',inputUnit:'base',enteredQuantity:'1',quantity:'1'}],
  }});
  await postRecipe(db,access,{...envelope(),expectedRevision:1,recipeId,type:'recipe.publish',versionId});
  await postMenuItem(db,access,{...envelope(),type:'menu.save',record:{...record,versionId}});
  const linked=await getSnapshot(db,access);
  expect(linked.menuItems).toMatchObject([{code:'QBL-001',active:false,versionId,outputPerSale:'0.25'}]);
  expect(linked.menuDrafts?.map(draft=>draft.code)).toEqual(['QBL-002']);
 }finally{await db.close();}
},45000);

it('reads the prepared menu headers below the title and retains the printed price, portion and source',()=>{
 const csv='منيو قبلي\nأسعار البيع\nكود مقترح,القسم,اسم الصنف,الحجم,السعر ج.م,الوصف والاختيارات,المصدر,ملاحظات المراجعة\n'+
  'QBL-019,الوجبات,وجبة سوبر ميكس جريل,وجبة,399,أرز بسمتي,صورة 2,سعر المنيو المطبوع';
 expect(parseMenuDrafts(new TextEncoder().encode(csv).buffer,'menu.csv')).toEqual([{
  code:'QBL-019',category:'الوجبات',name:'وجبة سوبر ميكس جريل',portion:'وجبة',sellingPrice:'399',
  description:'أرز بسمتي',reference:'صورة 2',note:'سعر المنيو المطبوع',
 }]);
});

it('reads the namespaced worksheet produced by the prepared workbook exporter',()=>{
 const header=['كود مقترح','القسم','اسم الصنف','الحجم','السعر ج.م','الوصف والاختيارات','المصدر'];
 const row=(values:string[],number:number)=>`<x:row r="${number}">${values.map((value,i)=>{
  const ref=String.fromCharCode(65+i)+number;
  return value?`<x:c r="${ref}" t="str"><x:v>${value}</x:v></x:c>`:`<x:c r="${ref}" />`;
 }).join('')}</x:row>`;
 const sheet=`<x:worksheet><x:sheetData>${row(['منيو قبلي'],2)}<x:row r="3" />${row(header,5)}${row(['QBL-001','الوجبات','وجبة سوبر ميكس جريل','وجبة','399','','صورة 2'],6)}</x:sheetData></x:worksheet>`;
 const bytes=zipSync({'xl/worksheets/sheet1.xml':strToU8(sheet)});
 expect(parseMenuDrafts(Uint8Array.from(bytes).buffer,'menu.xlsx')).toMatchObject([
  {code:'QBL-001',sellingPrice:'399',reference:'صورة 2',description:''},
 ]);
});
