// Shared engines pass serialized JSON parameters to both PGlite and Postgres.js.
// Postgres.js otherwise serializes those strings a second time for jsonb columns.
export function serializeDatabaseJson(value:unknown):string{
 if(typeof value==='string'){JSON.parse(value);return value;}
 const encoded=JSON.stringify(value);if(encoded===undefined)throw new TypeError('Undefined JSON database parameter');return encoded;
}
export function parseDatabaseJson(value:string):unknown{
 const decoded:unknown=JSON.parse(value);
 // Read documents written by the earlier adapter without changing their IDs/hashes.
 if(typeof decoded==='string'){try{return JSON.parse(decoded);}catch{return decoded;}}
 return decoded;
}
export const databaseJsonType={to:3802,from:[114,3802],serialize:serializeDatabaseJson,parse:parseDatabaseJson};
