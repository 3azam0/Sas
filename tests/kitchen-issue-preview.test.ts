import {it,expect} from 'vitest';
import {issueStockPreview} from '../apps/web/src/kitchen-issue-preview';
it('shows exact remaining stock for fractional and Arabic quantities',()=>{
 expect(issueStockPreview('47.9','١٫٥')).toEqual({status:'ready',remaining:'46.4',shortage:null});
 expect(issueStockPreview('0.000003','0.000002')).toEqual({status:'ready',remaining:'0.000001',shortage:null});
});
it('distinguishes empty/invalid quantities from a valid zero remainder',()=>{
 expect(issueStockPreview('10','')).toEqual({status:'empty',remaining:null,shortage:null});
 for(const quantity of ['0','-1','wrong','1.0000001'])expect(issueStockPreview('10',quantity).status).toBe('invalid');
 expect(issueStockPreview('2','2')).toEqual({status:'ready',remaining:'0',shortage:null});
});
it('shows a shortage instead of claiming that negative stock can be issued',()=>{
 expect(issueStockPreview('0','2')).toEqual({status:'shortage',remaining:null,shortage:'2'});
 expect(issueStockPreview('1.1','2')).toEqual({status:'shortage',remaining:null,shortage:'0.9'});
});
