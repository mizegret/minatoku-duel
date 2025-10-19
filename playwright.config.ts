import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  reporter: 'list',
  webServer: {
    command: 'npm run front:dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    headless: true,
    baseURL: 'http://localhost:5173',
  },
});
