import base from './playwright.config.js';
export default {
  ...base,
  testDir: './apps/web/e2e-api',
  outputDir: 'test-results/api-runs',
  workers: 1,
  webServer: {
    command: 'npm run dev:api-mode',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 30000,
  },
};
