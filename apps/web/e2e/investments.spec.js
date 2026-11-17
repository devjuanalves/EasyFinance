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
}
async function nav(page, name) {
  await page
    .getByRole('link', { name, exact: true })
    .filter({ visible: true })
    .click();
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
  await mkdir('test-results/block5-layouts', { recursive: true });
  await page.screenshot({
    path: `test-results/block5-layouts/${info.project.name}-${name}.png`,
    fullPage: true,
  });
  await page.screenshot({
    path: `test-results/block5-layouts/${info.project.name}-${name}-viewport.png`,
  });
}
async function close(page) {
  await page
    .getByRole('button', { name: 'Close dialog', exact: true })
    .last()
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function entry(page, button, fields = {}) {
  await page.getByRole('button', { name: button, exact: true }).click();
  for (const [name, value] of Object.entries(fields))
    await page.getByLabel(name, { exact: true }).fill(value);
}
async function saveMovement(page) {
  await page
    .getByRole('button', { name: 'Save Movement', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
test('Investment dashboard: six-layout sources, filters, states and Home/Dashboard consistency', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  await nav(page, 'Investments');
  await expect(page.locator('.income-kpis')).toContainText('22,090.00');
  await capture(page, 'f16-dashboard', info);
  await page
    .getByLabel('Investment account', { exact: true })
    .selectOption('deposit-aud');
  await expect(page.locator('.income-kpis')).toContainText('5,180.00');
  await page
    .getByLabel('Investment account', { exact: true })
    .selectOption('all');
  await page.getByLabel('Asset type filter').selectOption('Cryptocurrency');
  await expect(page.locator('.income-kpis')).toContainText('2,350.00');
  await page.getByLabel('Asset type filter').selectOption('all');
  await page.getByLabel('Portfolio currency').selectOption('EUR');
  await expect(page.locator('.income-kpis')).toContainText('1,050.00');
  await page.getByLabel('Portfolio currency').selectOption('all');
  await expect(
    page.getByRole('heading', {
      name: 'Combined value unavailable across currencies',
    }),
  ).toBeVisible();
  await page.getByLabel('Portfolio currency').selectOption('USD');
  await expect(
    page.getByRole('heading', { name: 'No investments for this selection' }),
  ).toBeVisible();
  await page.getByLabel('Portfolio currency').selectOption('AUD');
  await page.getByLabel('Reporting period').selectOption('august');
  await expect(page.locator('.income-kpis')).toContainText('20,000.00');
  await page.getByLabel('Reporting period').selectOption('october');
  await page.getByLabel('Demo data state').selectOption('empty');
  await expect(
    page.getByRole('heading', { name: 'No investments for this selection' }),
  ).toBeVisible();
  await page.getByLabel('Demo data state').selectOption('error');
  await page.getByRole('button', { name: 'Retry investment data' }).click();
  await expect(page.locator('.income-kpis')).toContainText('22,090.00');
  await page.getByLabel('Demo data state').selectOption('partial');
  await expect(page.getByText(/Portfolio reporting stops/)).toBeVisible();
  await page.getByLabel('Demo data state').selectOption('normal');
  await page
    .getByRole('button', { name: 'Update Values', exact: true })
    .click();
  await page.getByLabel('Search holdings').fill('Broad Market');
  await expect(page.locator('#holdings tbody tr')).toHaveCount(1);
  await page
    .locator('#holdings')
    .getByRole('button', { name: 'Update Value', exact: true })
    .click();
  await page.getByLabel('Estimated value', { exact: true }).fill('6000');
  await page.getByRole('button', { name: 'Save Valuation' }).click();
  await expect(page.locator('.income-kpis')).toContainText('22,970.00');
  await nav(page, 'Dashboard');
  await expect(
    page.getByRole('region', { name: 'Investment summary' }),
  ).toContainText('22,970.00');
  await expect(page.locator('.kpi-grid').first()).toContainText('7,250.00');
  await expect(page.locator('.kpi-grid').first()).toContainText('2,840.00');
  await nav(page, 'Home');
  await page
    .getByRole('textbox', { name: 'Ask about your finances' })
    .fill('What is my current portfolio value?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.response-text').last()).toContainText(
    '22,970.00',
  );
  await page.getByRole('button', { name: /Add Investment/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Add Investment', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('Investment editor: conditional fields, account creation, precision, unsaved changes and metadata', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  await nav(page, 'Investments');
  await page.getByRole('link', { name: /Add Investment/ }).click();
  await page
    .getByRole('button', { name: 'Save Investment', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('name');
  await page
    .getByLabel('Investment name', { exact: true })
    .fill('Fractional test');
  await page
    .getByLabel('Asset type', { exact: true })
    .selectOption('Cryptocurrency');
  await page.getByLabel('Quantity', { exact: true }).fill('0.000125');
  await page.getByLabel('Unit price', { exact: true }).fill('80000');
  await page.getByLabel('Purchase fee').fill('0.25');
  await page.getByLabel('Estimated current value').fill('12');
  await expect(page.locator('.investment-summary')).toContainText('10.25');
  await capture(page, 'f17-editor', info);
  await page.getByRole('link', { name: 'Back / Cancel' }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Unsaved investment changes',
  );
  await capture(page, 'unsaved-confirmation', info);
  await page.getByRole('button', { name: 'Keep Editing' }).click();
  await page.getByLabel('Purchase date').fill('2026-11-01');
  await page
    .getByRole('button', { name: 'Save Investment', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Date');
  await page.getByLabel('Purchase date').fill('2026-10-31');
  await page.getByRole('button', { name: 'Add Institution / Account' }).click();
  await page.getByLabel('Account name', { exact: true }).fill('Manual wallet');
  await page
    .getByLabel('Financial institution', { exact: true })
    .last()
    .fill('Offline sample');
  await page.getByRole('button', { name: 'Save Account' }).click();
  await expect(
    page.getByLabel('Financial institution', { exact: true }),
  ).toHaveValue('Offline sample');
  await page
    .getByRole('button', { name: 'Save Investment', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Fractional test', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.income-kpis')).toContainText('12.00');
  await expect(page.locator('.income-kpis')).toContainText('10.25');
  await page
    .getByRole('link', { name: 'Edit Investment', exact: true })
    .click();
  await expect(page.getByLabel('Asset type', { exact: true })).toBeDisabled();
  await page
    .getByLabel('Investment name', { exact: true })
    .fill('Renamed fractional holding');
  await capture(page, 'edit-investment', info);
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Renamed fractional holding' }),
  ).toBeVisible();
  await expect(page.locator('.income-kpis')).toContainText('10.25');
  await nav(page, 'Investments');
  await page.getByRole('link', { name: /Add Investment/ }).click();
  await page
    .getByLabel('Asset type', { exact: true })
    .selectOption('Fixed Income');
  await expect(page.getByLabel('Principal amount')).toBeVisible();
  await expect(page.getByLabel('Quantity', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back / Cancel' }).click();
  await page.getByRole('button', { name: 'Discard Changes' }).click();
  await expect(
    page.getByRole('heading', { name: 'Investments', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('Investment details: purchase, sale, valuation, corrections and dependent-history protection', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  await nav(page, 'Investments');
  await page
    .locator('#holdings')
    .getByRole('link', { name: 'Broad Market ETF', exact: true })
    .click();
  await capture(page, 'f18-details', info);
  await entry(page, 'Record Purchase', {
    'Movement quantity': '10',
    'Movement unit price': '50',
    'Movement fee': '2',
  });
  await capture(page, 'purchase', info);
  await saveMovement(page);
  await expect(page.locator('.income-kpis')).toContainText('5,002.00');
  await expect(
    page.getByText(/No comparable valuation for this position/),
  ).toBeVisible();
  await entry(page, 'Record Sale', {
    'Movement quantity': '111',
    'Movement unit price': '60',
    'Movement fee': '5',
  });
  await page.getByRole('button', { name: 'Save Movement' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'available quantity',
  );
  await capture(page, 'invalid-sale', info);
  await page.getByLabel('Movement quantity').fill('20');
  await capture(page, 'sale', info);
  await saveMovement(page);
  await expect(page.locator('.income-kpis')).toContainText('4,092.55');
  await entry(page, 'Update Value', { 'Estimated value': '5500' });
  await capture(page, 'valuation', info);
  await page.getByRole('button', { name: 'Save Valuation' }).click();
  await expect(page.locator('.income-kpis')).toContainText('5,500.00');
  await page.getByLabel('Activity type').selectOption('buy');
  const initial = page
    .locator('.investment-table tbody tr')
    .filter({ hasText: 'Initial sample position' });
  page.once('dialog', (d) => d.accept());
  await initial.getByRole('button', { name: 'Delete Activity' }).click();
  await expect(page.getByRole('alert')).toContainText('available quantity');
  const purchase = page
    .locator('.investment-table tbody tr')
    .filter({ hasText: '31 Oct 2026' });
  await purchase.getByRole('button', { name: 'Edit Activity' }).click();
  await page.getByLabel('Movement unit price').fill('51');
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Confirm Correction' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Confirm Correction' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Activity type').selectOption('sell');
  page.once('dialog', (d) => d.dismiss());
  await page
    .getByRole('button', { name: 'Delete Activity', exact: true })
    .click();
  await expect(page.locator('.investment-table tbody tr')).toHaveCount(1);
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: 'Delete Activity', exact: true })
    .click();
  await expect(page.locator('.investment-table tbody tr')).toHaveCount(0);
  await page.getByLabel('Activity type').selectOption('all');
  await entry(page, 'Record Sale', {
    'Movement quantity': '110',
    'Movement unit price': '60',
  });
  await saveMovement(page);
  await expect(
    page.getByText(/Closed position · no remaining holdings/),
  ).toBeVisible();
  await expect(page.locator('.income-kpis')).toContainText('0.00');
  expect(errors).toEqual([]);
});
test('Principal movements, distributions, fees, missing values and scoped activity', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  await nav(page, 'Investments');
  await page
    .locator('#holdings')
    .getByRole('link', { name: 'Fixed Term Deposit', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Fixed Term Deposit', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Record Sale', exact: true }),
  ).toHaveCount(0);
  await entry(page, 'Record Contribution', { 'Movement amount': '1000' });
  await saveMovement(page);
  await expect(page.locator('.income-kpis')).toContainText('6,000.00');
  await entry(page, 'Record Withdrawal', { 'Withdrawal amount': '7000' });
  await page.getByRole('button', { name: 'Save Movement' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'principal',
  );
  await page.getByLabel('Withdrawal amount').fill('500');
  await saveMovement(page);
  await expect(page.locator('.income-kpis')).toContainText('5,500.00');
  await entry(page, 'Record Dividend', {
    'Movement amount': '20',
    'Movement fee': '1',
    'Activity notes': 'Portfolio-only distribution',
  });
  await capture(page, 'dividend', info);
  await saveMovement(page);
  await entry(page, 'Record Interest', { 'Movement amount': '10' });
  await capture(page, 'interest', info);
  await saveMovement(page);
  await entry(page, 'Record Fee', { 'Movement amount': '2' });
  await saveMovement(page);
  await entry(page, 'Update Value', { 'Estimated value': '5600' });
  await page.getByRole('button', { name: 'Save Valuation' }).click();
  await expect(page.getByText('AUD 29.00', { exact: true })).toBeVisible();
  await page.getByLabel('Activity type').selectOption('dividend');
  await page.getByLabel('Search activity').fill('Portfolio-only');
  await expect(page.locator('.investment-table tbody tr')).toHaveCount(1);
  await page.getByLabel('Activity from').fill('2026-11-01');
  await expect(page.getByText('No activity for this selection.')).toBeVisible();
  await entry(page, 'Record Interest');
  await close(page);
  await page.getByLabel('Search activity').fill('new search');
  await expect(page.getByLabel('Search activity')).toHaveValue('new search');
  await nav(page, 'Dashboard');
  await expect(page.locator('.kpi-grid').first()).toContainText('7,250.00');
  await expect(page.locator('.kpi-grid').first()).toContainText('2,840.00');
  if (info.project.name === 'mobile')
    await page
      .getByRole('button', { name: 'Open navigation and history' })
      .click();
  await page
    .getByLabel('Workspace', { exact: true })
    .filter({ visible: true })
    .selectOption('empty');
  if (info.project.name === 'mobile') await close(page);
  await page.goBack();
  await expect(
    page.getByText('Investment not found in this workspace.'),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
