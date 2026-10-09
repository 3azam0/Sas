import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/browser',timeout:60000,workers:1,use:{baseURL:process.env.TEST_ORIGIN||'http://127.0.0.1:3100',channel:'chrome',trace:'retain-on-failure'},reporter:'list'});
