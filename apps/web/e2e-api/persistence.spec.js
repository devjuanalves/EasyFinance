import { test, expect } from '../e2e-support/api-test.js';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
test('real API registration, login, onboarding and persistent ledger across refresh', async ({
  page,
}, testInfo) => {
  const email = `browser-${randomUUID()}@example.test`,
    password = 'Fictional-browser-password!';
  await mkdir('test-results/block9a-layouts', { recursive: true });
  const errors = [];
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      !(
        message.location().url.includes('/api/v1/auth/session') &&
        message.text().includes('401')
      )
    )
      errors.push(message.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  // An anonymous session probe is expected to return 401; no unexpected server errors.
  page.on('response', (r) => {
    if (r.url().includes('/api/v1') && r.status() >= 500)
      errors.push(`API ${r.status()}`);
  });
  await page.goto('/signup');
  await page
    .getByLabel('Full name', { exact: true })
    .fill('Browser Persistence Tester');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox').check();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible();
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/onboarding/);
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: /Continue/ }).click();
  await page
    .getByRole('button', { name: /Start|Finish|Go to|Complete/ })
    .click();
  await expect(page).toHaveURL('http://localhost:5173/');
  await page.goto('/expenses/transactions');
  await expect(
    page.getByRole('heading', { name: 'Transactions', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Persistent workspace')).toContainText('owner');
  await page
    .getByRole('button', {
      name:
        testInfo.project.name === 'desktop'
          ? '＋ Add Record'
          : '＋ Add Transaction',
      exact: true,
    })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Signed amount', { exact: true }).fill('-12.34');
  await dialog
    .getByLabel('Description', { exact: true })
    .fill('Persistent browser expense');
  await page.screenshot({
    path: `test-results/block9a-layouts/${testInfo.project.name}-editor.png`,
  });
  await dialog.getByRole('button', { name: 'Save Transaction' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page
      .locator('article strong')
      .filter({ hasText: /^Persistent browser expense$/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator('article strong')
      .filter({ hasText: /^Persistent browser expense$/ }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'View transaction Persistent browser expense',
    })
    .click();
  await expect(
    dialog.getByRole('heading', { name: 'Persistent browser expense' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Edit Transaction' }).click();
  await dialog.getByLabel('Signed amount', { exact: true }).fill('-23.45');
  await dialog.getByRole('button', { name: 'Save Transaction' }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(
    page.locator('.persistent-rows').getByText('AUD -23.45', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'View transaction Persistent browser expense',
    })
    .click();
  await dialog
    .getByRole('button', { name: 'Exclude Transaction', exact: true })
    .click();
  await expect(
    dialog.getByRole('button', { name: 'Restore Transaction', exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Restore Transaction', exact: true })
    .click();
  await expect(
    dialog.getByRole('button', { name: 'Exclude Transaction', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page
    .getByLabel('Search transactions', { exact: true })
    .fill('Persistent browser');
  await expect(
    page
      .locator('article strong')
      .filter({ hasText: /^Persistent browser expense$/ }),
  ).toBeVisible();
  await mkdir('test-results/block9a-layouts', { recursive: true });
  await page.screenshot({
    path: `test-results/block9a-layouts/${testInfo.project.name}-transactions.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto('/expenses');
  await expect(
    page.getByRole('heading', { name: 'Expense Overview' }),
  ).toBeVisible();
  await expect(page.getByText('AUD 23.45', { exact: true })).toBeVisible();
  await page.screenshot({
    path: `test-results/block9a-layouts/${testInfo.project.name}-overview.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Open profile', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto('/expenses/transactions');
  await expect(page).toHaveURL(/login/);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
});
