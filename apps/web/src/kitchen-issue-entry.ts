import {quantitySchema} from '@saas/contracts';
import {decimal} from '@saas/domain';
import {normalizeNumber} from '../../../packages/domain/opening-import';

export type IssueLine={lineId:string;itemId:string;quantity:string};
export type IssueEntry={itemId:string;quantity:string};
type EntryFailure='missing-item'|'invalid-quantity'|'capacity'|'shortage'|'missing-edit';
type EntryResult={ok:false;reason:EntryFailure}|{ok:true;lines:IssueLine[];line:IssueLine;action:'added'|'merged'|'updated'};

/** A receipt-list change only. Stock is posted by the document save/sync workflow. */
export function commitIssueEntry(lines:IssueLine[],entry:IssueEntry,available:string,newLineId:string,editingLineId?:string|null):EntryResult{
 if(!entry.itemId)return {ok:false,reason:'missing-item'};
 const parsed=quantitySchema.safeParse(normalizeNumber(entry.quantity));
 if(!parsed.success)return {ok:false,reason:'invalid-quantity'};
 const editing=editingLineId?lines.find(line=>line.lineId===editingLineId):undefined;
 if(editingLineId&&(!editing||editing.itemId!==entry.itemId))return {ok:false,reason:'missing-edit'};
 const existing=editing??lines.find(line=>line.itemId===entry.itemId);
 if(!existing&&lines.length>=200)return {ok:false,reason:'capacity'};
 const quantity=existing&&!editing?decimal(existing.quantity).add(parsed.data).toString():parsed.data;
 if(!quantitySchema.safeParse(quantity).success)return {ok:false,reason:'invalid-quantity'};
 if(decimal(quantity).gt(available))return {ok:false,reason:'shortage'};
 const line={lineId:existing?.lineId??newLineId,itemId:entry.itemId,quantity};
 return {ok:true,lines:[line,...lines.filter(row=>row.lineId!==line.lineId)],line,action:editing?'updated':existing?'merged':'added'};
}
