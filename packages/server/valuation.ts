import type {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {BusinessError} from '@saas/contracts';
import {decimal} from '@saas/domain';

export type Tx=Parameters<Parameters<PGlite['transaction']>[0]>[0];
export type Posting={operationId:string;type:string;reason:string;businessDate:string};
type Head={id:string;value:string};
const key=(location:string,item:string)=>JSON.stringify([location,item]);
export async function valueNode(tx:Tx,org:string,value:string){const id=randomUUID();await tx.query('INSERT INTO valuation_nodes VALUES($1,$2,$3)',[org,id,value]);return id;}
async function edge(tx:Tx,org:string,parent:string,child:string,share:string){await tx.query('INSERT INTO valuation_edges VALUES($1,$2,$3,$4)',[org,parent,child,share]);}
export async function nodeValue(tx:Tx,org:string,id:string){const r=await tx.query<{value:string}>('SELECT value::text FROM valuation_nodes WHERE organization_id=$1 AND id=$2',[org,id]);if(!r.rows[0])throw new BusinessError('INVALID_COMMAND','مرجع تكلفة غير متاح');return r.rows[0].value;}
export async function poolHead(tx:Tx,org:string,kind:string,owner:string):Promise<Head|undefined>{const r=await tx.query<Head>('SELECT n.id,n.value::text FROM valuation_heads h JOIN valuation_nodes n ON n.organization_id=h.organization_id AND n.id=h.node_id WHERE h.organization_id=$1 AND h.kind=$2 AND h.owner=$3',[org,kind,owner]);return r.rows[0];}
async function setHead(tx:Tx,org:string,kind:string,owner:string,id:string){await tx.query('INSERT INTO valuation_heads VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,kind,owner) DO UPDATE SET node_id=excluded.node_id',[org,kind,owner,id]);}
export async function addPool(tx:Tx,org:string,kind:string,owner:string,source:string){
 const prior=await poolHead(tx,org,kind,owner),value=await nodeValue(tx,org,source);
 const id=await valueNode(tx,org,decimal(prior?.value||'0').add(value).toFixed(12));
 if(prior)await edge(tx,org,prior.id,id,'1');await edge(tx,org,source,id,'1');await setHead(tx,org,kind,owner,id);return id;
}
export async function takePool(tx:Tx,org:string,kind:string,owner:string,amount:string,quantityRatio?:string){
 const prior=await poolHead(tx,org,kind,owner);const value=decimal(prior?.value||'0'),take=decimal(amount);
 if(!prior||take.lt(0)||take.gt(value))throw new BusinessError('INSUFFICIENT_VALUE','قيمة الدفعة لا تكفي؛ راجع الاستلام والتكاليف');
 const ratio=quantityRatio!==undefined?decimal(quantityRatio):(value.isZero()?decimal('0'):take.div(value));
 const out=await valueNode(tx,org,take.toFixed(12)),remaining=await valueNode(tx,org,value.sub(take).toFixed(12));
 await edge(tx,org,prior.id,out,ratio.toFixed(30));await edge(tx,org,prior.id,remaining,decimal('1').sub(ratio).toFixed(30));await setHead(tx,org,kind,owner,remaining);return out;
}
export async function refreshStockPool(tx:Tx,org:string,location:string,item:string,sequence:string){
 const r=await tx.query<{quantity:string;value:string}>('SELECT quantity::text,value::text FROM stock_balances WHERE organization_id=$1 AND location_id=$2 AND item_id=$3',[org,location,item]);const b=r.rows[0];
 await tx.query('UPDATE cost_layers SET remaining=0,remaining_value=0 WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 AND remaining>0',[org,location,item]);
 if(b&&decimal(b.quantity).gt(0))await tx.query('INSERT INTO cost_layers(organization_id,id,location_id,item_id,remaining,unit_cost,sequence,remaining_value) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[org,randomUUID(),location,item,b.quantity,decimal(b.value).div(b.quantity).toFixed(24),sequence,b.value]);
}
export async function stockMove(tx:Tx,org:string,p:Posting,location:string,item:string,quantity:string,receiptValue?:string,sourceNode?:string){
 const q=decimal(quantity);await tx.query('INSERT INTO stock_balances VALUES($1,$2,$3,0,0) ON CONFLICT DO NOTHING',[org,location,item]);
 const result=await tx.query<{quantity:string;value:string}>('SELECT quantity::text,value::text FROM stock_balances WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 FOR UPDATE',[org,location,item]);const old=result.rows[0];
 if(q.lt(0)&&q.neg().gt(old.quantity))throw new BusinessError('INSUFFICIENT_STOCK','الرصيد المتاح لا يكفي؛ راجع الكمية والموقع');
 const owner=key(location,item);if(!await poolHead(tx,org,'stock',owner))await setHead(tx,org,'stock',owner,await valueNode(tx,org,old.value));
 let amount:string,node:string;
 if(q.gt(0)){
  if(receiptValue===undefined||decimal(receiptValue).lt(0))throw new BusinessError('INVALID_COMMAND','قيمة الاستلام غير صالحة');
  amount=decimal(receiptValue).toFixed(12);node=sourceNode||await valueNode(tx,org,amount);
  if(!decimal(await nodeValue(tx,org,node)).eq(amount))throw new BusinessError('INVALID_COMMAND','قيمة مرجع التكلفة لا تطابق الاستلام');
  await addPool(tx,org,'stock',owner,node);
 }else{
  if(!q.lt(0))throw new BusinessError('INVALID_COMMAND','الكمية يجب أن تختلف عن صفر');
  const take=q.neg();amount=take.eq(old.quantity)?old.value:decimal(old.value).mul(take).div(old.quantity).toFixed(12);
  node=await takePool(tx,org,'stock',owner,amount,take.div(old.quantity).toFixed(30));
  const layers=await tx.query<{id:string}>('SELECT id FROM cost_layers WHERE organization_id=$1 AND location_id=$2 AND item_id=$3 AND remaining>0 ORDER BY sequence DESC LIMIT 1',[org,location,item]);
  // Allocation is an audit reference to the previous average pool, never a FIFO issue.
  if(layers.rows[0])await tx.query('INSERT INTO layer_allocations VALUES($1,$2,$3,$4,$5)',[org,p.operationId,layers.rows[0].id,take.toFixed(6),amount]);
 }
 const signed=q.gt(0)?amount:decimal(amount).neg().toFixed(12);
 const entry=await tx.query<{sequence:string}>('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING sequence',[org,p.operationId,location,item,q.toFixed(6),signed,p.type,p.reason,p.businessDate]);
 await tx.query('UPDATE stock_balances SET quantity=quantity+$4::numeric,value=value+$5::numeric WHERE organization_id=$1 AND location_id=$2 AND item_id=$3',[org,location,item,q.toFixed(6),signed]);
 await refreshStockPool(tx,org,location,item,entry.rows[0].sequence);return {amount,node};
}

// A receipt-cost correction follows the immutable value-flow graph. Each split
// forwards its proportion into present stock, transit, WIP or consumed expense.
// Historical quantity movements and the original receipt amounts are retained.
export async function adjustNode(tx:Tx,org:string,root:string,delta:string,p:Posting){
 const nodes=await tx.query<{id:string;value:string}>('SELECT id,value::text FROM valuation_nodes WHERE organization_id=$1',[org]);
 const edges=await tx.query<{parent_id:string;child_id:string;share:string}>('SELECT parent_id,child_id,share::text FROM valuation_edges WHERE organization_id=$1',[org]);
 const children=new Map<string,typeof edges.rows>();const indegree=new Map(nodes.rows.map(n=>[n.id,0]));
 for(const e of edges.rows){children.set(e.parent_id,[...(children.get(e.parent_id)||[]),e]);indegree.set(e.child_id,(indegree.get(e.child_id)||0)+1);}
 const queue=nodes.rows.filter(n=>indegree.get(n.id)===0).map(n=>n.id),changes=new Map<string,string>([[root,delta]]);let visited=0;
 for(let i=0;i<queue.length;i++){
  const id=queue[i];visited++;const change=changes.get(id);
  for(const e of children.get(id)||[]){if(change){const v=decimal(change).mul(e.share).toDecimalPlaces(12);changes.set(e.child_id,decimal(changes.get(e.child_id)||'0').add(v).toFixed(12));}const n=indegree.get(e.child_id)!-1;indegree.set(e.child_id,n);if(n===0)queue.push(e.child_id);}
 }
 if(visited!==nodes.rows.length||!nodes.rows.some(n=>n.id===root))throw new BusinessError('INVALID_COMMAND','تعذر تسوية روابط التكلفة');
 const closed=await tx.query<{data:{issues:{node:string}[]}}>("SELECT data FROM production_batches WHERE organization_id=$1 AND data->>'status'='closed'",[org]);
 if(closed.rows.some(b=>b.data.issues.some(i=>changes.has(i.node)&&!decimal(changes.get(i.node)!).isZero())))throw new BusinessError('DEPENDENT_BATCH_CLOSED','التكلفة تخص مواد استهلكتها دفعة مغلقة؛ أغلق الدفعة المصدر قبل الدفعات التابعة');
 for(const n of nodes.rows){const d=changes.get(n.id);if(d&&decimal(d).isZero()===false){const value=decimal(n.value).add(d);if(value.lt(0))throw new BusinessError('INVALID_COMMAND','التسوية تجعل قيمة مخزون أو إنتاج سالبة؛ راجع التكلفة المؤقتة');await tx.query('UPDATE valuation_nodes SET value=$3 WHERE organization_id=$1 AND id=$2',[org,n.id,value.toFixed(12)]);}}
 const heads=await tx.query<{kind:string;owner:string;node_id:string}>('SELECT kind,owner,node_id FROM valuation_heads WHERE organization_id=$1',[org]);
 let applied=decimal('0');
 for(const h of heads.rows){const d=changes.get(h.node_id);if(!d||decimal(d).isZero())continue;applied=applied.add(d);
  if(h.kind==='wip'){
   const batch=await tx.query<{status:string}>("SELECT data->>'status' AS status FROM production_batches WHERE organization_id=$1 AND id=$2",[org,h.owner]);
   if(batch.rows[0]?.status==='closed')throw new BusinessError('DEPENDENT_BATCH_CLOSED','أغلق الدفعة المصدر قبل الدفعة التابعة؛ التسوية ستغير تكلفة دفعة مغلقة');
  }
  if(h.kind==='stock'){
   const [location,item]=JSON.parse(h.owner) as [string,string];
   await tx.query('UPDATE stock_balances SET value=value+$4::numeric WHERE organization_id=$1 AND location_id=$2 AND item_id=$3',[org,location,item,d]);
   const e=await tx.query<{sequence:string}>('INSERT INTO stock_entries(organization_id,operation_id,location_id,item_id,quantity,amount,type,reason,business_date) VALUES($1,$2,$3,$4,0,$5,$6,$7,$8) RETURNING sequence',[org,randomUUID(),location,item,d,'production.cost.adjust',`${p.reason} · ${p.operationId}`,p.businessDate]);
   await refreshStockPool(tx,org,location,item,e.rows[0].sequence);
  }
  if(h.kind==='transit')await tx.query('UPDATE transfers SET remaining_value=remaining_value+$3::numeric WHERE organization_id=$1 AND id=$2',[org,h.owner,d]);
  await tx.query('INSERT INTO cost_adjustments VALUES($1,$2,$3,$4,$5,$6,$7)',[org,randomUUID(),p.operationId,h.kind,h.owner,d,h.node_id]);
 }
 // Expense terminals have no current head; make their final difference inspectable.
 await tx.query('UPDATE transfers t SET amount=n.value FROM valuation_nodes n WHERE t.organization_id=$1 AND n.organization_id=t.organization_id AND n.id=t.valuation_node',[org]);
 const remainder=decimal(delta).sub(applied);if(!remainder.isZero())await tx.query('INSERT INTO cost_adjustments VALUES($1,$2,$3,$4,$5,$6,$7)',[org,randomUUID(),p.operationId,'consumed','issued or consumed',remainder.toFixed(12),root]);
}
