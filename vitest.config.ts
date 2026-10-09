import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({resolve:{alias:{'@saas/contracts':resolve('packages/contracts/index.ts'),'@saas/domain':resolve('packages/domain/index.ts'),'@saas/server':resolve('packages/server/index.ts')}}, test:{include:['tests/**/*.test.ts'],testTimeout:30000,hookTimeout:30000,maxWorkers:1}});
