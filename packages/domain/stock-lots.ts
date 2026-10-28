import type {Snapshot} from '@saas/contracts';
import {decimal} from './index';
export function stockLots(snapshot:Snapshot,locationId:string,today:string,soonDays=30){
 const groups=new Map<string,{itemId:string;locationId:string;name:string;locationName:string;unit:string;originId:string|null;code:string|null;expiresOn:string|null;manufacturedOn:string|null;quantity:string}>();
 for(const layer of snapshot.layers.filter(l=>(!locationId||l.locationId===locationId)&&decimal(l.remaining).gt(0))){
  const lot=layer.lot,key=JSON.stringify([layer.locationId,layer.itemId,lot?.originId??null,lot?.code??null,lot?.expiresOn??null,lot?.manufacturedOn??null]),old=groups.get(key),item=snapshot.items.find(i=>i.id===layer.itemId);
  groups.set(key,{itemId:layer.itemId,locationId:layer.locationId,name:item?.name??layer.itemId,locationName:snapshot.locations.find(l=>l.id===layer.locationId)?.name??layer.locationId,unit:item?.unit??'',originId:lot?.originId??null,code:lot?.code??null,expiresOn:lot?.expiresOn??null,manufacturedOn:lot?.manufacturedOn??null,quantity:decimal(old?.quantity??'0').add(layer.remaining).toString()});
 }
 return [...groups.values()].map(r=>{const days=r.expiresOn?Math.floor((Date.parse(r.expiresOn)-Date.parse(today))/86400000):null;return {...r,days,status:!r.code?'untracked' as const:days===null?'unknownExpiry' as const:days<0?'expired' as const:days<=soonDays?'soon' as const:'valid' as const};}).sort((a,b)=>(a.days??Number.MAX_SAFE_INTEGER)-(b.days??Number.MAX_SAFE_INTEGER)||a.name.localeCompare(b.name,'ar'));
}
