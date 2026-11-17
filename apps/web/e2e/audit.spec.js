import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const screens = [
  ['f05', '/', /^Welcome,/],
  ['f06', '/dashboard', 'Financial Overview'],
  ['f07', '/income', 'Income Overview'],
  ['f08', '/income/invoices', 'Invoices'],
  ['f09', '/income/invoices/new', 'Create Invoice'],
  ['f10', '/income/invoices/inv1', /INV-/],
  ['f11', '/income/clients', 'Clients & Employers'],
  ['f12', '/expenses', 'Expense Overview'],
  ['f13', '/expenses/import', 'Import Bank Statement'],
  ['f14', '/expenses/transactions', 'Transactions'],
  ['f15', '/expenses/categories', 'Categories & Classification Rules'],
  ['f16', '/investments', 'Investments'],
  ['f17', '/investments/new', 'Add Investment'],
  ['f18', '/investments/etf', 'Broad Market ETF'],
  ['f19', '/settings', 'Profile & Settings'],
  ['f20', '/settings/sharing', 'Sharing & Permissions'],
  ['f21', '/settings/automations', 'Automations & Notifications'],
];
async function login(page) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('alex@example.com');
  await page.getByLabel('Password', { exact: true }).fill('EasyFinanceDemo!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Send message' }),
  ).toBeEnabled();
}
// Browser history navigation retains the explicitly session-only auth state.
// Existing module tests separately exercise the visible navigation links.
async function route(page, path) {
  await page.evaluate((url) => {
    history.pushState(null, '', url);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await expect(page).toHaveURL(path);
}
async function layout(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator('img')
      .evaluateAll((imgs) =>
        imgs.every((i) => i.complete && i.naturalWidth > 0),
      ),
  ).toBe(true);
}
test('audit all protected routes, missing records, history and session refresh', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await login(page);
  await mkdir('test-results/block7-layouts', { recursive: true });
  for (const [id, path, heading] of screens) {
    await route(page, path);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: heading,
        exact: typeof heading === 'string',
      }),
    ).toBeVisible();
    await expect(
      page.getByText('Loading EasyFinance…', { exact: true }),
    ).toHaveCount(0);
    await layout(page);
    await page.screenshot({
      path: `test-results/block7-layouts/${info.project.name}-${id}.png`,
      fullPage: true,
    });
    await page.screenshot({
      path: `test-results/block7-layouts/${info.project.name}-${id}-viewport.png`,
    });
  }
  await route(page, '/income/invoices/missing');
  await expect(page.getByText(/Invoice not found/)).toBeVisible();
  await route(page, '/investments/missing');
  await expect(page.getByText(/Investment not found/)).toBeVisible();
  await route(page, '/not-a-route');
  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('/investments/missing');
  await route(page, '/settings');
  await page.reload();
  await expect(page).toHaveURL('/login');
  expect(errors).toEqual([]);
});
test('audit representative narrow and tablet layouts and dialog focus', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await login(page);
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const id of ['f06', 'f09', 'f13', 'f14', 'f17', 'f20', 'f21']) {
      const [, path, heading] = screens.find((s) => s[0] === id);
      await route(page, path);
      await expect(
        page.getByRole('heading', { level: 1, name: heading, exact: true }),
      ).toBeVisible();
      await layout(page);
    }
    const opener = page.getByRole('button', { name: 'Open profile' });
    await opener.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(opener).toBeFocused();
    await opener.click();
    await page
      .getByRole('button', { name: 'Close dialog', exact: true })
      .click();
    await expect(opener).toBeFocused();
    await page.screenshot({
      path: `test-results/block7-layouts/${info.project.name}-${width}-automations.png`,
      fullPage: true,
    });
  }
});

