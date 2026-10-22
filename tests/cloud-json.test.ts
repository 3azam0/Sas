import {it,expect} from 'vitest';
import {serializeDatabaseJson,parseDatabaseJson,databaseJsonType} from '../cloud/postgres-json';
it('stores serialized command results, recipe objects and purchase-unit arrays as JSON values',()=>{
 for(const value of [{operationId:'saved',outcome:'accepted'},{lines:[{quantity:'0.25'}]},[],[{factor:'12'}],null]){
  expect(JSON.parse(serializeDatabaseJson(JSON.stringify(value)))).toEqual(value);expect(parseDatabaseJson(serializeDatabaseJson(value))).toEqual(value);
 }
 expect(databaseJsonType.from).toEqual([114,3802]);expect(databaseJsonType.to).toBe(3802);expect(()=>serializeDatabaseJson('invalid')).toThrow();expect(()=>serializeDatabaseJson(undefined)).toThrow();
});
it('reads earlier double-encoded documents while keeping nested string fields unchanged',()=>{
 const result={outcome:'accepted',reason:'{"keep":"as text"}'};expect(parseDatabaseJson(JSON.stringify(JSON.stringify(result)))).toEqual(result);expect(parseDatabaseJson(JSON.stringify(result))).toEqual(result);expect(parseDatabaseJson(JSON.stringify('plain text'))).toBe('plain text');
});
