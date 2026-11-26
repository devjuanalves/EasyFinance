import { test, expect } from '../e2e-support/api-test.js';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
test('CSV review, duplicate decisions, category and balances persist across refresh', async ({
  page,
  request,
}, info) => {
  const email = `import-browser-${randomUUID()}@example.test`,
    password = 'Fictional-import-browser!',
    headers = { Origin: 'http://localhost:5173', 'X-EasyFinance-CSRF': '1' };
  expect(
    (
      await request.post('/api/v1/auth/register', {
        headers,
        data: { fullName: 'Import Browser Tester', email, password },
      })
    ).status(),
  ).toBe(200);
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
  await mkdir('test-results/block9b2-layouts', { recursive: true });
  async function capture(name) {
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
    await page.screenshot({
      path: `test-results/block9b2-layouts/${info.project.name}-${name}-viewport.png`,
    });
    await page.screenshot({
      path: `test-results/block9b2-layouts/${info.project.name}-${name}.png`,
      fullPage: true,
    });
  }
  const csv =
    'date,description,amount,currency,reference\n2026-11-19,CSV groceries,-12.34,AUD,csv-expense\n2026-11-19,CSV groceries,-12.34,AUD,csv-expense\n2026-11-19,CSV income,100.00,AUD,csv-income';
  async function upload() {
    await page.getByLabel('Browse Files', { exact: true }).setInputFiles({
      name: 'fictional.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await page
      .getByRole('button', { name: 'Analyze Statement', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: /Confirm column mapping/ }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Review Transactions', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Review transactions', exact: true }),
    ).toBeVisible();
  }
  await page.goto('/expenses/import');
  await expect(page.getByLabel('Statement account')).toContainText('AUD');
  await capture('upload');
  await upload();
  await expect(page.getByText(/Possible duplicate:/).first()).toBeVisible();
  await page
    .getByLabel('Decision row 2', { exact: true })
    .selectOption('keep_both');
  await page
    .getByLabel('Decision row 3', { exact: true })
    .selectOption('exclude');
  await capture('review');
  await page
    .getByRole('button', { name: 'Confirm Import', exact: true })
    .click();
  await expect(
    page.getByText('2 transactions imported from 3 reviewed rows.'),
  ).toBeVisible();
  await capture('complete');
  await page
    .getByRole('link', { name: 'View Transactions', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'View transaction CSV groceries',
      exact: true,
    })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Transaction category', { exact: true })
    .selectOption({ label: 'General expenses' });
  await expect(dialog.getByLabel('Transaction category')).toBeEnabled();
  await expect(
    dialog.getByLabel('Transaction category').locator('option:checked'),
  ).toHaveText('General expenses');
  await capture('categorized');
  await dialog
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click();
  await page.reload();
  await page
    .getByRole('button', {
      name: 'View transaction CSV groceries',
      exact: true,
    })
    .click();
  await expect(
    dialog.getByLabel('Transaction category').locator('option:checked'),
  ).toHaveText('General expenses');
  await dialog
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Expenses navigation' })
    .getByRole('link', { name: 'Overview', exact: true })
    .click();
  await expect(page.getByText(/Balance AUD 87.66/)).toBeVisible();
  await capture('reconciliation');
  const wid = await page.getByLabel('Persistent workspace').inputValue();
  expect(
    (
      await page.request.get('/api/v1/workspaces/' + randomUUID() + '/imports')
    ).status(),
  ).toBe(404);
  await page.goto('/expenses/import?workspace=' + wid);
  await upload();
  for (const n of [2, 3, 4])
    await page
      .getByLabel('Decision row ' + n, { exact: true })
      .selectOption('exclude');
  await page
    .getByRole('button', { name: 'Confirm Import', exact: true })
    .click();
  await expect(
    page.getByText('0 transactions imported from 3 reviewed rows.'),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Import history' }),
  ).toBeVisible();
  await expect(page.getByText('fictional.csv', { exact: true })).toHaveCount(2);
  await page.goto('/expenses?workspace=' + wid);
  await expect(page.getByText(/Balance AUD 87.66/)).toBeVisible();
  expect(errors).toEqual([]);
});
