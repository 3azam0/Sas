import {it,expect} from 'vitest';
import {receivingUnitFactor} from '../packages/domain/receiving';

it.each([
 ['كجم','جرام','0.001'],['جرام','كجم','1000'],['لتر','ملليلتر','0.001'],['ملليلتر','لتر','1000'],
 [' kg ','كجم','1'],['لتر','لتر','1'],['كجم','عدد',undefined],['كجم','لتر',undefined],['رول','لوح',undefined]
])('converts %s from %s without inventing package contents', (base,entered,expected)=>{
 expect(receivingUnitFactor(base,entered)).toBe(expected);
});
