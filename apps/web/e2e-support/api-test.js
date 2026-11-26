import { test as base, expect } from '@playwright/test';
// Freeze only the browser Date API, not timers or the server's session clock.
// Historical financial fixtures must not fall outside the default month later.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(new Date('2026-11-26T12:00:00Z'));
    await use(page);
  },
});
export { expect };
