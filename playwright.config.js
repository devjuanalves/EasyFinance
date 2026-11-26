import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './apps/web/e2e',
  outputDir: 'test-results/demo-runs',
  fullyParallel: true,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['./scripts/ci/reporter.js']] : 'list',
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: 'http://localhost:5173',
    trace: process.env.CI ? 'off' : 'retain-on-failure',
    timezoneId: 'UTC',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command:
        'NODE_ENV=development API_MODE=demo API_PORT=3001 WEB_ORIGIN=http://localhost:5173 npm run dev:api',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command:
        'NODE_ENV=development VITE_AUTH_MODE=mock VITE_API_URL=http://localhost:3001 npm run dev:web',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
