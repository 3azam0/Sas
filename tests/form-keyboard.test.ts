import {it,expect} from 'vitest';
import {formKeyIntent} from '../apps/web/src/form-keyboard';
it('ordinary Enter navigates fields without submitting; Shift+Enter moves back',()=>{
 for(const kind of ['text','number','email','password','date','select']){expect(formKeyIntent({key:'Enter'},kind)).toBe('next');expect(formKeyIntent({key:'Enter',shiftKey:true},kind)).toBe('previous');}
});
it('preserves multiline, pickers and buttons while preventing implicit checkbox/search submission',()=>{
 for(const kind of ['textarea','file','button'])expect(formKeyIntent({key:'Enter'},kind)).toBe('native');
 for(const kind of ['checkbox','radio','search'])expect(formKeyIntent({key:'Enter'},kind)).toBe('next');
 expect(formKeyIntent({key:' ',ctrlKey:false},'checkbox')).toBe('native');expect(formKeyIntent({key:'Enter',isComposing:true},'text')).toBe('native');
});
it('explicit submit and add shortcuts are blocked while busy or held down',()=>{
 for(const modifier of ['ctrlKey','metaKey']){expect(formKeyIntent({key:'Enter',[modifier]:true},'text')).toBe('submit');expect(formKeyIntent({key:'Enter',[modifier]:true},'text',true)).toBe('ignore');expect(formKeyIntent({key:'Enter',[modifier]:true,repeat:true},'text')).toBe('ignore');}
 expect(formKeyIntent({key:'Insert',altKey:true},'text')).toBe('add');expect(formKeyIntent({key:'Insert',altKey:true},'text',true)).toBe('ignore');expect(formKeyIntent({key:'Enter',repeat:true},'text')).toBe('ignore');
});
