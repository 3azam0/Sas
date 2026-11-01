import {it,expect} from 'vitest';
import {postSetupCommand,getSnapshot} from '@saas/server';
import {randomUUID} from 'node:crypto';
import {counterPOSFixture} from './fixtures/counter-pos';
import {checkoutCart,refreshEmptyPOSCart} from '../packages/domain/pos';
import {deviceSelectionKey,validDeviceSelection} from '../apps/web/src/useDeviceSelection';

it('separates device choices by terminal/screen, tenant and data generation',()=>{
 const keys=[deviceSelectionKey('pos','a','one'),deviceSelectionKey('kitchen','a','one'),deviceSelectionKey('pos','b','one'),deviceSelectionKey('pos','a','two'),deviceSelectionKey('pos','a')];
 expect(new Set(keys).size).toBe(keys.length);
 expect(deviceSelectionKey('pos','a:b','c')).not.toBe(deviceSelectionKey('pos','a','b:c'));
});
it('restores a valid saved choice but never silently switches an unavailable saved terminal',()=>{
 expect(validDeviceSelection('p2',['p1','p2'])).toBe('p2');
 expect(validDeviceSelection('p2',['p1'])).toBe('');
 expect(validDeviceSelection('',['p1','p2'])).toBe('');
 expect(validDeviceSelection(null,['p1','p2'])).toBe('p1');
 expect(validDeviceSelection(null,[])).toBe('');
});
it('updates only empty draft routing after a terminal correction while preserving filled drafts',async()=>{
 const f=await counterPOSFixture();
 try{
  const filled=f.cart(),empty={...filled,revision:4,label:'Saved empty draft',lines:[]};
  expect(refreshEmptyPOSCart(f.snapshot,empty)).toBe(empty);
  await postSetupCommand(f.db,f.access,{operationId:randomUUID(),organizationId:'grills',generation:f.snapshot.generation,type:'pos.save',expectedRevision:1,record:{id:'p1',name:'كاشير البحري',source:'POS',kitchenId:'k2',active:true},capturedAt:new Date().toISOString(),schemaVersion:1});
  const latest=await getSnapshot(f.db,f.access),updated=refreshEmptyPOSCart(latest,empty);
  expect(updated).toMatchObject({id:empty.id,revision:4,label:empty.label,posId:'p1',posRevision:2,kitchenId:'k2',locationId:'k2',source:'POS',lines:[]});
  expect(empty.kitchenId).toBe('k1');
  expect(refreshEmptyPOSCart(latest,filled)).toBe(filled);
  expect(()=>checkoutCart(latest,filled,'100')).toThrow();
 }finally{await f.db.close();}
});
it('refuses to align an empty draft from another tenant or generation',async()=>{
 const f=await counterPOSFixture();
 try{
  const empty={...f.cart(),lines:[]};
  expect(()=>refreshEmptyPOSCart({...f.snapshot,organizationId:'other'},empty)).toThrow();
  expect(()=>refreshEmptyPOSCart({...f.snapshot,generation:'changed'},empty)).toThrow();
 }finally{await f.db.close();}
});
