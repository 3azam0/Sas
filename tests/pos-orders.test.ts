import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {getSnapshot,postPOSOrder,getReport,postFinance,postSalesImport,reconcileStock} from '@saas/server';
import {reportQuerySchema,type OrderDraft,type POSOrderCommand} from '@saas/contracts';
import {counterPOSFixture} from './fixtures/counter-pos';
import {checkoutCart} from '../packages/domain/pos';

async function fixture(){
 const f=await counterPOSFixture();
 const command=(body:object)=>({operationId:randomUUID(),organizationId:f.access.organizationId,generation:f.snapshot.generation!,expectedRevision:0,...body});
 const send=(body:object)=>postPOSOrder(f.db,f.access,command(body));
 const draft=(quantity='1',pos='p2'):OrderDraft=>({id:randomUUID(),posId:pos,service:'counter',customer:{name:'',phone:'',address:''},deliveryFee:'0',note:'',lines:f.cart(quantity,pos).lines});
 const order=async(id:string)=>(await getSnapshot(f.db,f.access)).posOrders!.orders.find(o=>o.draft.id===id)!;
 await send({type:'shift.open',posId:'p2',openingCash:'100'});
 return {...f,command,send,draft,order};
}
it('shares and transfers Qibli tables, prevents occupancy conflicts and leaves open stock untouched',async()=>{
 const f=await fixture();try{
 const t={id:randomUUID(),posId:'p2',name:'١',seats:4,active:true},t2={...t,id:randomUUID(),name:'٢'};
 await f.send({type:'table.save',record:t});await f.send({type:'table.save',record:t2});
 await expect(f.send({type:'table.save',record:{...t,id:randomUUID(),posId:'p1'}})).rejects.toMatchObject({code:'TABLES_QIBLI_ONLY'});
 const draft={...f.draft(),service:'table' as const,tableId:t.id};const before=(await getSnapshot(f.db,f.access)).balances;
 await f.send({type:'order.save',draft});
 const anotherDevice=await getSnapshot(f.db,{...f.access,deviceId:randomUUID()});expect(anotherDevice.posOrders!.orders[0].draft.tableId).toBe(t.id);expect(anotherDevice.balances).toEqual(before);
 await expect(f.send({type:'order.save',draft:{...draft,id:randomUUID()}})).rejects.toMatchObject({code:'TABLE_OCCUPIED'});
 await expect(f.send({type:'order.pay',draft:{...draft,id:randomUUID()},payments:[{method:'visa',amount:'80.25'}],cashReceived:'0'})).rejects.toMatchObject({code:'TABLE_OCCUPIED'});
 await expect(f.send({type:'table.save',expectedRevision:1,record:{...t,active:false}})).rejects.toMatchObject({code:'TABLE_OCCUPIED'});
 await f.send({type:'order.save',expectedRevision:1,draft:{...draft,tableId:t2.id}});
 await expect(f.send({type:'order.save',expectedRevision:1,draft})).rejects.toMatchObject({code:'REVISION_CONFLICT'});
 await f.send({type:'table.save',expectedRevision:1,record:{...t,active:false}});
 const moved={...draft,tableId:t2.id};
 await f.send({type:'order.pay',expectedRevision:2,draft:moved,payments:[{method:'visa',amount:'80.25'}],cashReceived:'0'});
 await f.send({type:'table.save',expectedRevision:1,record:{...t2,active:false}});
 await f.send({type:'order.amend',expectedRevision:3,draft:{...moved,note:'تحديث الملاحظة'},reason:'الطاولة معطلة الآن',payments:[],refunds:[],cashReceived:'0'});
 expect((await f.order(draft.id)).draft.tableId).toBe(t2.id);
 const delivery={...moved,service:'delivery',tableId:undefined,deliveryFee:undefined,customer:{name:'عميل',phone:'01012345678',address:'العنوان'}};
 await f.send({type:'order.amend',expectedRevision:4,draft:delivery,reason:'دليفري بدون رسوم',payments:[],refunds:[],cashReceived:'0'});
 expect(await f.order(draft.id)).toMatchObject({total:'80.25',draft:{service:'delivery',deliveryFee:'0'}});
 }finally{await f.db.close();}
});
it('collects a split payment once, changes a paid invoice in place, returns stock and closes the shift',async()=>{
 const f=await fixture();try{
 const draft=f.draft('2'),pay=f.command({type:'order.pay',draft,payments:[{method:'cash',amount:'60.50'},{method:'instapay',amount:'50'},{method:'visa',amount:'50'}],cashReceived:'100'});
 await postPOSOrder(f.db,f.access,pay);await postPOSOrder(f.db,f.access,pay);
 let s=await getSnapshot(f.db,f.access);expect(s.posOrders!.collections).toHaveLength(3);expect(s.posOrders!.collections.find(p=>p.method==='cash')!.cashChange).toBe('39.50');expect(s.balances.find(b=>b.locationId==='k2'&&b.itemId==='rice')!.quantity).toBe('8.000000');
 const original=await f.order(draft.id);
 const next={...draft,service:'delivery' as const,deliveryFee:'20',customer:{name:'عميل',phone:'01012345678',address:'العنوان'},lines:draft.lines.map(l=>({...l,quantity:'1'}))};
 const amend=f.command({type:'order.amend',expectedRevision:1,draft:next,reason:'تغيير نوع وكمية الطلب',payments:[],refunds:[{method:'visa',amount:'60.25'}],cashReceived:'0'});
 await postPOSOrder(f.db,f.access,amend);await postPOSOrder(f.db,f.access,amend);
 const updated=await f.order(draft.id);expect(updated.reference).toBe(original.reference);expect(updated.total).toBe('100.25');expect(updated.revision).toBe(2);
 s=await getSnapshot(f.db,f.access);expect(s.balances.find(b=>b.locationId==='k2'&&b.itemId==='rice')!.quantity).toBe('9.000000');expect(s.posOrders!.changes.at(-1)!.before!.total).toBe('160.50');expect(s.posOrders!.changes.at(-1)!.actor).toBe(f.access.userId);
 const report=await getReport(f.db,f.access,reportQuerySchema.parse({organizationId:f.access.organizationId,generation:s.generation,kind:'sales',posId:'p2',from:updated.businessDate,to:updated.businessDate}));expect(Number(report.current.sales)).toBe(100.25);
 await f.send({type:'order.amend',expectedRevision:2,draft:{...next,deliveryFee:'0',lines:[]},reason:'مرتجع كامل للطلب',payments:[],refunds:[{method:'cash',amount:'100.25'}],cashReceived:'0'});
 s=await getSnapshot(f.db,f.access);expect(s.balances.find(b=>b.locationId==='k2'&&b.itemId==='rice')!.quantity).toBe('10.000000');expect((await reconcileStock(f.db,f.access.organizationId)).every(r=>r.matches)).toBe(true);
 const shift=s.posOrders!.shifts[0];await f.send({type:'shift.close',shiftId:shift.id,countedCash:'60.25',note:'مراجعة الدرج'});
 const closed=(await getSnapshot(f.db,f.access)).posOrders!.shifts[0];expect(closed.expectedCash).toBe('60.25');expect(closed.difference).toBe('0.00');
 }finally{await f.db.close();}
});
it('rejects forged settlement, stale edits and cross-tenant commands atomically',async()=>{
 const f=await fixture();try{const draft=f.draft(),pay=f.command({type:'order.pay',draft,payments:[{method:'cash',amount:'80.25'}],cashReceived:'100'});
 await expect(postPOSOrder(f.db,{...f.access,organizationId:'bistro'},pay)).rejects.toMatchObject({code:'FORBIDDEN'});
 await expect(postPOSOrder(f.db,f.access,{...pay,cashReceived:'1'})).rejects.toMatchObject({code:'CASH_SHORT'});
 await expect(postPOSOrder(f.db,f.access,{...pay,draft:{...draft,lines:draft.lines.map(l=>({...l,unitPrice:'1'}))}})).rejects.toMatchObject({code:'PRICE_CHANGED'});
 expect((await getSnapshot(f.db,f.access)).posOrders!.orders).toHaveLength(0);
 await postPOSOrder(f.db,f.access,pay);
 await expect(postPOSOrder(f.db,f.access,{...pay,cashReceived:'101'})).rejects.toMatchObject({code:'PAYLOAD_CONFLICT'});
 await expect(f.send({type:'order.save',expectedRevision:1,draft})).rejects.toMatchObject({code:'ORDER_PAID'});
 }finally{await f.db.close();}
});
it('never repeats a shortage issue on metadata edits or returns stock that was not deducted',async()=>{
 const f=await fixture();try{await f.send({type:'shift.open',posId:'p1',openingCash:'0'});const draft=f.draft('3','p1');await f.send({type:'order.pay',draft,payments:[{method:'visa',amount:'240.75'}],cashReceived:'0'});
 const before=await getSnapshot(f.db,f.access);await f.send({type:'order.amend',expectedRevision:1,draft:{...draft,note:'ملاحظة جديدة'},reason:'تحديث الملاحظة',payments:[],refunds:[],cashReceived:'0'});
 expect((await getSnapshot(f.db,f.access)).balances).toEqual(before.balances);
 await f.send({type:'order.amend',expectedRevision:2,draft:{...draft,lines:[]},reason:'مرتجع الفاتورة بالكامل',payments:[],refunds:[{method:'visa',amount:'240.75'}],cashReceived:'0'});
 expect((await getSnapshot(f.db,f.access)).balances.find(b=>b.locationId==='k1'&&b.itemId==='rice')!.quantity).toBe('2.000000');
 }finally{await f.db.close();}
});
