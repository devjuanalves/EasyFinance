import { test, expect } from '../e2e-support/api-test.js';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
test('persistent invoice, partial/final receipts and ledger remain consistent after refresh', async ({
  page,
  request,
}, info) => {
  const email = `invoice-browser-${randomUUID()}@example.test`,
    password = 'Fictional-browser-password!',
    headers = { Origin: 'http://localhost:5173', 'X-EasyFinance-CSRF': '1' };
  const registration = await request.post('/api/v1/auth/register', {
    headers,
    data: { fullName: 'Invoice Browser Tester', email, password },
  });
  expect(registration.status()).toBe(200);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (
      m.type() === 'error' &&
      !(m.location().url.includes('/auth/session') && m.text().includes('401'))
    )
      errors.push(m.text());
  });
  await page.goto('/login');
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
  await mkdir('test-results/block9b1-layouts', { recursive: true });
  async function capture(screen) {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/block9b1-layouts/${info.project.name}-${screen}-viewport.png`,
    });
    expect(
      await page
        .locator('img')
        .evaluateAll((images) =>
          images.every((img) => img.complete && img.naturalWidth > 0),
        ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/block9b1-layouts/${info.project.name}-${screen}.png`,
      fullPage: true,
    });
  }
  await page.goto('/income/clients');
  await page.getByRole('button', { name: 'Add Client', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Client name', { exact: true })
    .fill('Persistent Client');
  await dialog
    .getByLabel('Business name', { exact: true })
    .fill('Fictional Services');
  await dialog
    .getByLabel('Email', { exact: true })
    .fill('customer@example.test');
  await dialog
    .getByRole('button', { name: 'Save client', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Persistent Client', exact: true }),
  ).toBeVisible();
  await capture('clients');
  await page.getByRole('link', { name: 'New Invoice', exact: true }).click();
  await page.getByLabel('Invoice Number', { exact: true }).fill('BROWSER-001');
  await page
    .getByLabel('Description 1', { exact: true })
    .fill('Consulting service');
  await page.getByLabel('Quantity 1', { exact: true }).fill('1.5');
  await page.getByLabel('Unit price 1', { exact: true }).fill('100');
  await page.getByLabel('Tax rate 1 (%)', { exact: true }).fill('10');
  await page.getByLabel('Discount', { exact: true }).fill('10');
  await expect(page.locator('.invoice-total')).toContainText('154.00');
  await page.getByRole('button', { name: '＋ Add Item', exact: true }).click();
  await page
    .getByLabel('Description 2', { exact: true })
    .fill('Complimentary review');
  await page
    .getByRole('button', { name: 'Remove item 2', exact: true })
    .click();
  await capture('editor');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Invoice Details', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.invoice-status')).toHaveText('Draft');
  await expect(
    page.locator('.invoice-preview .invoice-totals'),
  ).not.toContainText('Outstanding');
  await page
    .getByRole('button', { name: 'Issue Invoice', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: 'Confirm Issue', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.invoice-status')).toContainText('Issued');
  await page
    .getByRole('button', { name: 'Record Payment', exact: true })
    .click();
  await dialog.getByLabel('Payment Amount', { exact: true }).fill('50');
  await dialog
    .getByRole('button', { name: 'Confirm Payment', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.invoice-status')).toHaveText('Partially Paid');
  await capture('partial-payment');
  await expect(
    page.locator('.kpi-card').filter({
      has: page.getByRole('heading', { name: 'Outstanding', exact: true }),
    }),
  ).toContainText('104.00');
  await page
    .getByRole('button', { name: 'Record Payment', exact: true })
    .click();
  await expect(
    dialog.getByLabel('Payment Amount', { exact: true }),
  ).toHaveValue('104.00');
  await dialog
    .getByRole('button', { name: 'Confirm Payment', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.invoice-status')).toHaveText('Paid');
  const detailUrl = page.url();
  await page.reload();
  await expect(page.locator('.invoice-status')).toHaveText('Paid');
  await expect(
    page.locator('.kpi-card').filter({
      has: page.getByRole('heading', { name: 'Outstanding', exact: true }),
    }),
  ).toContainText('0.00');
  await capture('details');
  await capture('paid');
  await page
    .getByRole('link', { name: 'Manage Invoices', exact: true })
    .click();
  await page.getByLabel('Search invoices', { exact: true }).fill('BROWSER-001');
  await expect(
    page.getByRole('link', { name: 'BROWSER-001', exact: true }),
  ).toBeVisible();
  await capture('invoices');
  await page.goto('/income');
  await expect(
    page.locator('.kpi-card').filter({
      has: page.getByRole('heading', { name: 'Total Received', exact: true }),
    }),
  ).toContainText('154.00');
  await capture('overview');
  await page.goto('/expenses/transactions');
  await expect(
    page
      .locator('.persistent-rows article strong')
      .filter({ hasText: /^Invoice BROWSER-001 receipt$/ }),
  ).toHaveCount(2);
  const ws = (await (await page.request.get('/api/v1/workspaces')).json())
      .data[0],
    accounts = (
      await (
        await page.request.get(`/api/v1/workspaces/${ws.id}/accounts`)
      ).json()
    ).data;
  expect(accounts[0].balanceMinor).toBe('15400');
  await capture('receipt-transactions');
  await page.goto('/expenses');
  await expect(
    page.getByRole('heading', { name: 'Financial accounts', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Balance AUD 154.00/)).toBeVisible();
  await capture('account-reconciliation');
  await page.getByRole('button', { name: 'Open profile', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto(detailUrl);
  await expect(page).toHaveURL(/login/);
  expect(
    (
      await page.request.get(
        `/api/v1/workspaces/${ws.id}/invoices?currency=AUD`,
      )
    ).status(),
  ).toBe(401);
  expect(errors).toEqual([]);
});
