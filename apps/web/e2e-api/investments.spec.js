import 'dotenv/config';
import { disposableClient } from '../../../database/scripts/client.js';
import { test, expect } from '../e2e-support/api-test.js';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
test('investment positions, corrections and valuations persist without cash changes', async ({
  page,
  request,
}, info) => {
  const email = `investment-browser-${randomUUID()}@example.test`,
    password = 'Fictional-investment-browser!',
    headers = { Origin: 'http://localhost:5173', 'X-EasyFinance-CSRF': '1' };
  expect(
    (
      await request.post('/api/v1/auth/register', {
        headers,
        data: { fullName: 'Investment Browser', email, password },
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
  await page.goto('/investments');
  await expect(page.getByLabel('Persistent workspace')).toContainText('owner');
  const workspace = await page.getByLabel('Persistent workspace').inputValue();
  const accountsBefore = await (
    await page.request.get(`/api/v1/workspaces/${workspace}/accounts`)
  ).json();
  await mkdir('test-results/block9b3-layouts', { recursive: true });
  async function capture(name) {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/block9b3-layouts/${info.project.name}-${name}.png`,
      fullPage: true,
    });
    await page.screenshot({
      path: `test-results/block9b3-layouts/${info.project.name}-${name}-viewport.png`,
    });
  }
  await page
    .getByRole('link', { name: '＋ Add Investment', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add Institution / Account' }).click();
  let dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Account name', { exact: true })
    .fill('Manual brokerage');
  await dialog
    .getByLabel('Financial institution', { exact: true })
    .fill('Fictional broker');
  await dialog.getByRole('button', { name: 'Save Account' }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByLabel('Investment name', { exact: true })
    .fill('Persistent fractional fund');
  await page.getByLabel('Purchase date', { exact: true }).fill('2026-11-01');
  await page.getByLabel('Valuation date', { exact: true }).fill('2026-11-01');
  await page.getByLabel('Quantity', { exact: true }).fill('2.5');
  await page.getByLabel('Unit price', { exact: true }).fill('10.12345678');
  await page.getByLabel('Purchase fee', { exact: true }).fill('1');
  await page.getByLabel('Estimated current value', { exact: true }).fill('30');
  await capture('f17-editor');
  await page
    .getByRole('button', { name: 'Save Investment', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Persistent fractional fund',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('.income-kpis')).toContainText('26.31');
  await capture('f18-detail');
  await page.getByRole('button', { name: 'Record Sale', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Movement date', { exact: true }).fill('2026-11-02');
  await dialog.getByLabel('Movement quantity', { exact: true }).fill('1');
  await dialog.getByLabel('Movement unit price', { exact: true }).fill('20');
  await dialog.getByLabel('Movement fee', { exact: true }).fill('0.50');
  await capture('sale-dialog');
  await dialog
    .getByRole('button', { name: 'Save Movement', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.income-kpis')).toContainText('15.79');
  await page.getByRole('button', { name: 'Update Value', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Valuation date', { exact: true }).fill('2026-11-03');
  await dialog.getByLabel('Estimated value', { exact: true }).fill('35.12');
  await dialog
    .getByRole('button', { name: 'Save Valuation', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.income-kpis')).toContainText('35.12');
  // Correct the sale through the existing history confirmation workflow.
  const saleRow = page
    .getByRole('row')
    .filter({ has: page.getByText('sell', { exact: true }) });
  await saleRow
    .getByRole('button', { name: 'Edit Activity', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Movement unit price', { exact: true }).fill('21');
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: 'Confirm Correction' }).click();
  await expect(dialog).toHaveCount(0);
  await capture('corrected-history');
  const detailUrl = page.url();
  await page.getByRole('button', { name: 'Update Value', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Valuation date', { exact: true }).fill('2026-11-04');
  await dialog.getByLabel('Estimated value', { exact: true }).fill('35.12');
  await dialog
    .getByRole('button', { name: 'Save Valuation', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await capture('valued-history');
  await page
    .getByRole('link', { name: 'Back to Investments', exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp('workspace=' + workspace));
  await expect(
    page.getByRole('heading', { name: 'Investments', exact: true }),
  ).toBeVisible();
  await capture('f16-overview');
  await page.reload();
  await expect(
    page.getByText('Persistent fractional fund').first(),
  ).toBeVisible();
  const accountsAfter = await (
    await page.request.get(`/api/v1/workspaces/${workspace}/accounts`)
  ).json();
  expect(accountsAfter).toEqual(accountsBefore);
  await page.getByRole('button', { name: 'Open profile' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  expect(
    (
      await page.request.get(`/api/v1/workspaces/${workspace}/investments`)
    ).status(),
  ).toBe(401);
  const viewerEmail = `investment-viewer-${randomUUID()}@example.test`;
  expect(
    (
      await request.post('/api/v1/auth/register', {
        headers,
        data: { fullName: 'Investment Viewer', email: viewerEmail, password },
      })
    ).status(),
  ).toBe(200);
  const admin = disposableClient();
  try {
    const viewer = await admin.user.findUnique({
      where: { email: viewerEmail },
    });
    await admin.workspaceMember.create({
      data: { workspaceId: workspace, userId: viewer.id, role: 'viewer' },
    });
  } finally {
    await admin.$disconnect();
  }
  await page.getByLabel('Email address', { exact: true }).fill(viewerEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:5173/');
  await page.goto(detailUrl);
  await expect(page.getByLabel('Persistent workspace')).toContainText('viewer');
  await expect(
    page.getByRole('button', { name: 'Record Sale', exact: true }),
  ).toBeDisabled();
  await page.goto(`/investments/new?workspace=${workspace}`);
  await expect(
    page.getByText('Editing unavailable for this role or data state.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open profile' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  expect(errors).toEqual([]);
});
