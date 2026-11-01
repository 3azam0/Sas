import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createDatabase,seed,postCommand,postTransfer,getReport,getSnapshot,postSetupCommand} from '@saas/server';
import {reportQuerySchema,type Access} from '@saas/contracts';
let db:Awaited<ReturnType<typeof createDatabase>>,generation:string;
const org='grills',access:Access={organizationId:org,userId:'owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
const query=(extra:Record<string,unknown>={})=>reportQuerySchema.parse({organizationId:org,generation,kind:'stockCard',from:'2026-10-10',to:'2026-10-12',locationId:'main',itemId:'rice',sort:'date_asc',...extra});
beforeAll(async()=>{
 db=await createDatabase();await seed(db,'fifo',false);
 for(const organization of ['grills','bistro']){
  const a={...access,organizationId:organization};
  for(const [type,record] of [['unit.save',{id:'kg',name:'كجم'}],['location.save',{id:'main',name:'Main',kind:'مخزن',active:true}],['location.save',{id:'branch',name:'Branch',kind:'مخزن',active:true}],['item.save',{id:'rice',name:'Rice',sku:'RICE',category:'Food',unitId:'kg',minimum:'0',purchaseUnits:[],active:true}],['item.save',{id:'other',name:'Other',sku:'OTHER',category:'Food',unitId:'kg',minimum:'0',purchaseUnits:[],active:true}]] as const)await postSetupCommand(db,a,{operationId:randomUUID(),organizationId:organization,type,record,expectedRevision:0,capturedAt:new Date().toISOString(),schemaVersion:1});
 }
 generation=(await getSnapshot(db,access)).generation!;
 const post=async(type:string,quantity:string,date:string,reason:string,locationId='main',itemId='rice',cost='10')=>postCommand(db,access,{operationId:randomUUID(),organizationId:org,generation,locationId,itemId,type,quantity,...(type==='receipt.post'?{unitCost:cost}:{}),reason,businessDate:date,capturedAt:new Date().toISOString(),schemaVersion:1});
 await post('receipt.post','5','2026-10-09','Opening');
 await post('receipt.post','3','2026-10-10','Period receipt');await post('waste.post','2','2026-10-10','special-waste');
 await post('receipt.post','4','2026-10-11','Period receipt 2');
 for(let i=0;i<10;i++)await post('receipt.post','1','2026-10-11','Extra '+i);
 await post('waste.post','1','2026-10-12','Closing waste');await post('receipt.post','2','2026-10-13','After period');
 await post('receipt.post','1','2026-10-08','Late backdate','main','rice','99');
 await post('receipt.post','7','2026-10-09','Branch opening','branch');await post('waste.post','1','2026-10-10','Branch waste','branch');await post('receipt.post','2','2026-10-11','Branch receipt','branch');
 await post('receipt.post','50','2026-10-10','Other material','main','other');
 const transferId=randomUUID(),dispatchLineId=randomUUID(),envelope={organizationId:org,generation,transferId,capturedAt:new Date().toISOString(),schemaVersion:1};
 await postTransfer(db,access,{...envelope,operationId:randomUUID(),type:'transfer.dispatch',sourceId:'main',destinationId:'branch',expectedRevision:0,businessDate:'2026-10-11',reason:'Partial transfer',lines:[{movementId:dispatchLineId,itemId:'other',unitId:'kg',quantity:'10'}]});
 await postTransfer(db,access,{...envelope,operationId:randomUUID(),type:'transfer.receive',expectedRevision:1,businessDate:'2026-10-12',reason:'Partial receipt',lines:[{movementId:randomUUID(),dispatchLineId,quantity:'4'}]});
},120000);
afterAll(async()=>{await db.close();});

it('reconstructs business-date quantities and keeps exact numeric sequence ordering across pages',async()=>{
 const first=await getReport(db,access,query({pageSize:10})),second=await getReport(db,access,query({pageSize:10,page:2}));
 expect(first.total).toBe(14);expect(first.rows).toHaveLength(10);expect(second.rows).toHaveLength(4);expect(second.stockCard).toEqual(first.stockCard);
 expect(first.stockCard?.balances.map(b=>[Number(b.opening),Number(b.incoming),Number(b.outgoing),Number(b.closing)])).toEqual([[6,17,3,20]]);
 const rows=[...first.rows,...second.rows];expect(Number(rows[0].stockCard?.before)).toBe(6);expect(Number(rows[0].stockCard?.running)).toBe(9);expect(Number(rows.at(-1)?.stockCard?.running)).toBe(20);
 for(let i=1;i<rows.length;i++)if(rows[i].date===rows[i-1].date)expect(BigInt(rows[i].stockCard!.sequence)>BigInt(rows[i-1].stockCard!.sequence)).toBe(true);
 expect(Number(rows.find(r=>r.reference==='special-waste')?.unitCost)).toBe(10);
});
it('keeps full balances under reference search and display sorting, and isolates locations and materials',async()=>{
 const full=await getReport(db,access,query()),search=await getReport(db,access,query({search:'special-waste'}));
 expect(search.total).toBe(1);expect(search.stockCard).toEqual(full.stockCard);expect(Number(search.rows[0].stockCard?.before)).toBe(9);expect(Number(search.rows[0].stockCard?.running)).toBe(7);
 const sorted=await getReport(db,access,query({sort:'quantity_desc',pageSize:100}));expect(sorted.rows.find(r=>r.id===search.rows[0].id)?.stockCard).toEqual(search.rows[0].stockCard);
 const all=await getReport(db,access,query({locationId:''}));expect(all.total).toBe(16);expect(Number(all.stockCard?.balances.find(b=>b.locationId==='branch')?.closing)).toBe(8);
 expect(Number(all.rows.find(r=>r.reference==='Branch waste')?.stockCard?.before)).toBe(7);
 expect(all.rows.every(r=>r.itemId==='rice')).toBe(true);
});
it('handles missing selection and empty periods and does not change stock or accepted operations',async()=>{
 const before=await getSnapshot(db,access);expect((await getReport(db,access,query({itemId:''}))).stockCard).toBeUndefined();
 const empty=await getReport(db,access,query({from:'2026-10-14',to:'2026-10-14'}));expect(empty.total).toBe(0);expect(Number(empty.stockCard?.balances[0].opening)).toBe(22);expect(Number(empty.stockCard?.balances[0].closing)).toBe(22);
 expect((await getReport(db,access,query({search:"%' OR 1=1 --"}))).total).toBe(0);
 const after=await getSnapshot(db,access);expect(after.balances).toEqual(before.balances);expect(after.layers).toEqual(before.layers);expect(after.acceptedOperationIds).toEqual(before.acceptedOperationIds);
});
it('counts dispatched and partially received transfer legs once and leaves transit outside site balances',async()=>{
 const report=await getReport(db,access,query({itemId:'other',locationId:''}));expect(report.total).toBe(3);
 expect(Number(report.stockCard?.balances.find(b=>b.locationId==='main')?.closing)).toBe(40);expect(Number(report.stockCard?.balances.find(b=>b.locationId==='branch')?.closing)).toBe(4);
 expect(report.rows.filter(r=>r.type==='transfer.dispatch')).toHaveLength(1);expect(report.rows.filter(r=>r.type==='transfer.receive')).toHaveLength(1);
 const source=await getSnapshot(db,access);expect(Number(source.transfers?.find(t=>t.document.lines.some(l=>l.itemId==='other'))?.lines[0].remaining)).toBe(6);
});
it('enforces tenant, generation, date and sort boundaries',async()=>{
 await expect(getReport(db,{...access,organizationId:'bistro'},query())).rejects.toMatchObject({code:'FORBIDDEN'});
 const foreign=await getReport(db,{...access,organizationId:'bistro'},query({organizationId:'bistro',generation:(await getSnapshot(db,{...access,organizationId:'bistro'})).generation}));expect(foreign.total).toBe(0);expect(Number(foreign.stockCard?.balances[0].closing)).toBe(0);
 await expect(getReport(db,access,query({generation:randomUUID()}))).rejects.toMatchObject({code:'STALE_GENERATION'});
 await expect(getReport(db,access,query({locationId:'foreign'}))).rejects.toMatchObject({code:'FORBIDDEN'});
 await expect(getReport(db,access,{...query(),sort:'date; DROP TABLE items'})).rejects.toMatchObject({code:'INVALID_REPORT'});
 await expect(getReport(db,access,query({from:'2099-01-01',to:'2099-01-01'}))).rejects.toMatchObject({code:'INVALID_REPORT'});
});
