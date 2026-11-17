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
    .getByRole('link', { name: 'Expenses', exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Expense Overview' }),
  ).toBeVisible();
}
function watch(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}
async function capture(page, name, info) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(0, 0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator('img')
      .evaluateAll((imgs) => imgs.every((i) => i.complete && i.naturalWidth)),
  ).toBe(true);
  await mkdir('test-results/block4-layouts', { recursive: true });
  await page.screenshot({
    path: `test-results/block4-layouts/${info.project.name}-${name}.png`,
    fullPage: true,
  });
  await page.screenshot({
    path: `test-results/block4-layouts/${info.project.name}-${name}-viewport.png`,
  });
}
async function nav(page, name) {
  await page
    .getByRole('link', { name, exact: true })
    .filter({ visible: true })
    .click();
}
async function close(page) {
  await page
    .getByRole('button', { name: 'Close dialog', exact: true })
    .last()
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
const csv =
  'Date,Description,Amount,Currency\n2026-10-19,Woolworths Metro,-86.40,AUD\n2026-10-25,"Coffee, local",-25.00,AUD\n2026-10-26,New receipt,100.00,AUD\n2026-10-27,Account transfer,-100.00,AUD';
test('Expenses overview filters, states and shared Dashboard/Home updates', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  await expect(page.locator('.income-kpis')).toContainText('2,840.00');
  await capture(page, 'f12-overview', info);
  await page
    .getByLabel('Expense category', { exact: true })
    .selectOption('groceries');
  await expect(page.locator('.income-kpis')).toContainText('620.00');
  await page
    .getByLabel('Expense category', { exact: true })
    .selectOption('all');
  await page
    .getByLabel('Financial account', { exact: true })
    .selectOption('reserve');
  await expect(page.locator('.income-kpis')).toContainText('171.01');
  await page
    .getByLabel('Financial account', { exact: true })
    .selectOption('all');
  await page.getByLabel('Currency', { exact: true }).selectOption('EUR');
  await expect(page.locator('.income-kpis')).toContainText('20.00');
  await page.getByLabel('Currency', { exact: true }).selectOption('AUD');
  await page.getByLabel('Period', { exact: true }).selectOption('august');
  await expect(page.getByText('No expenses for this selection.')).toBeVisible();
  await page.getByLabel('Period', { exact: true }).selectOption('october');
  await page.getByLabel('Demo data state').selectOption('partial');
  await expect(page.getByText(/Partial data through/)).toBeVisible();
  await page.getByLabel('Demo data state').selectOption('error');
  await page.getByRole('button', { name: 'Retry expense data' }).click();
  await expect(page.locator('.income-kpis')).toContainText('2,840.00');
  await page
    .getByRole('button', { name: '＋ Add Expense', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Save Transaction', exact: true })
    .click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await page
    .getByLabel('Description', { exact: true })
    .fill('Session grocery expense');
  await page.getByLabel('Signed amount').fill('-150');
  await page.getByLabel('Transaction category').selectOption('groceries');
  await page
    .getByRole('button', { name: 'Save Transaction', exact: true })
    .click();
  await expect(page.locator('.income-kpis')).toContainText('2,990.00');
  await nav(page, 'Dashboard');
  await expect(page.locator('.kpi-grid')).toContainText('2,990.00');
  await expect(page.locator('.kpi-grid')).toContainText('7,250.00');
  await nav(page, 'Home');
  await page
    .getByRole('textbox', { name: 'Ask about your finances' })
    .fill('How much did I spend?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.assistant-response').last()).toContainText(
    '2,990.00',
  );
  expect(errors).toEqual([]);
});
test('Statement file validation, real CSV mapping, duplicate review and recoverable import', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  await nav(page, 'Import Statement');
  await capture(page, 'f13-import', info);
  const input = page.getByLabel('Browse Files');
  await input.setInputFiles({
    name: 'wrong.exe',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('bad'),
  });
  await expect(page.getByRole('alert')).toContainText('CSV or PDF');
  await input.setInputFiles({
    name: 'scan.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nexample'),
  });
  await page.getByRole('button', { name: 'Analyze Statement' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'extraction/OCR is unavailable',
  );
  await input.setInputFiles({
    name: 'missing.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Date,Who,Value\n2026-10-01,Shop,-1'),
  });
  await page.getByRole('button', { name: 'Analyze Statement' }).click();
  await page.getByRole('button', { name: 'Build Review' }).click();
  await expect(page.getByRole('alert')).toContainText('Map date');
  await input.setInputFiles({
    name: 'statement.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: 'Analyze Statement' }).click();
  await page.getByRole('button', { name: 'Build Review' }).click();
  await expect(page.getByText(/Potential Duplicate/).first()).toBeVisible();
  await page.getByLabel('Row 2 amount').fill('-30.00');
  await page.getByLabel('Row 2 description').fill('Coffee reviewed');
  await page.getByLabel('Row 2 category').selectOption('groceries');
  await page
    .getByRole('button', { name: 'Mark Row 4 Internal Transfer' })
    .click();
  await page
    .getByRole('button', { name: 'Confirm Selected', exact: true })
    .click();
  await capture(page, 'statement-review-duplicate', info);
  await page
    .getByRole('button', { name: 'Confirm Import', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('duplicate');
  await page
    .getByRole('button', { name: 'Exclude Row 1', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm Import', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Import Complete' }),
  ).toBeVisible();
  await expect(page.locator('main').getByRole('status')).toContainText(
    '3 imported · 1 excluded · 1 duplicate',
  );
  await nav(page, 'Dashboard');
  await expect(page.locator('.kpi-grid')).toContainText('2,870.00');
  await expect(page.locator('.kpi-grid')).toContainText('7,350.00');
  await nav(page, 'Expenses');
  await nav(page, 'Import Statement');
  await input.setInputFiles({
    name: 'statement.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: 'Analyze Statement' }).click();
  await page.getByRole('button', { name: 'Build Review' }).click();
  await expect(page.getByText(/Potential Duplicate/)).toHaveCount(4);
  await page.getByRole('button', { name: 'Exclude Selected Rows' }).click();
  await page
    .getByRole('button', { name: 'Confirm Import', exact: true })
    .click();
  await expect(page.locator('main').getByRole('status')).toContainText(
    '0 imported · 4 excluded',
  );
  await page.getByRole('button', { name: 'Import Another Statement' }).click();
  await input.setInputFiles({
    name: 'undo.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Date,Description,Amount\n2026-10-29,Temporary purchase,-10',
    ),
  });
  await page.getByRole('button', { name: 'Analyze Statement' }).click();
  await page.getByRole('button', { name: 'Build Review' }).click();
  await page
    .getByRole('button', { name: 'Confirm Selected', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm Import', exact: true })
    .click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Exclude Imported Batch' }).click();
  await expect(
    page.getByRole('button', { name: 'Exclude Imported Batch' }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});
test('Transactions search, split, source preservation, exclusion, transfer and bulk actions', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  await nav(page, 'Transactions');
  await capture(page, 'f14-transactions', info);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await page.getByLabel('Search transactions').fill('Woolworths');
  await page
    .getByRole('button', { name: 'Woolworths Metro', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Split Transaction', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]id=/);
  await page.getByLabel('Search transactions').fill('Annual software');
  await expect(
    page.getByLabel('Select Annual software allocation'),
  ).toBeVisible();
  await page.getByLabel('Search transactions').fill('Woolworths');
  await page
    .getByRole('button', { name: 'Woolworths Metro', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Split Transaction', exact: true })
    .click();
  await page.getByLabel('Split category 1').selectOption('groceries');
  await page.getByLabel('Split amount 1').fill('50');
  await page.getByLabel('Split category 2').selectOption('other');
  await page.getByLabel('Split amount 2').fill('30');
  await page.getByRole('button', { name: 'Confirm Splits' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'sum exactly',
  );
  await page.getByLabel('Split amount 2').fill('36.40');
  await capture(page, 'transaction-split', info);
  await page.getByRole('button', { name: 'Confirm Splits' }).click();
  await page
    .getByRole('button', { name: 'Edit Transaction', exact: true })
    .click();
  await page
    .getByLabel('Description', { exact: true })
    .fill('Weekly market reviewed');
  await page.getByLabel('Transaction notes').fill('Source receipt retained');
  await page
    .getByRole('button', { name: 'Save Transaction', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Woolworths Metro');
  await close(page);
  await page.getByLabel('Search transactions').fill('Weekly market reviewed');
  await page
    .getByRole('button', { name: 'Weekly market reviewed', exact: true })
    .click();
  page.once('dialog', (d) => d.dismiss());
  await page
    .getByRole('button', { name: 'Exclude Transaction', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Exclude Transaction', exact: true }),
  ).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: 'Exclude Transaction', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Restore Excluded Transaction' })
    .click();
  await page
    .getByRole('button', { name: 'Split Transaction', exact: true })
    .click();
  await page.getByRole('button', { name: 'Remove All Splits' }).click();
  await page
    .getByRole('button', { name: 'Mark Internal Transfer', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm Single Transfer' }).click();
  await close(page);
  await expect(page.locator('.income-kpis')).toContainText('0.00');
  await page.getByLabel('Search transactions').fill('Annual software');
  await expect(page.getByLabel('Search transactions')).toHaveValue(
    'Annual software',
  );
  await page.getByLabel('Select Annual software allocation').check();
  await page.getByLabel('Bulk category').selectOption('other');
  await page
    .getByRole('button', { name: 'Assign Category', exact: true })
    .click();
  await expect(page.locator('.expense-table')).toContainText('Other expenses');
  await page.getByLabel('Select Annual software allocation').check();
  await page
    .getByRole('button', { name: 'Mark Reviewed', exact: true })
    .click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Filtered CSV' }).click();
  expect((await download).suggestedFilename()).toBe(
    'easyfinance-transactions.csv',
  );
  await page.getByLabel('Search transactions').fill('Client retainer');
  await page
    .getByRole('button', { name: 'Client retainer · Acme', exact: true })
    .click();
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: 'Exclude Transaction', exact: true })
    .click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'invoice allocations',
  );
  await page.getByRole('link', { name: /View Linked Invoice/ }).click();
  await expect(page).toHaveURL(/income\/invoices\/inv1/);
  expect(errors).toEqual([]);
});
test('Categories, archive, rule editor, precedence and explicit suggestion confirmation', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  await nav(page, 'Categories & Rules');
  await capture(page, 'f15-categories', info);
  await page.getByRole('button', { name: 'Add Category', exact: true }).click();
  await page.getByLabel('Category name').fill('Household');
  await page.getByRole('button', { name: 'Save Category' }).click();
  await page
    .getByRole('button', { name: 'Edit Household', exact: true })
    .click();
  await page.getByLabel('Category name').fill('Household supplies');
  await page.getByRole('button', { name: 'Save Category' }).click();
  await page.getByLabel('Search Categories').fill('Household');
  await expect(page.locator('.category-card')).toHaveCount(1);
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: 'Archive Household supplies' })
    .click();
  await expect(page.locator('.category-card')).toContainText('Archived');
  await page.getByLabel('Search Categories').fill('');
  await page.getByRole('button', { name: 'Create Rule', exact: true }).click();
  await page.getByLabel('Rule name').fill('Metro reviewed rule');
  await page.getByLabel('Matching value').fill('metro');
  await page.getByLabel('Assigned category').selectOption('other');
  await page.getByLabel('Priority', { exact: true }).fill('1');
  await capture(page, 'rule-editor', info);
  await page.getByRole('button', { name: 'Save Rule' }).click();
  await page
    .getByRole('button', {
      name: 'Preview Matches · Metro reviewed rule',
      exact: true,
    })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Conflict');
  await page.getByLabel('Apply suggestion to Woolworths Metro').check();
  await capture(page, 'rule-preview', info);
  await page.getByRole('button', { name: 'Confirm Suggested Changes' }).click();
  await page
    .getByRole('button', {
      name: 'Preview Matches · Metro reviewed rule',
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel('Apply suggestion to Woolworths Metro'),
  ).toBeDisabled();
  await close(page);
  await page
    .getByRole('button', {
      name: 'Disable Rule · Metro reviewed rule',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', {
      name: 'Enable Rule · Metro reviewed rule',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', {
      name: 'Edit Rule · Metro reviewed rule',
      exact: true,
    })
    .click();
  await page.getByLabel('Priority', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Save Rule' }).click();
  await page.getByRole('button', { name: 'Test Rules', exact: true }).click();
  await expect(page.locator('main').getByRole('status')).toContainText(
    'Metro reviewed rule',
  );
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', {
      name: 'Delete Rule · Metro reviewed rule',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Edit Rule · Metro reviewed rule',
      exact: true,
    }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
