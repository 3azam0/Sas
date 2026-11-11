import {beforeEach,afterEach,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createDatabase,seed,getSnapshot,postOpening,postReceiptDocument,postKitchenIssue,postCommand,getReport,reconcileStock} from '../packages/server';
import {postDocumentCorrection} from '../packages/server/document-corrections';
import {reportQuerySchema,type Access,type OpeningDocument,type ReceiptDocument,type KitchenIssueDocument} from '../packages/contracts';
let db:Awaited<ReturnType<typeof createDatabase>>,generation:string;
const access:Access={organizationId:'grills',userId:'owner',deviceId:randomUUID(),role:'owner',expiresAt:'2099-01-01T00:00:00Z'},date='2026-11-01';
const base=()=>({operationId:randomUUID(),organizationId:'grills',generation,locationId:'main',businessDate:date,capturedAt:new Date().toISOString(),schemaVersion:1 as const,currency:'EGP' as const});
const line=(quantity='10',unitCost='2')=>({lineId:randomUUID(),itemId:'a',unitId:'kg',quantity,unitCost});
const opening=(q='10',cost='2'):OpeningDocument=>({...base(),type:'opening.post',reason:'Opening',lines:[line(q,cost)]});
const receipt=(q='10',cost='2'):ReceiptDocument=>({...base(),type:'receipt.document',reason:'Receipt',lines:[line(q,cost)]});
const kitchen=(q='3'):KitchenIssueDocument=>({...base(),type:'kitchen.transfer',kitchenId:'k',kitchen:'Kitchen',destinationLocationId:'dest',reference:'KI',notes:'',lines:[{lineId:randomUUID(),itemId:'a',unitId:'kg',quantity:q,unitPrice:'5'}]});
const correction=(kind:'opening'|'receipt'|'kitchen',sourceId:string,replacement:OpeningDocument|ReceiptDocument|KitchenIssueDocument)=>({operationId:randomUUID(),organizationId:'grills',generation,sourceId,kind,replacement,reason:'Correct recorded quantity',businessDate:date});
const balance=async(location='main')=>(await getSnapshot(db,access)).balances.find(b=>b.itemId==='a'&&b.locationId===location);
beforeEach(async()=>{db=await createDatabase();await seed(db,'moving_average',false);await db.exec("INSERT INTO units(organization_id,id,name,revision) VALUES('grills','kg','كجم',1);INSERT INTO locations(organization_id,id,name,kind) VALUES('grills','main','Main','stock'),('grills','dest','Kitchen','kitchen');INSERT INTO kitchens(organization_id,id,name,active,revision,location_id,parent_location_id) VALUES('grills','k','Kitchen',true,1,'dest','main');INSERT INTO items(organization_id,id,name,sku,category,unit,unit_id,minimum) VALUES('grills','a','Item A','A','Food','كجم','kg',0),('grills','b','Item B','B','Food','كجم','kg',0);");generation=(await getSnapshot(db,access)).generation!;});
afterEach(async()=>db.close());
it('allows a fresh opening for a cleared zero row with no history but rejects any real prior history',async()=>{await db.query("INSERT INTO stock_balances VALUES('grills','main','a',0,0)");const d=opening();await postOpening(db,access,d);expect(await balance()).toMatchObject({quantity:'10.000000'});await expect(postOpening(db,access,opening('5'))).rejects.toMatchObject({code:'OPENING_EXISTS'});});
it('corrects an accepted opening atomically, preserves its original payload and supports same-ID retries',async()=>{const old=opening();await postOpening(db,access,old);const next=opening('12','3'),c=correction('opening',old.operationId,next);const result=await postDocumentCorrection(db,access,c);expect(await postDocumentCorrection(db,access,c)).toEqual(result);expect(await balance()).toMatchObject({quantity:'12.000000',value:'36.000000000000'});expect((await db.query<{payload:OpeningDocument}>('SELECT payload FROM opening_documents WHERE operation_id=$1',[old.operationId])).rows[0].payload.lines[0].quantity).toBe('10');expect((await getSnapshot(db,access)).documentCorrections?.[0]).toMatchObject({sourceId:old.operationId,replacementId:next.operationId});expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);await expect(postDocumentCorrection(db,access,{...c,operationId:randomUUID(),replacement:opening('14')})).rejects.toMatchObject({code:'ALREADY_CORRECTED'});});
it('rolls back a reversal if the replacement fails validation or availability',async()=>{const old=receipt();await postReceiptDocument(db,access,old);const next=receipt('4');next.lines[0].unitId='wrong';await expect(postDocumentCorrection(db,access,correction('receipt',old.operationId,next))).rejects.toMatchObject({code:'INVALID_UNIT'});expect(await balance()).toMatchObject({quantity:'10.000000',value:'20.000000000000'});expect((await db.query('SELECT * FROM document_corrections')).rows).toHaveLength(0);expect((await db.query("SELECT * FROM stock_entries WHERE type='receipt.reverse'")).rows).toHaveLength(0);});
it('corrects receipt quantity/cost and keeps purchasing metrics and latest receipt prices correct',async()=>{const old=receipt();await postReceiptDocument(db,access,old);await postDocumentCorrection(db,access,correction('receipt',old.operationId,receipt('5','3')));expect(await balance()).toMatchObject({quantity:'5.000000',value:'15.000000000000'});const report=await getReport(db,access,reportQuerySchema.parse({organizationId:'grills',generation,kind:'purchasing',from:date,to:date,locationId:'main'}));expect(Number(report.current.netReceived)).toBe(15);expect(Number((await getSnapshot(db,access)).receiptPrices?.find(p=>p.itemId==='a')?.unitCost)).toBe(3);});
it.each(['fifo','moving_average'])('edits and voids the same direct receipt with reconciled stock under %s',async method=>{
 await db.query('UPDATE organizations SET costing_method=$1 WHERE id=$2',[method,'grills']);
 const original=receipt();
 await postReceiptDocument(db,access,original);
 const [oldLine]=original.lines;
 const edit={operationId:randomUUID(),organizationId:'grills',generation,sourceId:original.operationId,expectedRevision:0,reason:'Correct direct receipt',kind:'receipt_edit',document:{
  ...original,businessDate:'2026-10-31',reason:'Updated receipt',lines:[{...oldLine,quantity:'5',unitCost:'3'},{...line('2','4'),itemId:'b'}],
 }};
 const accepted=await postDocumentCorrection(db,access,edit);
 expect(await postDocumentCorrection(db,access,edit)).toEqual(accepted);
 expect(await balance()).toMatchObject({quantity:'5.000000',value:'15.000000000000'});
 let snapshot=await getSnapshot(db,access);
 expect(snapshot.receipts).toHaveLength(1);
 expect(snapshot.receipts?.[0]).toMatchObject({document:{operationId:original.operationId,businessDate:'2026-10-31',reason:'Updated receipt'},amount:'23.000000000000',edits:[{revision:1}]});
 expect(snapshot.receiptPrices?.find(price=>price.itemId==='a')).toMatchObject({businessDate:'2026-10-31'});
 const purchasing=async(day:string)=>getReport(db,access,reportQuerySchema.parse({organizationId:'grills',generation,kind:'purchasing',from:day,to:day,locationId:'main'}));
 expect(Number((await purchasing(date)).current.netReceived)).toBe(0);
 expect(Number((await purchasing('2026-10-31')).current.netReceived)).toBe(23);
 await expect(postDocumentCorrection(db,access,{...edit,operationId:randomUUID()})).rejects.toMatchObject({code:'STALE_REVISION'});
 await expect(postDocumentCorrection(db,access,correction('receipt',original.operationId,receipt()))).rejects.toMatchObject({code:'STALE_REVISION'});
 const second={...edit,operationId:randomUUID(),expectedRevision:1,document:{...edit.document,lines:[{...oldLine,quantity:'7',unitCost:'3'}]}};
 await postDocumentCorrection(db,access,second);
 expect(await balance()).toMatchObject({quantity:'7.000000',value:'21.000000000000'});
 snapshot=await getSnapshot(db,access);
 expect(snapshot.receiptPrices?.find(price=>price.itemId==='b')).toBeUndefined();
 const voiding={operationId:randomUUID(),organizationId:'grills',generation,sourceId:original.operationId,expectedRevision:2,reason:'Cancel receipt',kind:'receipt_void'};
 const voided=await postDocumentCorrection(db,access,voiding);
 expect(await postDocumentCorrection(db,access,voiding)).toEqual(voided);
 expect(await balance()).toMatchObject({quantity:'0.000000',value:'0.000000000000'});
 snapshot=await getSnapshot(db,access);
 expect(snapshot.receipts).toHaveLength(1);
 expect(snapshot.receipts?.[0]).toMatchObject({document:{operationId:original.operationId},amount:'0.000000000000',edits:[{revision:3,updated:null},{revision:2},{revision:1}]});
 expect(snapshot.receiptPrices?.filter(price=>['a','b'].includes(price.itemId))).toEqual([]);
 expect((await reconcileStock(db,'grills')).every(row=>row.matches)).toBe(true);
});
it('protects consumed direct receipt lines but lets an edit leave those lines unchanged',async()=>{
 const original={...receipt(),lines:[line(),{...line('2','4'),itemId:'b'}]};
 await postReceiptDocument(db,access,original);
 await postCommand(db,access,{...base(),type:'waste.post',itemId:'a',quantity:'1',reason:'Receipt used'});
 const voiding={operationId:randomUUID(),organizationId:'grills',generation,sourceId:original.operationId,expectedRevision:0,reason:'Cancel used receipt',kind:'receipt_void'};
 await expect(postDocumentCorrection(db,{...access,role:'operator'},voiding)).rejects.toMatchObject({code:'FORBIDDEN'});
 await expect(postDocumentCorrection(db,access,voiding)).rejects.toMatchObject({code:'SOURCE_ALREADY_USED'});
 const document={...original,lines:[{...original.lines[0],quantity:'10.00'},{...original.lines[1],quantity:'3'}]};
 const editing={...voiding,operationId:randomUUID(),kind:'receipt_edit',document};
 await postDocumentCorrection(db,access,editing);
 expect(await balance()).toMatchObject({quantity:'9.000000',value:'18.000000000000'});
 expect((await getSnapshot(db,access)).receipts?.[0]?.document.lines[0]).toEqual(original.lines[0]);
 await db.query("INSERT INTO day_closures(organization_id,location_id,closed_through,revision,actor,reason) VALUES($1,$2,$3,1,'owner','Test close')",['grills','main',date]);
 await expect(postDocumentCorrection(db,access,{...editing,operationId:randomUUID(),expectedRevision:1,document:{...document,reason:'Closed period edit'}})).rejects.toMatchObject({code:'PERIOD_CLOSED'});
});
it.each(['fifo','moving_average'])('preserves other receipt value through a correction chain under %s',async method=>{await db.query('UPDATE organizations SET costing_method=$1 WHERE id=$2',[method,'grills']);const old=receipt();await postReceiptDocument(db,access,old);const other=receipt('10','4');await postReceiptDocument(db,access,other);const next=receipt('5','3');await postDocumentCorrection(db,access,correction('receipt',old.operationId,next));expect(await balance()).toMatchObject({quantity:'15.000000',value:'55.000000000000'});await postDocumentCorrection(db,access,correction('receipt',next.operationId,receipt('6','5')));expect(await balance()).toMatchObject({quantity:'16.000000',value:'70.000000000000'});expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);expect((await getSnapshot(db,access)).documentCorrections).toHaveLength(2);});
it('reverses both sides of a kitchen transfer before posting the linked replacement',async()=>{await postOpening(db,access,opening('10'));const old=kitchen();await postKitchenIssue(db,access,old);await postDocumentCorrection(db,access,correction('kitchen',old.operationId,kitchen('4')));expect(await balance()).toMatchObject({quantity:'6.000000',value:'12.000000000000'});expect(await balance('dest')).toMatchObject({quantity:'4.000000',value:'8.000000000000'});expect((await reconcileStock(db,'grills')).every(r=>r.matches)).toBe(true);const r=await getReport(db,access,reportQuerySchema.parse({organizationId:'grills',generation,kind:'kitchenSupply',from:date,to:date,locationId:'main'}));expect(r.current.kitchenTransferOut).toBe('8.000000000000');expect(Number(r.current.kitchenDocumentAmount)).toBe(20);});
it('blocks corrections of consumed source stock or used kitchen stock without changing balances',async()=>{const old=opening();await postOpening(db,access,old);const ki=kitchen();await postKitchenIssue(db,access,ki);await expect(postDocumentCorrection(db,access,correction('opening',old.operationId,opening('12')))).rejects.toMatchObject({code:'SOURCE_ALREADY_USED'});await postCommand(db,access,{...base(),locationId:'dest',type:'waste.post',itemId:'a',quantity:'1',reason:'Kitchen use'});const before=await balance();await expect(postDocumentCorrection(db,access,correction('kitchen',ki.operationId,kitchen('4')))).rejects.toMatchObject({code:'SOURCE_ALREADY_USED'});expect(await balance()).toEqual(before);});
it('rejects unauthorized roles, other tenants, stale generations, closed periods and reused IDs',async()=>{const old=opening();await postOpening(db,access,old);const c=correction('opening',old.operationId,opening('12'));for(const role of ['operator','viewer',undefined] as const)await expect(postDocumentCorrection(db,{...access,role},c)).rejects.toMatchObject({code:'FORBIDDEN'});await expect(postDocumentCorrection(db,access,{...c,organizationId:'bistro'})).rejects.toMatchObject({code:'FORBIDDEN'});await expect(postDocumentCorrection(db,access,{...c,generation:randomUUID()})).rejects.toMatchObject({code:'FORBIDDEN'});await expect(postDocumentCorrection(db,access,{...c,replacement:{...c.replacement,operationId:old.operationId}})).rejects.toMatchObject({code:'PAYLOAD_CONFLICT'});await db.query("INSERT INTO day_closures(organization_id,location_id,closed_through,revision,actor,reason) VALUES($1,$2,$3,1,'owner','Test close')",['grills','main',date]);await expect(postDocumentCorrection(db,access,c)).rejects.toMatchObject({code:'PERIOD_CLOSED'});});
it('enforces RLS and immutable correction history using the actual migration',async()=>{await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE fodo_api;GRANT USAGE ON SCHEMA public TO fodo_api;');const sql=await readFile('supabase/migrations/20261102191604_stock_document_corrections.sql','utf8');await db.exec(sql.replace('SET LOCAL search_path=fodo,pg_catalog;',''));await expect(db.transaction(async tx=>{await tx.query('SET LOCAL ROLE authenticated');return tx.query('SELECT * FROM document_corrections');})).rejects.toThrow(/permission denied/i);await expect(db.transaction(async tx=>{await tx.query('SET LOCAL ROLE fodo_api');return tx.query('DELETE FROM document_corrections');})).rejects.toThrow(/permission denied/i);});
it('voids the latest kitchen document and preserves its previous revision without a new stock document',async()=>{
 await postOpening(db,access,opening('10'));
 const original=kitchen();await postKitchenIssue(db,access,original);
 const updated=kitchen('4');await postDocumentCorrection(db,access,correction('kitchen',original.operationId,updated));
 const command={operationId:randomUUID(),organizationId:'grills',generation,sourceId:updated.operationId,kind:'kitchen_void',reason:'Cancel this corrected transfer',businessDate:date};
 const result=await postDocumentCorrection(db,access,command);
 expect(await postDocumentCorrection(db,access,command)).toEqual(result);
 expect(await balance()).toMatchObject({quantity:'10.000000',value:'20.000000000000'});
 expect(await balance('dest')).toMatchObject({quantity:'0.000000',value:'0.000000000000'});
 const s=await getSnapshot(db,access);
 expect(s.kitchenIssues).toHaveLength(2);
 expect(s.documentCorrections).toContainEqual(expect.objectContaining({operationId:command.operationId,sourceId:updated.operationId,replacementId:command.operationId}));
 expect((await reconcileStock(db,'grills')).every(row=>row.matches)).toBe(true);
});

const quantityEdit=(document:KitchenIssueDocument,quantity:string,expectedRevision=0)=>({
 operationId:randomUUID(),organizationId:'grills',generation,sourceId:document.operationId,
 lineId:document.lines[0].lineId,kind:'kitchen_quantity',quantity,expectedRevision,reason:'Correct mistyped quantity'
});

it.each(['moving_average','fifo'] as const)('corrects kitchen quantity from 10 to 4 despite an unrelated later reversal under %s',async method=>{
 await db.query('UPDATE organizations SET costing_method=$1 WHERE id=$2',[method,'grills']);
 await postOpening(db,access,opening('3.6'));
 await postReceiptDocument(db,access,receipt('40',method==='fifo'?'3':'2'));
 await postOpening(db,access,{...opening(),lines:[{...line('4'),itemId:'b'}]});
 const original={...kitchen('10'),businessDate:'2026-11-06'};
 original.lines.push({...original.lines[0],lineId:randomUUID(),itemId:'b',quantity:'1'});
 await postKitchenIssue(db,access,original);
 const later={...kitchen('10.1'),businessDate:'2026-11-09'};
 await postKitchenIssue(db,access,later);
 await postDocumentCorrection(db,access,{operationId:randomUUID(),organizationId:'grills',generation,sourceId:later.operationId,
  reason:'Reverse later document',kind:'kitchen_void',businessDate:later.businessDate});
 const prior=await getSnapshot(db,access),priorLater=prior.entries.filter(row=>row.kitchenIssueId===later.operationId);
 expect(prior.entries.filter(row=>row.kitchenIssueId===original.operationId&&row.locationId==='dest'&&row.itemId==='a').map(row=>Number(row.quantity)).sort()).toEqual([3.6,6.4]);
 const command=quantityEdit(original,'4');
 const [first,retry]=await Promise.all([postDocumentCorrection(db,access,command),postDocumentCorrection(db,access,command)]);
 expect(retry).toEqual(first);
 expect(first).toMatchObject({operationId:command.operationId,outcome:'accepted',replacementId:original.operationId});
 const next=await getSnapshot(db,access),posted=next.kitchenIssues!.find(row=>row.document.operationId===original.operationId)!;
 expect(posted.document.lines.map(row=>Number(row.quantity))).toEqual([4,1]);
 expect(posted.lines.map(row=>Number(row.amount))).toEqual([method==='fifo'?8.4:8,2]);
 expect(posted.quantityRevisions).toHaveLength(1);
 expect(posted.quantityRevisions![0]).toMatchObject({actor:access.userId,reason:command.reason,revision:1,lineId:command.lineId});
 expect(Number(posted.quantityRevisions![0].previousQuantity)).toBe(10);
 expect((await db.query<{payload:KitchenIssueDocument}>('SELECT payload FROM kitchen_issues WHERE operation_id=$1',[original.operationId])).rows[0].payload.lines[0].quantity).toBe('10');
 expect(next.entries.filter(row=>row.kitchenIssueId===later.operationId)).toEqual(priorLater);
 for(const [location,delta] of [['main',6],['dest',-6]] as const){
  const get=(s:typeof next)=>s.balances.find(row=>row.locationId===location&&row.itemId==='a')!;
  expect(Number(get(next).quantity)-Number(get(prior).quantity)).toBeCloseTo(delta,9);
  expect(Number(get(next).value)-Number(get(prior).value)).toBeCloseTo(delta*(method==='fifo'?3:2),9);
 }
 expect((await reconcileStock(db,'grills')).every(row=>row.matches)).toBe(true);
 const report=await getReport(db,access,reportQuerySchema.parse({organizationId:'grills',generation,kind:'kitchenSupply',from:original.businessDate,to:posted.quantityRevisions![0].businessDate,locationId:'main'}));
 expect(Number(report.current.kitchenDocumentAmount)).toBe(25);
 await expect(postDocumentCorrection(db,access,quantityEdit(original,'5'))).rejects.toMatchObject({code:'STALE_REVISION'});
 const increase=quantityEdit(original,'7',1);
 await postDocumentCorrection(db,access,increase);
 expect(Number((await getSnapshot(db,access)).kitchenIssues!.find(row=>row.document.operationId===original.operationId)!.document.lines[0].quantity)).toBe(7);
 await postDocumentCorrection(db,access,quantityEdit(original,'2',2));
 expect(Number((await getSnapshot(db,access)).kitchenIssues!.find(row=>row.document.operationId===original.operationId)!.document.lines[0].quantity)).toBe(2);
 expect((await reconcileStock(db,'grills')).every(row=>row.matches)).toBe(true);
});

it('keeps kitchen quantity and stock intact when the needed original stock was consumed',async()=>{
 await postOpening(db,access,opening('15'));
 const original=kitchen('10');
 await postKitchenIssue(db,access,original);
 await postCommand(db,access,{...base(),locationId:'dest',type:'waste.post',itemId:'a',quantity:'5',reason:'Stock consumed'});
 const prior=await getSnapshot(db,access),command=quantityEdit(original,'4');
 await expect(postDocumentCorrection(db,{...access,role:'viewer'},command)).rejects.toMatchObject({code:'FORBIDDEN'});
 await expect(postDocumentCorrection(db,access,command)).rejects.toMatchObject({code:'SOURCE_ALREADY_USED'});
 const after=await getSnapshot(db,access);
 expect(after.balances).toEqual(prior.balances);
 expect(after.kitchenIssues).toEqual(prior.kitchenIssues);
 expect(after.acceptedOperationIds).not.toContain(command.operationId);
});

const documentEdit=(document:KitchenIssueDocument,expectedRevision=0)=>({
 operationId:randomUUID(),organizationId:'grills',generation,sourceId:document.operationId,
 kind:'kitchen_edit',document,expectedRevision,reason:'Fix original kitchen document'
});
const kitchenDocument=async(id:string)=>(await getSnapshot(db,access)).kitchenIssues!.find(row=>row.document.operationId===id)!;

it.each(['moving_average','fifo'] as const)('edits the same kitchen document with a later transfer and reversal under %s',async method=>{
 await db.query('UPDATE organizations SET costing_method=$1 WHERE id=$2',[method,'grills']);
 await db.query("INSERT INTO items(organization_id,id,name,sku,category,unit,unit_id,minimum) VALUES('grills','c','Item C','C','Food','كجم','kg',0)");
 await postOpening(db,access,{...opening(),lines:[line('3.6'),{...line('6'),itemId:'b'},{...line('6','4'),itemId:'c'}]});
 await postReceiptDocument(db,access,receipt('40',method==='fifo'?'3':'2'));
 const original=kitchen('10');
 const [a]=original.lines,b={...a,itemId:'b',lineId:randomUUID(),quantity:'2'};
 original.lines.push(b);
 await postKitchenIssue(db,access,original);
 const later={...kitchen('10.1'),businessDate:'2026-11-06'};
 await postKitchenIssue(db,access,later);
 await postDocumentCorrection(db,access,{operationId:randomUUID(),organizationId:'grills',generation,sourceId:later.operationId,
  reason:'Reverse unrelated transfer',kind:'kitchen_void',businessDate:later.businessDate});
 const prior=await getSnapshot(db,access);
 const edit=documentEdit({...original,businessDate:'2026-10-31',reference:'Updated',notes:'Typo fixed',
  lines:[{...a,quantity:'4',unitPrice:'7'},{...b,itemId:'c',lineId:randomUUID(),quantity:'3',unitPrice:'9'}]});
 const [accepted,retry]=await Promise.all([postDocumentCorrection(db,access,edit),postDocumentCorrection(db,access,edit)]);
 expect(retry).toEqual(accepted);
 expect(accepted).toMatchObject({outcome:'accepted',replacementId:original.operationId});
 const posted=await kitchenDocument(original.operationId);
 expect(posted.document).toEqual(edit.document);
 expect(posted.revision).toBe(1);
 expect(posted.lines.map(row=>Number(row.amount))).toEqual([method==='fifo'?8.4:8,12]);
 expect(posted.documentRevisions?.[0]).toMatchObject({revision:1,actor:'owner',reason:edit.reason,changes:{lines:[
  {itemId:'a',previous:{quantity:'10'},current:{quantity:'4',unitPrice:'7'}},
  {itemId:'b',previous:{quantity:'2'}},{itemId:'c',current:{quantity:'3'}}
 ]}});
 const next=await getSnapshot(db,access);
 const quantity=(item:string,loc:string)=>Number(next.balances.find(row=>row.itemId===item&&row.locationId===loc)?.quantity);
 expect([quantity('a','dest'),quantity('b','dest'),quantity('c','dest')]).toEqual([4,0,3]);
 expect(next.entries.filter(row=>row.kitchenIssueId===later.operationId)).toEqual(prior.entries.filter(row=>row.kitchenIssueId===later.operationId));
 expect((await db.query<{payload:KitchenIssueDocument}>('SELECT payload FROM kitchen_issues WHERE operation_id=$1',[original.operationId])).rows[0].payload).toEqual(original);
 await expect(postDocumentCorrection(db,access,{...edit,operationId:randomUUID()})).rejects.toMatchObject({code:'STALE_REVISION'});
 await postDocumentCorrection(db,access,quantityEdit(posted.document,'5',1));
 const afterQuantity=await kitchenDocument(original.operationId);
 expect(Number(afterQuantity.document.lines[0].quantity)).toBe(5);
 await postDocumentCorrection(db,access,documentEdit({...afterQuantity.document,reference:'Final'},2));
 const final=await kitchenDocument(original.operationId);
 expect(final).toMatchObject({revision:3,quantityRevisions:[{revision:2}],documentRevisions:[{revision:1},{revision:3}]});
 expect(Number(final.document.lines[0].quantity)).toBe(5);
 expect((await reconcileStock(db,'grills')).every(row=>row.matches)).toBe(true);
});

it('allows edits around consumed lines and rolls back the whole save when a required return is short',async()=>{
 await postOpening(db,access,{...opening(),lines:[line('20'),{...line('20'),itemId:'b'}]});
 const original=kitchen('10');
 const [a]=original.lines,b={...a,itemId:'b',lineId:randomUUID(),quantity:'4'};
 original.lines.push(b);
 await postKitchenIssue(db,access,original);
 await postCommand(db,access,{...base(),locationId:'dest',type:'waste.post',itemId:'b',quantity:'2',reason:'Kitchen use'});
 const prior=await getSnapshot(db,access);
 await expect(postDocumentCorrection(db,access,documentEdit({...original,lines:[{...a,quantity:'4'}]}))).rejects.toMatchObject({
  code:'SOURCE_ALREADY_USED',message:expect.stringContaining('Item B')
 });
 const after=await getSnapshot(db,access);
 expect(after.balances).toEqual(prior.balances);
 expect(after.entries).toEqual(prior.entries);
 expect(after.kitchenIssues).toEqual(prior.kitchenIssues);
 await postDocumentCorrection(db,access,documentEdit({...original,lines:[{...a,quantity:'4'},{...b,unitPrice:'8'}]}));
 const updated=await kitchenDocument(original.operationId);
 expect(updated.document.lines).toEqual([{...a,quantity:'4'},{...b,unitPrice:'8'}]);
 const entries=(await getSnapshot(db,access)).entries;
 expect(entries.filter(row=>row.itemId==='b')).toEqual(prior.entries.filter(row=>row.itemId==='b'));
 await expect(postDocumentCorrection(db,access,documentEdit({...updated.document,lines:[{...a,quantity:'500'},b]},1))).rejects.toMatchObject({
  message:expect.stringContaining('Item A')
 });
});

it('changes the receiving kitchen and supports removing and re-adding the last item',async()=>{
 await db.exec("INSERT INTO locations(organization_id,id,name,kind) VALUES('grills','dest2','Second','kitchen');INSERT INTO kitchens(organization_id,id,name,active,revision,location_id,parent_location_id) VALUES('grills','k2','Second',true,1,'dest2','main');");
 await postOpening(db,access,opening('20','2'));
 const original=kitchen('10');
 await postKitchenIssue(db,access,original);
 const document={...original,kitchenId:'k2',kitchen:'Second',destinationLocationId:'dest2',lines:[{...original.lines[0],quantity:'4'}]};
 await postDocumentCorrection(db,access,documentEdit(document));
 expect(await kitchenDocument(original.operationId)).toMatchObject({document,amount:'8.000000000000'});
 expect(await balance()).toMatchObject({quantity:'16.000000',value:'32.000000000000'});
 expect(await balance('dest')).toMatchObject({quantity:'0.000000',value:'0.000000000000'});
 expect(await balance('dest2')).toMatchObject({quantity:'4.000000',value:'8.000000000000'});
 await postDocumentCorrection(db,access,documentEdit({...document,lines:[]},1));
 expect(await kitchenDocument(original.operationId)).toMatchObject({revision:2,document:{lines:[]},lines:[],amount:'0.000000000000'});
 await postDocumentCorrection(db,access,documentEdit(document,2));
 expect(await kitchenDocument(original.operationId)).toMatchObject({revision:3,document,amount:'8.000000000000'});
 expect((await reconcileStock(db,'grills')).every(row=>row.matches)).toBe(true);
});

it('protects the full kitchen revision history with the production migration',async()=>{
 await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE fodo_api;GRANT USAGE ON SCHEMA public TO fodo_api;');
 const sql=await readFile('supabase/migrations/20261111154534_kitchen_document_revisions.sql','utf8');
 await db.exec(sql.replace('SET LOCAL search_path=fodo,pg_catalog;',''));
 await postOpening(db,access,opening('10'));
 const original=kitchen();
 await postKitchenIssue(db,access,original);
 await postDocumentCorrection(db,access,documentEdit({...original,reference:'Edited'}));
 await expect(db.transaction(async tx=>{
  await tx.query('SET LOCAL ROLE authenticated');
  return tx.query('SELECT * FROM kitchen_document_revisions');
 })).rejects.toThrow(/permission denied/i);
 await expect(db.transaction(async tx=>{
  await tx.query('SET LOCAL ROLE fodo_api');
  await tx.query("SET LOCAL fodo.tenant='other'");
  return tx.query('SELECT * FROM kitchen_document_revisions');
 })).resolves.toMatchObject({rows:[]});
 await expect(db.transaction(async tx=>{
  await tx.query('SET LOCAL ROLE fodo_api');
  await tx.query("SET LOCAL fodo.tenant='grills'");
  return tx.query('SELECT * FROM kitchen_document_revisions');
 })).resolves.toMatchObject({rows:[{revision:1}]});
 await expect(db.transaction(async tx=>{
  await tx.query('SET LOCAL ROLE fodo_api');
  return tx.query('DELETE FROM kitchen_document_revisions');
 })).rejects.toThrow(/permission denied/i);
});
