import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
test('Home, Dashboard and category management use persistent authorized records', async ({
  page,
  request,
}, info) => {
  test.setTimeout(90000);
  const headers = {
      Origin: 'http://localhost:5173',
      'X-EasyFinance-CSRF': '1',
    },
    email = `report-${randomUUID()}@example.test`,
    password = 'Fictional-report-browser!';
  expect(
    (
      await request.post('/api/v1/auth/register', {
        headers,
        data: { fullName: 'Report Browser', email, password },
      })
    ).status(),
  ).toBe(200);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 500)
      errors.push(`${r.status()} ${new URL(r.url()).pathname}`);
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
  await expect(page.getByLabel('Persistent workspace')).toContainText('owner');
  const wid = await page.getByLabel('Persistent workspace').inputValue(),
    root = `/api/v1/workspaces/${wid}`;
  const account = (await (await page.request.get(root + '/accounts')).json())
    .data[0];
  for (const [type, amountMinor, description] of [
    ['expense', '-2345', 'Report travel'],
    ['income', '10000', 'Report income'],
  ])
    expect(
      (
        await page.request.post(root + '/transactions', {
          headers,
          data: {
            id: randomUUID(),
            accountId: account.id,
            currency: 'AUD',
            date: '2026-11-19',
            type,
            amountMinor,
            description,
          },
        })
      ).status(),
    ).toBe(200);
  await mkdir('test-results/block10a-layouts', { recursive: true });
  async function capture(name) {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator('img')
        .evaluateAll((xs) => xs.every((x) => x.complete && x.naturalWidth > 0)),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/block10a-layouts/${info.project.name}-${name}.png`,
      fullPage: true,
    });
    await page.screenshot({
      path: `test-results/block10a-layouts/${info.project.name}-${name}-viewport.png`,
    });
  }
  await page.reload();
  await expect(page.locator('.income-kpis')).toContainText('AUD 100.00');
  await expect(page.locator('.income-kpis')).toContainText('AUD 23.45');
  await capture('home');
  await page.goto('/expenses/categories?workspace=' + wid);
  await page.getByRole('button', { name: 'Add Category', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Category name').fill('Travel');
  await dialog
    .getByRole('button', { name: 'Save Category', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Travel', exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Edit Travel', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Category name').fill('Business Travel');
  await dialog
    .getByRole('button', { name: 'Save Category', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await capture('categories');
  await page.goto('/expenses/transactions?workspace=' + wid);
  await page
    .getByRole('button', {
      name: 'View transaction Report travel',
      exact: true,
    })
    .click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Transaction category', { exact: true })
    .selectOption({ label: 'Business Travel' });
  await expect(dialog.getByLabel('Transaction category')).toBeEnabled();
  await dialog
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click();
  await page.goto('/dashboard?workspace=' + wid);
  await expect(page.locator('.income-kpis')).toContainText('AUD 76.55');
  await expect(
    page.getByRole('heading', { name: 'Financial Overview', exact: true }),
  ).toBeVisible();
  await capture('dashboard');
  await page
    .getByLabel('Category', { exact: true })
    .selectOption({ label: 'Business Travel' });
  await expect(page.locator('.income-kpis')).toContainText('AUD 0.00');
  await expect(page.locator('.income-kpis')).toContainText('AUD 23.45');
  await expect(page.locator('.balance-section')).toContainText('Unavailable');
  await capture('filtered');
  await page.goto('/expenses/categories?workspace=' + wid);
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: 'Archive Business Travel', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Archive Business Travel', exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Edit Business Travel', exact: true }),
  ).toBeDisabled();
  await page.goto('/dashboard?workspace=' + wid);
  await page
    .getByLabel('Category', { exact: true })
    .selectOption({ label: 'Business Travel (archived)' });
  await expect(page.locator('.income-kpis')).toContainText('AUD 23.45');
  await page.getByLabel('From date', { exact: true }).fill('2026-11-20');
  await expect(page.locator('.income-kpis')).toContainText('AUD 0.00');
  await expect(
    page.getByText('No transactions for this selection.', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Category', { exact: true }).selectOption('');
  await page.getByLabel('Currency', { exact: true }).selectOption('USD');
  await expect(page.locator('.income-kpis')).toContainText('USD 0.00');
  await capture('empty-currency');
  await page.goto('/dashboard?workspace=' + randomUUID());
  await expect(
    page.getByText('Select an authorized workspace.', { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
