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
async function capture(page, name, info) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mkdir('test-results/block2-layouts', { recursive: true });
  await page.screenshot({
    path: `test-results/block2-layouts/${info.project.name}-${name}.png`,
    fullPage: true,
  });
  await page.screenshot({
    path: `test-results/block2-layouts/${info.project.name}-${name}-viewport.png`,
  });
}
async function history(page, info) {
  if (info.project.name === 'mobile') {
    await page
      .getByRole('button', { name: 'Open navigation and history' })
      .click();
    return page.getByRole('dialog', { name: 'Navigation & history' });
  }
  return page.locator('.workspace-sidebar');
}
test('assistant, history, attachments, retry and session isolation', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await capture(page, 'home-welcome', info);
  let sidebar = await history(page, info);
  await sidebar
    .getByRole('button', { name: 'Monthly spending analysis', exact: true })
    .click();
  await expect(page.getByText(/You spent AUD.*2,840.00/)).toBeVisible();
  await capture(page, 'home-response', info);
  await page.getByRole('button', { name: 'Review suggestions →' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Review AI suggestion' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Categorization suggestion' }),
  ).toHaveCount(0);
  await page.getByLabel('Select statement file').setInputFiles({
    name: 'sample.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('amount\n10'),
  });
  await expect(page.getByText(/Selected only, not uploaded/)).toBeVisible();
  await page.getByRole('button', { name: 'Remove attachment' }).click();
  await page.getByLabel('Select statement file').setInputFiles({
    name: 'bad.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('x'),
  });
  await expect(page.getByRole('alert')).toHaveText('Choose a CSV or PDF file.');
  const composer = page.getByLabel('Ask about your finances');
  await composer.fill('Tell me a joke');
  await composer.press('Shift+Enter');
  await expect(composer).toHaveValue('Tell me a joke\n');
  await composer.press('Enter');
  await expect(page.getByText(/This question isn’t supported/)).toBeVisible();
  await composer.fill('/demo-error');
  await composer.press('Enter');
  await page.getByRole('button', { name: 'Retry response' }).click();
  await expect(
    page.getByRole('button', { name: 'Retry response' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Send message' }),
  ).toBeEnabled();
  sidebar = await history(page, info);
  await sidebar
    .getByRole('button', { name: 'Rename Monthly spending analysis' })
    .click();
  await page
    .getByRole('dialog', { name: 'Rename conversation' })
    .getByLabel('Conversation title')
    .fill('My spending review');
  await page.getByRole('button', { name: 'Save name' }).click();
  await sidebar.getByLabel('Search conversations').fill('no-such-chat');
  await expect(
    sidebar.getByText('No conversations match your search.'),
  ).toBeVisible();
  await sidebar.getByLabel('Search conversations').fill('');
  await sidebar
    .getByRole('button', { name: 'Delete My spending review' })
    .click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await sidebar
    .getByRole('button', { name: 'Delete My spending review' })
    .click();
  await page
    .getByRole('button', { name: 'Delete conversation', exact: true })
    .click();
  await expect(
    sidebar.getByRole('button', { name: 'My spending review', exact: true }),
  ).toHaveCount(0);
  await sidebar.getByRole('button', { name: /New chat/ }).click();
  await expect(page.getByRole('heading', { name: /^Welcome,/ })).toBeVisible();
  await page.getByRole('button', { name: 'Open profile' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await login(page);
  sidebar = await history(page, info);
  await expect(
    sidebar.getByRole('button', {
      name: 'Monthly spending analysis',
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('dashboard filter reconciliation and data states', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await page
    .getByRole('link', { name: 'Dashboard', exact: true })
    .filter({ visible: true })
    .click();
  const kpis = page.locator('.kpi-grid');
  await expect(kpis).toContainText('7,250.00');
  await expect(kpis).toContainText('2,840.00');
  await expect(kpis).toContainText('4,410.00');
  await capture(page, 'dashboard', info);
  await page.getByLabel('Period', { exact: true }).selectOption('september');
  await expect(kpis).toContainText('6,700.00');
  await page.getByLabel('Period', { exact: true }).selectOption('october');
  await page
    .getByLabel('Financial account', { exact: true })
    .selectOption('checking');
  await expect(kpis).toContainText('4,900.00');
  await expect(kpis).toContainText('2,668.99');
  await page.getByLabel('Currency', { exact: true }).selectOption('EUR');
  await expect(kpis).toContainText('EUR');
  await expect(kpis).toContainText('100.00');
  await expect(kpis).toContainText('20.00');
  await page.getByLabel('Currency', { exact: true }).selectOption('AUD');
  await page.getByLabel('Participant', { exact: true }).selectOption('sam');
  await expect(kpis).toContainText('883.60');
  await expect(page.locator('.balance-section')).toContainText('Unavailable');
  await page.getByLabel('Participant', { exact: true }).selectOption('all');
  await page.getByLabel('Demo data state').selectOption('partial');
  await expect(
    page.getByText(/Partial data: records only through/),
  ).toBeVisible();
  await expect(page.locator('.balance-section')).toContainText('Unavailable');
  await capture(page, 'dashboard-partial', info);
  await page.getByLabel('Demo data state').selectOption('empty');
  await expect(
    page.getByRole('heading', { name: 'No transactions for this selection' }),
  ).toBeVisible();
  await expect(kpis).toContainText('Unavailable');
  await page.getByLabel('Demo data state').selectOption('error');
  await expect(
    page.getByRole('heading', { name: 'Financial data unavailable' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry with normal sample' }).click();
  await expect(kpis).toContainText('7,250.00');
  const sidebar = await history(page, info);
  await sidebar.getByLabel('Workspace', { exact: true }).selectOption('empty');
  if (info.project.name === 'mobile') await page.keyboard.press('Escape');
  await expect(
    page.getByRole('heading', { name: 'No transactions for this selection' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
