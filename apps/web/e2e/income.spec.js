import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
async function login(page) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('alex@example.com');
  await page.getByLabel('Password', { exact: true }).fill('EasyFinanceDemo!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Send message' }),
  ).toBeEnabled();
  await page
    .getByRole('link', { name: 'Income', exact: true })
    .filter({ visible: true })
    .click();
}
async function capture(page, name, info) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(0, 0);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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
  await mkdir('test-results/block3-layouts', { recursive: true });
  await page.screenshot({
    path: `test-results/block3-layouts/${info.project.name}-${name}.png`,
    fullPage: true,
  });
  await page.screenshot({
    path: `test-results/block3-layouts/${info.project.name}-${name}-viewport.png`,
  });
}
function watch(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}
test('Income overview, scoped filters, empty, partial and error states', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  const kpis = page.locator('.income-kpis');
  await expect(kpis).toContainText('7,250.00');
  await expect(kpis).toContainText('7,000.00');
  await expect(kpis).toContainText('4,650.00');
  await capture(page, 'f07-income-overview', info);
  await page
    .getByLabel('Client / income source', { exact: true })
    .selectOption('acme');
  await expect(kpis).toContainText('1,850.00');
  await page
    .getByLabel('Client / income source', { exact: true })
    .selectOption('all');
  await page.getByLabel('Currency', { exact: true }).selectOption('EUR');
  await expect(kpis).toContainText('100.00');
  await page.getByLabel('Currency', { exact: true }).selectOption('AUD');
  await page.getByLabel('Period', { exact: true }).selectOption('august');
  await expect(page.getByText('No income for this selection.')).toBeVisible();
  await expect(page.getByText('No invoices for this selection.')).toBeVisible();
  await page.getByLabel('Period', { exact: true }).selectOption('october');
  await page.getByLabel('Demo data state').selectOption('partial');
  await expect(page.getByText(/Partial transaction coverage/)).toBeVisible();
  await page.getByLabel('Demo data state').selectOption('error');
  await expect(
    page.getByRole('heading', { name: 'Income data unavailable' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry income data' }).click();
  await expect(kpis).toContainText('7,250.00');
  await page
    .getByRole('button', { name: '＋ Add Income', exact: true })
    .click();
  await expect(page).toHaveURL(/expenses\/transactions\?add=1&type=income/);
  await expect(page.getByRole('dialog')).toContainText('Save Transaction');
  await expect(page.getByLabel('Transaction type')).toHaveValue('income');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  expect(errors).toEqual([]);
});
test('Invoice list search, pagination, selection export, cancellation and duplication', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  await page.getByRole('link', { name: 'Invoices', exact: true }).click();
  await capture(page, 'f08-invoice-list', info);
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByLabel('Invoice status', { exact: true }).selectOption('paid');
  await expect(
    page.getByRole('link', { name: 'INV-2026-001', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Page 1 of 1')).toBeVisible();
  await page.getByLabel('Search invoices').fill('no match');
  await expect(
    page.getByText('No invoices match these filters.'),
  ).toBeVisible();
  await page.getByLabel('Search invoices').fill('');
  await page.getByLabel('Select INV-2026-001', { exact: true }).check();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Selection CSV (1)' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    'easyfinance-invoices.csv',
  );
  await page.locator('.invoice-actions summary').click();
  await expect(
    page.getByRole('button', { name: 'Edit unavailable' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Cancel Invoice', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Duplicate Invoice' }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await expect(page.getByLabel('Invoice Number')).not.toHaveValue(
    'INV-2026-001',
  );
  await page.getByRole('link', { name: 'Back / Cancel' }).click();
  await page.getByLabel('Search invoices').fill('INV-2026-004');
  await page.getByLabel('Invoice status', { exact: true }).selectOption('all');
  await page.locator('.invoice-actions summary').click();
  await page
    .getByRole('button', { name: 'Cancel Invoice', exact: true })
    .click();
  await page.getByRole('button', { name: 'Keep invoice' }).click();
  await page
    .getByRole('button', { name: 'Cancel Invoice', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm cancellation' }).click();
  await expect(
    page.getByText('Cancelled', { exact: true }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('Invoice editor validates, previews, protects unsaved work and updates payments across modules', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  await page.getByRole('link', { name: '＋ Create Invoice' }).click();
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Select an active client',
  );
  await page.getByLabel('Select Client', { exact: true }).selectOption('acme');
  await page
    .getByLabel('Description 1', { exact: true })
    .fill('Responsive design services');
  await page.getByLabel('Quantity 1', { exact: true }).fill('2.5');
  await page.getByLabel('Unit price 1', { exact: true }).fill('120');
  await page.getByLabel('Tax rate 1 (%)', { exact: true }).fill('10');
  await page.getByLabel('Discount amount').fill('10');
  await page.getByRole('button', { name: '＋ Add Item' }).click();
  await page.getByRole('button', { name: 'Remove item 2' }).click();
  await expect(
    page.locator('.invoice-edit-form .invoice-totals'),
  ).toContainText('319.00');
  await capture(page, 'f09-invoice-editor', info);
  await page.getByRole('link', { name: 'Back / Cancel' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Discard unsaved changes?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await page
    .getByRole('button', { name: 'Preview Invoice', exact: true })
    .click();
  await expect(page.locator('.editor-live-preview')).toContainText(
    'Responsive design services',
  );
  await page.getByRole('button', { name: 'Edit Form', exact: true }).click();
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page).toHaveURL(/\/income\/invoices\/invoice-/);
  await expect(page.locator('.invoice-preview')).toContainText('319.00');
  await page.getByRole('button', { name: 'Prepare Send', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm preparation — no email' })
    .click();
  await expect(
    page.getByText('Prepared for review. No email was sent.'),
  ).toBeVisible();
  await page.getByRole('button', { name: '＋ Record Payment' }).click();
  await page.getByLabel('Payment Amount (AUD)', { exact: true }).fill('320');
  await page
    .getByRole('button', { name: 'Confirm Payment', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('cannot exceed');
  await page.getByLabel('Payment Amount (AUD)', { exact: true }).fill('100');
  await page
    .getByRole('button', { name: 'Confirm Payment', exact: true })
    .click();
  await expect(page.getByText('Partially Paid', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '＋ Record Payment' }).click();
  await page
    .getByRole('button', { name: 'Confirm Payment', exact: true })
    .click();
  await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();
  await page
    .getByRole('link', { name: 'Dashboard', exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.locator('.kpi-grid')).toContainText('7,569.00');
  await page
    .getByRole('link', { name: 'Home', exact: true })
    .filter({ visible: true })
    .click();
  await page
    .getByRole('button', { name: 'How much money did I earn?' })
    .click();
  await expect(
    page.getByText(/Your recorded income is AUD.*7,569.00/),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('Invoice details bank-match review, document print and historical payment restrictions', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  await page.getByRole('link', { name: 'Invoices', exact: true }).click();
  await page.getByRole('link', { name: 'INV-2026-002', exact: true }).click();
  await capture(page, 'f10-invoice-details', info);
  await page
    .getByRole('button', { name: 'Review Bank Match', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Review Bank Match' }),
  ).toContainText('No new income');
  await page
    .getByRole('button', { name: 'Confirm Match', exact: true })
    .click();
  await expect(page.locator('.income-kpis')).toContainText('2,000.00');
  await expect(page.locator('.income-kpis')).toContainText('1,500.00');
  await expect(
    page.getByRole('button', { name: 'Review Bank Match', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Cancel Invoice', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Print / Save PDF', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Invoice document preview' }),
  ).toContainText('INV-2026-002');
  await page.evaluate(() => {
    window.print = () => {
      window.__printCalled = true;
    };
  });
  await page
    .getByRole('button', { name: 'Print / Save as PDF', exact: true })
    .click();
  expect(await page.evaluate(() => window.__printCalled)).toBe(true);
  await page
    .getByRole('dialog', { name: 'Invoice document preview' })
    .getByRole('button', { name: 'Close dialog' })
    .click();
  await page
    .getByRole('link', { name: 'Dashboard', exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.locator('.kpi-grid')).toContainText('7,250.00');
  expect(errors).toEqual([]);
});
test('Clients editor, archive preservation, prefilled invoice and recurring review template', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  await page.getByRole('link', { name: 'Clients', exact: true }).click();
  await capture(page, 'f11-clients', info);
  await page.getByRole('button', { name: '＋ Add Client' }).click();
  await page.getByRole('button', { name: 'Save client', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('client name');
  await page.getByLabel('Client name', { exact: true }).fill('Test Studio');
  await page
    .getByLabel('Business name', { exact: true })
    .fill('Test Studio Ltd');
  await page.getByLabel('Email', { exact: true }).fill('test@studio.example');
  await page.getByRole('button', { name: 'Save client', exact: true }).click();
  await page.getByLabel('Search Clients', { exact: true }).fill('Test Studio');
  await expect(page.locator('.client-table')).toContainText('Test Studio');
  await page.getByRole('button', { name: 'Edit Client', exact: true }).click();
  await page.getByLabel('Phone', { exact: true }).fill('0400000000');
  await page.getByRole('button', { name: 'Save client', exact: true }).click();
  await page
    .getByRole('link', { name: 'Create Invoice for Client', exact: true })
    .click();
  await expect(
    page.getByLabel('Select Client', { exact: true }),
  ).not.toHaveValue('');
  await page.getByRole('link', { name: 'Back / Cancel' }).click();
  await page.getByRole('link', { name: 'Clients', exact: true }).click();
  await page.getByLabel('Search Clients', { exact: true }).fill('Acme');
  await page
    .locator('.client-table')
    .getByRole('button', { name: 'View Client', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'Create Recurring Invoice Template',
      exact: true,
    })
    .click();
  await page
    .getByLabel('Template Name', { exact: true })
    .fill('Monthly review');
  await page
    .getByLabel('Description 1', { exact: true })
    .fill('Recurring design');
  await page.getByLabel('Unit price 1', { exact: true }).fill('150');
  await page.getByRole('button', { name: 'Save Review Template' }).click();
  await page.getByRole('button', { name: 'Prepare Draft Now' }).click();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'View Client →' }).click();
  await page
    .getByRole('button', { name: 'Archive Client', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm Archive' }).click();
  await expect(page.locator('.client-profile')).toContainText('Archived');
  await page.getByRole('link', { name: 'View Client Invoices →' }).click();
  await expect(
    page.getByRole('link', { name: 'INV-2026-001', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
