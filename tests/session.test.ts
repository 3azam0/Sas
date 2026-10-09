import {afterEach,it,expect} from 'vitest';
import {guardOrigin} from '../packages/server/session';
afterEach(()=>{delete process.env.SAAS_APP_ORIGIN;});
it('uses the configured browser origin when Next normalizes its internal URL',()=>{
 process.env.SAAS_APP_ORIGIN='http://127.0.0.1:3101';
 expect(()=>guardOrigin(new Request('http://localhost:3101/api/v1/commands',{headers:{origin:'http://127.0.0.1:3101',host:'127.0.0.1:3101'}}))).not.toThrow();
});
it('rejects cross-site requests and host mismatch',()=>{
 process.env.SAAS_APP_ORIGIN='http://127.0.0.1:3101';
 const cases:Record<string,string>[]=[{origin:'https://other.example',host:'127.0.0.1:3101'},{origin:'http://127.0.0.1:3101',host:'other.example'},{host:'127.0.0.1:3101'}];
 for(const headers of cases)
  expect(()=>guardOrigin(new Request('http://localhost:3101/api/v1/commands',{headers}))).toThrow();
});
