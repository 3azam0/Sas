import type {FinanceRecord,Snapshot,SalesLine} from '@saas/contracts';
import {decimal} from './index';

export function acceptedSaleLines(snapshot:Snapshot){return (snapshot.salesImports??[]).flatMap(p=>p.document.lines.filter(l=>p.acceptedLineIds.includes(l.lineId)).map(line=>({line,locationId:p.document.locationId,routing:p.routing})));}
export function remainingSale(line:SalesLine,records:FinanceRecord[]){let quantity=decimal(line.quantity),amount=decimal(line.netAmount);for(const r of records){const c=r.command;if(c.type==='sales.correct'&&c.saleLineId===line.lineId){quantity=quantity.sub(c.quantity);amount=amount.sub(r.amount);}}return {quantity:quantity.toString(),amount:amount.toString()};}
export function financeTotals(records:FinanceRecord[],from:string,to:string,locationId=''){
 let corrections=decimal('0'),expenses=decimal('0'),reversals=decimal('0');const categories=new Map<string,string>();
 for(const r of records){const c=r.command;if(c.businessDate<from||c.businessDate>to||locationId&&c.locationId!==locationId)continue;
  if(c.type==='sales.correct')corrections=corrections.add(r.amount);
  else {const sign=c.type==='expense.reverse'?-1:1,value=decimal(r.amount).mul(sign);if(sign===1)expenses=expenses.add(r.amount);else reversals=reversals.add(r.amount);const original=c.type==='expense.reverse'?records.find(e=>e.command.operationId===c.expenseId)?.command:c;const category=original?.type==='expense.post'?original.category:'مصروف معكوس';categories.set(category,decimal(categories.get(category)??'0').add(value).toString());}
 }
 return {corrections:corrections.toString(),expenses:expenses.toString(),expenseReversals:reversals.toString(),netExpenses:expenses.sub(reversals).toString(),categories:[...categories].map(([category,amount])=>({category,amount}))};
}
