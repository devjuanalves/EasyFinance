import base from './playwright.config.js';
export default {
  ...base,
  testDir: './apps/web/e2e-api',
  outputDir: 'test-results/api-runs',
  workers: 1,
  webServer: base.webServer.map((server, index) => ({
    ...server,
    command:
      index === 0
        ? server.command.replace('API_MODE=demo', 'API_MODE=api')
        : server.command.replace('VITE_AUTH_MODE=mock', 'VITE_AUTH_MODE=api'),
  })),
};
