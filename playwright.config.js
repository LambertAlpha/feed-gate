import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // 每个测试都启动一个独立的带扩展 Chromium，串行跑更稳定
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
});