test('audit Home actions open scoped review screens without creating transactions', async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole('button', { name: 'Add Transaction ↗', exact: true })
    .click();
  await expect(page).toHaveURL('/expenses/transactions?add=1');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await route(page, '/dashboard');
  await expect(page.locator('.kpi-grid')).toContainText('7,250.00');
  await expect(page.locator('.kpi-grid')).toContainText('2,840.00');
  await route(page, '/');
  await page
    .getByRole('button', {
      name: 'How much did I spend this month? ↗',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', { name: 'Review suggestions →', exact: true })
    .click();
  await page
    .getByRole('link', {
      name: 'Review uncategorized transactions',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL('/expenses/transactions?status=uncategorized');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Review status', { exact: true })).toHaveValue(
    'uncategorized',
  );
  await expect(page.locator('main')).toContainText('Woolworths Metro');
});

test('audit new client invoice and investment journeys preserve cash and session state', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await route(page, '/income/clients');
  await page.getByRole('button', { name: '＋ Add Client' }).click();
  await page.getByLabel('Client name', { exact: true }).fill('Audit Client');
  await page.getByLabel('Business name', { exact: true }).fill('Audit Studio');
  await page.getByLabel('Email', { exact: true }).fill('audit@example.test');
  await page.getByRole('button', { name: 'Save client', exact: true }).click();
  await page
    .getByRole('link', { name: 'Create Invoice for Client', exact: true })
    .click();
  await page
    .getByLabel('Description 1', { exact: true })
    .fill('Audit services');
  await page.getByLabel('Unit price 1', { exact: true }).fill('1000000');
  await layout(page);
  await page.getByLabel('Unit price 1', { exact: true }).fill('200');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  const invoicePath = new URL(page.url()).pathname;
  await route(page, '/dashboard');
  await expect(page.locator('.kpi-grid')).toContainText('7,250.00');
  await route(page, invoicePath);
  await page.getByRole('button', { name: 'Prepare Send', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm preparation — no email' })
    .click();
  await page.getByRole('button', { name: '＋ Record Payment' }).click();
  await page.getByLabel('Payment Amount (AUD)', { exact: true }).fill('50');
  await page
    .getByRole('button', { name: 'Confirm Payment', exact: true })
    .click();
  await expect(page.getByText('Partially Paid', { exact: true })).toBeVisible();
  await expect(page.locator('.income-kpis')).toContainText('150.00');
  await route(page, '/dashboard');
  await expect(page.locator('.kpi-grid')).toContainText('7,300.00');
  await route(page, '/investments/new');
  await page
    .getByLabel('Investment name', { exact: true })
    .fill('Audit holding');
  await page.getByLabel('Quantity', { exact: true }).fill('10');
  await page.getByLabel('Unit price', { exact: true }).fill('10');
  await page
    .getByRole('button', { name: 'Save Investment', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Audit holding', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Record Purchase', exact: true })
    .click();
  await page.getByLabel('Movement quantity').fill('10');
  await page.getByLabel('Movement unit price').fill('20');
  await page
    .getByRole('button', { name: 'Save Movement', exact: true })
    .click();
  await expect(page.locator('.income-kpis')).toContainText('300.00');
  await page.getByRole('button', { name: 'Update Value', exact: true }).click();
  await page.getByLabel('Estimated value', { exact: true }).fill('400');
  await page
    .getByRole('button', { name: 'Save Valuation', exact: true })
    .click();
  await expect(page.locator('.income-kpis')).toContainText('400.00');
  await page.getByRole('button', { name: 'Record Sale', exact: true }).click();
  await page.getByLabel('Movement quantity').fill('5');
  await page.getByLabel('Movement unit price').fill('25');
  await page
    .getByRole('button', { name: 'Save Movement', exact: true })
    .click();
  await expect(page.locator('.income-kpis')).toContainText('225.00');
  await expect(page.getByText(/No comparable valuation/)).toBeVisible();
  await expect(page.locator('main')).toContainText('50.00');
  await route(page, '/dashboard');
  await expect(page.locator('.kpi-grid')).toContainText('7,300.00');
  await expect(page.locator('.kpi-grid')).toContainText('2,840.00');
  expect(errors).toEqual([]);
});
