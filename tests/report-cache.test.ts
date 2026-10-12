import 'fake-indexeddb/auto';
import {afterEach,it,expect,vi} from 'vitest';
import {reportQuerySchema,type Snapshot,type ReportResponse,type PeriodMetrics} from '@saas/contracts';
import {local,acceptSnapshot} from '../apps/web/src/offline';
import {cacheReport,cachedReport,fetchReport,reportKey,latestCachedReport} from '../apps/web/src/report-cache';
const generation=crypto.randomUUID(),query=reportQuerySchema.parse({organizationId:'client-a',generation,kind:'inventory',from:'2026-10-01',to:'2026-10-12'});
const snapshot:Snapshot={organizationId:'client-a',generation,organizationName:'Client',currency:'EGP',access:{organizationId:'client-a',userId:'owner',deviceId:crypto.randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()},locations:[],items:[],balances:[],layers:[],entries:[],acceptedOperationIds:[],fetchedAt:new Date().toISOString()};
const zero:PeriodMetrics={received:'0',reversed:'0',returned:'0',returnReference:'0',netReceived:'0',kitchen:'0',waste:'0',countIncrease:'0',countDecrease:'0',sales:'0',salesDeduction:'0',productionInput:'0',productionWaste:'0',estimatedSalesCost:null,estimatedMargin:null,foodCostPercent:null};
const report:ReportResponse={previousRange:{from:'2026-09-19',to:'2026-09-30'},current:zero,previous:zero,stock:{value:'0',items:0,low:0},charts:{daily:[],inventory:[],kitchens:[],suppliers:[],waste:[],sales:[],production:[]},schemaVersion:1,organizationId:'client-a',generation,generatedAt:'2026-10-12T12:00:00Z',checkpoint:'1:1',query,rows:[],total:0,page:1};
afterEach(async()=>{vi.unstubAllGlobals();await local.preferences.clear();await local.snapshots.clear();});
it('keeps complete reports across reload and isolates dates, pages, tenant and generation',async()=>{
 await acceptSnapshot(snapshot);await cacheReport(report,query);local.close();await local.open();expect(await cachedReport(query)).toEqual(report);
 for(const extra of [{to:'2026-10-11'},{page:2},{organizationId:'client-b'},{generation:crypto.randomUUID()}])expect(await cachedReport({...query,...extra})).toBeUndefined();
 await expect(cacheReport({...report,organizationId:'client-b'},query)).rejects.toThrow('لا يطابق');
 expect((await latestCachedReport(query))?.query).toEqual(query);
});
it('rejects stale responses after reset and removes old-generation cache on the next valid save',async()=>{
 await acceptSnapshot(snapshot);await cacheReport(report,query);const next=crypto.randomUUID();await acceptSnapshot({...snapshot,generation:next});await expect(cacheReport(report,query)).rejects.toThrow('تغيرت');
 const q={...query,generation:next};await cacheReport({...report,generation:next,query:q},q);expect(await cachedReport(query)).toBeUndefined();expect(await cachedReport(q)).toBeDefined();
});
it('preserves the cached report on authentication loss and rejects a mismatched server scope',async()=>{
 await acceptSnapshot(snapshot);await cacheReport(report,query);vi.stubGlobal('fetch',vi.fn(async()=>Response.json({message:'Session expired'},{status:401})));
 await expect(fetchReport(snapshot,query)).rejects.toThrow('Session expired');expect(await cachedReport(query)).toEqual(report);
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...report,organizationId:'client-b'})));await expect(fetchReport(snapshot,query)).rejects.toThrow('لا يطابق');expect(await cachedReport(query)).toEqual(report);
 await local.preferences.put({key:reportKey(query),value:'invalid JSON'});expect(await cachedReport(query)).toBeUndefined();
});
