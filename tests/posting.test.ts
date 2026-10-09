import {beforeAll,afterAll,beforeEach,describe,it,expect} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {createDatabase,getSnapshot,postCommand,seed} from '@saas/server';
import type {Access,Command} from '@saas/contracts';
let db:PGlite;
const access:Access={organizationId:'grills',userId:'test-owner',deviceId:randomUUID(),expiresAt:new Date(Date.now()+86400000).toISOString()};
function command(type:Command['type'],quantity:string,overrides:Partial<Command>={}):Command{return{operationId:randomUUID(),organizationId:'grills',locationId:'central',itemId:'beef',type,quantity,unitCost:type==='receipt.post'?'100':undefined,reason:'test reference',businessDate:'2026-10-09',capturedAt:new Date().toISOString(),schemaVersion:1,...overrides};}
beforeAll(async()=>{db=await createDatabase();await seed(db);});
beforeEach(async()=>{await db.exec("TRUNCATE audit_events, layer_allocations, command_receipts, stock_entries, cost_layers, stock_balances RESTART IDENTITY;");});
afterAll(async()=>{await db.close();});
describe('authoritative PostgreSQL posting',()=>{
 it('allocates FIFO independently of current purchase price',async()=>{
  await postCommand(db,access,command('receipt.post','10',{unitCost:'100'}));await postCommand(db,access,command('receipt.post','20',{unitCost:'130'}));
  const result=await postCommand(db,access,command('waste.post','6'));expect(result.amount).toBe('600.000000000000');
  const snapshot=await getSnapshot(db,access);const beef=snapshot.balances[0];expect(beef.quantity).toBe('24.000000');expect(beef.value).toBe('3000.000000000000');expect(Number(beef.average)).toBe(125);expect(snapshot.layers.map(l=>l.remaining)).toEqual(['4.000000','20.000000']);
 });
 it('retries the same operation exactly once, including concurrent delivery',async()=>{
  const c=command('receipt.post','10');const results=await Promise.all([postCommand(db,access,c),postCommand(db,access,c)]);expect(results[0]).toEqual(results[1]);
  const snapshot=await getSnapshot(db,access);expect(snapshot.entries).toHaveLength(1);expect(snapshot.balances[0].quantity).toBe('10.000000');
  await expect(postCommand(db,access,{...c,quantity:'11'})).rejects.toMatchObject({code:'PAYLOAD_CONFLICT'});
 });
 it('rejects overdrawing concurrent issues without partial writes',async()=>{
  await postCommand(db,access,command('receipt.post','10'));
  const results=await Promise.allSettled([postCommand(db,access,command('waste.post','8')),postCommand(db,access,command('waste.post','7'))]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const snapshot=await getSnapshot(db,access);expect(snapshot.entries).toHaveLength(2);expect(Number(snapshot.balances[0].quantity)).toBeGreaterThanOrEqual(0);expect(snapshot.layers.reduce((n,l)=>n+Number(l.remaining),0)).toBe(Number(snapshot.balances[0].quantity));
 });
 it('rolls back entries, layers and balances when a later audit write fails',async()=>{
  await db.exec("ALTER TABLE audit_events ADD CONSTRAINT reject_fault CHECK(action <> 'receipt.post');");
  await expect(postCommand(db,access,command('receipt.post','10'))).rejects.toThrow();
  const snapshot=await getSnapshot(db,access);expect(snapshot.entries).toHaveLength(0);expect(snapshot.layers).toHaveLength(0);expect(snapshot.balances).toHaveLength(0);expect(snapshot.acceptedOperationIds).toHaveLength(0);
  await db.exec('ALTER TABLE audit_events DROP CONSTRAINT reject_fault;');
 });
 it('prevents cross-tenant writes and isolates snapshots',async()=>{
  await expect(postCommand(db,access,command('receipt.post','10',{organizationId:'bistro'}))).rejects.toMatchObject({code:'FORBIDDEN'});
  await postCommand(db,access,command('receipt.post','10'));const other=await getSnapshot(db,{...access,organizationId:'bistro'});expect(other.entries).toHaveLength(0);expect(other.balances).toHaveLength(0);
 });
 it('rejects invalid location, invalid quantities and expired access',async()=>{
  await expect(postCommand(db,access,command('receipt.post','10',{locationId:'unknown'}))).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(postCommand(db,access,command('receipt.post','-1'))).rejects.toMatchObject({code:'INVALID_COMMAND'});
  await expect(postCommand(db,{...access,expiresAt:'2020-01-01T00:00:00Z'},command('receipt.post','1'))).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('preserves fractional costs without floating point arithmetic',async()=>{
  await postCommand(db,access,command('receipt.post','0.100001',{unitCost:'0.200003'}));const result=await postCommand(db,access,command('waste.post','0.100001'));expect(result.amount).toBe('0.020000500003');expect((await getSnapshot(db,access)).balances[0].value).toBe('0.000000000000');
 });
});
