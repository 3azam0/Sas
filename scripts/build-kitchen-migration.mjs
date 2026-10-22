import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {kitchenInventoryMigrationSql} from './kitchen-inventory-migration.mjs';
const {kitchenInventoryMigration}=await import(pathToFileURL(process.cwd()+'/.cloud-build/schema.mjs').href);
if(typeof kitchenInventoryMigration!=='string'||!kitchenInventoryMigration.includes('CREATE TABLE IF NOT EXISTS points_of_sale'))throw new Error('Kitchen SQL body missing from compiled schema');
await writeFile('.cloud-build/kitchen-inventory-migration.sql',kitchenInventoryMigrationSql(kitchenInventoryMigration));
console.log('Kitchen inventory migration prepared; apply through the migration API after checks.');
