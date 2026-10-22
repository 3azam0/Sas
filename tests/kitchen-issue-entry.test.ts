import {it,expect} from 'vitest';
import {commitIssueEntry,type IssueLine} from '../apps/web/src/kitchen-issue-entry';

const rows:IssueLine[]=[{lineId:'beef-line',itemId:'beef',quantity:'2'},{lineId:'rice-line',itemId:'rice',quantity:'0.1'}];

it('adds newest first without changing earlier rows and normalizes Arabic decimals',()=>{
 const result=commitIssueEntry(rows,{itemId:'oil',quantity:'١٫٥'},'10','oil-line');
 expect(result).toMatchObject({ok:true,action:'added',lines:[{lineId:'oil-line',itemId:'oil',quantity:'1.5'},...rows]});
 expect(rows).toHaveLength(2);
});
it('combines duplicates exactly, retaining identity and moving the existing row to the top',()=>{
 const result=commitIssueEntry(rows,{itemId:'rice',quantity:'0.2'},'10','unused');
 expect(result).toMatchObject({ok:true,action:'merged',lines:[{lineId:'rice-line',itemId:'rice',quantity:'0.3'},rows[0]]});
 expect(commitIssueEntry(rows,{itemId:'rice',quantity:'0.2'},'0.25','unused')).toEqual({ok:false,reason:'shortage'});
});
it('replaces an edited quantity instead of adding it and rejects stale or reassigned edits',()=>{
 expect(commitIssueEntry(rows,{itemId:'rice',quantity:'3'},'10','unused','rice-line')).toMatchObject({ok:true,action:'updated',lines:[{lineId:'rice-line',itemId:'rice',quantity:'3'},rows[0]]});
 expect(commitIssueEntry(rows,{itemId:'rice',quantity:'3'},'10','unused','removed')).toEqual({ok:false,reason:'missing-edit'});
 expect(commitIssueEntry(rows,{itemId:'beef',quantity:'3'},'10','unused','rice-line')).toEqual({ok:false,reason:'missing-edit'});
});
it('guards quantities, combined limits and shortages without altering the list',()=>{
 expect(commitIssueEntry(rows,{itemId:'',quantity:'1'},'10','new')).toEqual({ok:false,reason:'missing-item'});
 for(const quantity of ['', '0', '-1', 'x', '0.0000001'])expect(commitIssueEntry(rows,{itemId:'oil',quantity},'10','new')).toEqual({ok:false,reason:'invalid-quantity'});
 expect(commitIssueEntry(rows,{itemId:'oil',quantity:'11'},'10','new')).toEqual({ok:false,reason:'shortage'});
 expect(commitIssueEntry([{lineId:'max',itemId:'rice',quantity:'999999999'}],{itemId:'rice',quantity:'1'},'2000000000','new')).toEqual({ok:false,reason:'invalid-quantity'});
 expect(rows[1].quantity).toBe('0.1');
});
it('limits distinct items to 200 while still permitting merges and edits at the limit',()=>{
 const full=Array.from({length:200},(_,index)=>({lineId:'line-'+index,itemId:'item-'+index,quantity:'1'}));
 expect(commitIssueEntry(full,{itemId:'extra',quantity:'1'},'10','new')).toEqual({ok:false,reason:'capacity'});
 expect(commitIssueEntry(full,{itemId:'item-199',quantity:'1'},'10','new')).toMatchObject({ok:true,action:'merged',line:{lineId:'line-199',quantity:'2'}});
 expect(commitIssueEntry(full,{itemId:'item-199',quantity:'1'},'10','new','line-199')).toMatchObject({ok:true,action:'updated',line:{quantity:'1'}});
});
