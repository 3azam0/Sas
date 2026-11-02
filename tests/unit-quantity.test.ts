import {expect,it} from 'vitest';
import {quantityInBase,quantityUnits} from '../apps/web/src/UnitQuantityInput';
it('converts entered units to canonical stock quantities precisely',()=>{expect(quantityInBase('2500','0.001')).toBe('2.5');expect(quantityInBase('2.5','1000')).toBe('2500');expect(quantityInBase('0.000001','0.001')).toBe('');expect(quantityInBase('0','1')).toBe('0');expect(quantityInBase('','1')).toBe('');});
it('offers compatible dimensions and defined packs without treating kilograms as litres',()=>{expect(quantityUnits('كجم').map(u=>u.id)).toEqual(['base','g']);expect(quantityUnits('لتر').map(u=>u.id)).toEqual(['base','ml']);expect(quantityUnits('قطعة',[{id:'box',name:'علبة 12',factor:'12'}]).map(u=>u.factor)).toEqual(['1','12']);});
