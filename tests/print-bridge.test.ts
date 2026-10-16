import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {helperOrigin,pairPrintHelper,helperPrinters,printJobStatus,helperToken,forgetHelper,sendPrintPacket,printRecordKey,savePrintReceipt,readPrintReceipt,printSubmissionFailure,PrintBridgeError,type PrintPacket,type PrintReceipt} from '../apps/web/src/print-bridge';
import {printSliceEnd} from '../apps/web/src/print-capture';
let storage:Map<string,string>;
beforeEach(()=>{storage=new Map();vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)});});
afterEach(()=>vi.unstubAllGlobals());
const receipt:PrintReceipt={id:'00000000-0000-4000-8000-000000000001',organizationId:'grills',status:'unknown',title:'استلام مواد',createdAt:'2026-10-16T10:00:00Z',message:'pending'};
const pair=()=>pairPrintHelper('grills','abcdefgh');
const ok=(value:unknown,status=200)=>Promise.resolve(Response.json(value,{status}));
const pairResponse={service:'foodo-print',protocol:1,platform:'windows',organizationId:'grills',token:'a'.repeat(43)};
describe('Windows print helper browser contract',()=>{
 it('pairs only with the compatible service and stores a token per organization',async()=>{
  const fetch=vi.fn(()=>ok(pairResponse));vi.stubGlobal('fetch',fetch);await pair();expect(helperToken('grills')).toHaveLength(43);expect(helperToken('other')).toBe('');
  const [url,request]=fetch.mock.calls[0] as unknown as [string,RequestInit];expect(url).toBe(helperOrigin+'/v1/pair');expect(JSON.parse(request.body as string).code).toBe('ABCDEFGH');expect(request.credentials).toBe('omit');
  forgetHelper('grills');expect(helperToken('grills')).toBe('');
 });
 it('does not trust a different local service or send an unpaired print request',async()=>{
  const fetch=vi.fn(()=>ok({...pairResponse,platform:'android'}));vi.stubGlobal('fetch',fetch);await expect(pair()).rejects.toThrow('غير متوافق');expect(helperToken('grills')).toBe('');
  await expect(helperPrinters('grills')).rejects.toMatchObject({code:'PAIR_REQUIRED'});expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('validates configured printer profiles and attaches the scoped token without cookies',async()=>{
  const fetch=vi.fn().mockImplementationOnce(()=>ok(pairResponse)).mockImplementationOnce(()=>ok({protocol:1,printers:[{id:'roll80',paper:'roll80',name:'Xprinter queue',widthDots:576}]}));vi.stubGlobal('fetch',fetch);await pair();expect((await helperPrinters('grills'))[0].widthDots).toBe(576);
  const request=fetch.mock.calls[1][1] as RequestInit;expect(request.headers).toMatchObject({'X-FooDo-Organization':'grills','X-FooDo-Token':'a'.repeat(43)});expect(request.credentials).toBe('omit');
  fetch.mockImplementationOnce(()=>ok({protocol:1,printers:[{id:'roll80',paper:'roll80',name:'Bad',widthDots:999999}]}));await expect(helperPrinters('grills')).rejects.toThrow('غير صالحة');
 });
 it('submits the same job ID unchanged and rejects cross-scope acceptance receipts',async()=>{
  const fetch=vi.fn().mockImplementationOnce(()=>ok(pairResponse)).mockImplementationOnce(()=>ok({...receipt,status:'queued'},202)).mockImplementationOnce(()=>ok({...receipt,organizationId:'other'}));vi.stubGlobal('fetch',fetch);await pair();
  const packet:PrintPacket={version:1,id:receipt.id,organizationId:'grills',title:receipt.title,paper:'roll80',orientation:'portrait',printerId:'roll80',createdAt:receipt.createdAt,pages:[{width:8,height:1,png:'image'}]};expect((await sendPrintPacket(packet)).status).toBe('queued');expect(JSON.parse(fetch.mock.calls[1][1].body).id).toBe(receipt.id);
  await expect(printJobStatus('grills',receipt.id)).rejects.toThrow('تأكيد');
 });
 it('keeps local job references scoped by document, organization and paper',()=>{
  const key=printRecordKey('grills','receipt1','a4');savePrintReceipt(key,receipt);expect(readPrintReceipt(key)).toEqual(receipt);expect(readPrintReceipt(printRecordKey('other','receipt1','a4'))).toBeNull();expect(readPrintReceipt(printRecordKey('grills','receipt1','roll80'))).toBeNull();
 });
 it('marks explicit pre-submission rejection failed but never turns a lost result into a safe retry',()=>{
  expect(printSubmissionFailure(receipt,false,new PrintBridgeError('No printer',409,'PRINTER_MISSING')).status).toBe('failed');
  expect(printSubmissionFailure(receipt,false,new TypeError('Network lost')).status).toBe('unknown');
  expect(printSubmissionFailure(receipt,true,new PrintBridgeError('Not found',404,'JOB_UNKNOWN')).status).toBe('unknown');
  expect(printSubmissionFailure(receipt,false,new PrintBridgeError('Conflict',409,'JOB_CONFLICT')).status).toBe('unknown');
 });
 it('cuts pages before rows/charts, while making progress through oversized blocks',()=>{
  expect(printSliceEnd(0,100,200,[{top:80,bottom:120}])).toBe(80);
  expect(printSliceEnd(80,100,200,[{top:80,bottom:120}])).toBe(180);
  expect(printSliceEnd(0,100,500,[{top:0,bottom:400}])).toBe(100);
  expect(printSliceEnd(180,100,200,[])).toBe(200);
 });
});
