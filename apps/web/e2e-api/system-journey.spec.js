import { test, expect } from '../e2e-support/api-test.js';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

// One browser session and workspace across domains. API-driven financial setup
// is deliberate; existing domain suites separately exercise the full editors.
test('connected financial journey reconciles receipts, CSV and portfolio across refresh', async ({
  page,
  request,
}, info) => {
  test.setTimeout(120000);
  const headers = {
    Origin: 'http://localhost:5173',
    'X-EasyFinance-CSRF': '1',
  };
  const email = `journey-${randomUUID()}@example.test`,
    password = 'Fictional-system-journey!';
  expect(
    (
      await request.post('/api/v1/auth/register', {
        headers,
        data: { fullName: 'System Journey', email, password },
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
  await page.goto('/expenses');
  await expect(page.getByLabel('Persistent workspace')).toContainText('owner');
  const wid = await page.getByLabel('Persistent workspace').inputValue(),
    base = `/api/v1/workspaces/${wid}`;
  async function api(method, path, data) {
    const r = await page.request[method](base + path, {
      headers,
      ...(data === undefined ? {} : { data }),
    });
    expect(r.status(), `${method} ${path}`).toBe(200);
    return (await r.json()).data;
  }
  await mkdir('test-results/block9b5-layouts', { recursive: true });
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
      path: `test-results/block9b5-layouts/${info.project.name}-${name}.png`,
      fullPage: true,
    });
  }
  const account = (await api('get', '/accounts'))[0];
  const expense = await api('post', '/transactions', {
    id: randomUUID(),
    accountId: account.id,
    currency: 'AUD',
    date: '2026-11-19',
    description: 'Journey expense',
    type: 'expense',
    amountMinor: '-1234',
  });
  const category = (await api('get', '/categories')).find(
    (x) => x.kind === 'expense',
  );
  expect(category).toBeTruthy();
  await api('patch', `/transactions/${expense.id}/category`, {
    version: expense.version,
    categoryId: category.id,
  });
  const client = await api('post', '/clients', {
    id: randomUUID(),
    type: 'business',
    name: 'Journey client',
    businessName: 'Fictional',
    email: 'journey-client@example.test',
    defaultCurrency: 'AUD',
    paymentTerms: '14',
  });
  let invoice = await api('post', '/invoices', {
    id: randomUUID(),
    number: `J-${randomUUID()}`,
    clientId: client.id,
    accountId: account.id,
    currency: 'AUD',
    issuedDate: '2026-11-19',
    dueDate: '2026-12-19',
    paymentTerms: '14',
    items: [
      {
        description: 'Journey work',
        quantity: '1',
        unit: 'hours',
        unitPrice: '100',
        taxRate: '0',
      },
    ],
    discount: '0',
    notes: '',
    paymentInstructions: '',
  });
  expect((await api('get', '/income/summary?currency=AUD')).receivedMinor).toBe(
    '0',
  );
  invoice = await api('post', `/invoices/${invoice.id}/issue`, {
    version: invoice.version,
  });
  const payment = (amountMinor) => ({
    idempotencyKey: randomUUID(),
    amountMinor,
    date: '2026-11-19',
    method: 'bank transfer',
    reference: 'Journey receipt',
  });
  const partial = await api(
    'post',
    `/invoices/${invoice.id}/payments`,
    payment('4000'),
  );
  expect(partial.invoice.outstandingMinor).toBe('6000');
  await page.goto(`/income/invoices/${invoice.id}?workspace=${wid}`);
  await expect(
    page.getByRole('heading', { name: 'Invoice Details', exact: true }),
  ).toBeVisible();
  await capture('partial');
  const final = await api(
    'post',
    `/invoices/${invoice.id}/payments`,
    payment('6000'),
  );
  expect(final.invoice.outstandingMinor).toBe('0');
  await page.reload();
  await expect(page.locator('.invoice-status')).toHaveText('Paid');
  await capture('paid');
  const before = await api('get', '/accounts');
  expect(before[0].balanceMinor).toBe('8766');
  // Exact date/amount/description candidate is reviewed explicitly, not auto-linked.
  await page.goto('/expenses/import?workspace=' + wid);
  await page.getByLabel('Browse Files', { exact: true }).setInputFiles({
    name: 'journey.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `date,description,amount,currency\n2026-11-19,Invoice ${invoice.number} receipt,40.00,AUD`,
    ),
  });
  await page
    .getByRole('button', { name: 'Analyze Statement', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Review Transactions', exact: true })
    .click();
  await expect(page.getByText(/Possible duplicate:/).first()).toBeVisible();
  await page
    .getByLabel('Decision row 2', { exact: true })
    .selectOption('exclude');
  await capture('duplicate-review');
  await page
    .getByRole('button', { name: 'Confirm Import', exact: true })
    .click();
  await expect(
    page.getByText('0 transactions imported from 1 reviewed rows.'),
  ).toBeVisible();
  expect(await api('get', '/accounts')).toEqual(before);
  const command = (action, payload, version) =>
    api('post', '/investments/commands', {
      key: randomUUID(),
      action,
      payload,
      ...(version === undefined ? {} : { version }),
    });
  const brokerage = await command('createAccount', {
    name: 'Journey broker',
    institution: 'Fictional',
    currency: 'AUD',
  });
  const holding = await command('create', {
    form: {
      name: 'Journey fund',
      assetType: 'ETFs',
      customType: '',
      symbol: 'JOURNEY',
      investmentAccountId: brokerage.result,
      currency: 'AUD',
      date: '2026-11-01',
      quantity: '2.5',
      unitPrice: '10.12345678',
      fee: '1.00',
      amount: '',
      estimatedValue: '30.00',
      valuedAt: '2026-11-01',
      notes: '',
      tags: '',
      interestInfo: '',
    },
  });
  await command(
    'recordMovement',
    {
      id: holding.result,
      form: {
        type: 'sell',
        currency: 'AUD',
        date: '2026-11-02',
        quantity: '1',
        unitPrice: '20',
        fee: '0.50',
        notes: '',
      },
    },
    1,
  );
  await page.goto(`/investments/${holding.result}?workspace=${wid}`);
  await expect(page.locator('.income-kpis')).toContainText('15.79');
  await page.getByRole('button', { name: 'Update Value', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Valuation date', { exact: true }).fill('2026-11-03');
  await dialog.getByLabel('Estimated value', { exact: true }).fill('35.12');
  await dialog
    .getByRole('button', { name: 'Save Valuation', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.income-kpis')).toContainText('35.12');
  await capture('portfolio');
  expect(await api('get', '/accounts')).toEqual(before);
  expect(
    (await api('get', `/income/summary?currency=AUD&clientId=${client.id}`))
      .receivedMinor,
  ).toBe('10000');
  await page.goto('/settings?workspace=' + wid);
  await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
  await page.getByLabel('Full Name', { exact: true }).fill('Journey saved');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page.locator('.settings-feedback')).toContainText(
    'preferences saved',
  );
  await page.goto('/settings/automations?workspace=' + wid);
  await page
    .getByRole('button', { name: 'Create Automation', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByLabel('Automation Name')
    .fill('Journey review');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save Automation', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.settings-table')).toContainText('Journey review');
  await expect(
    page.getByRole('button', { name: 'Execution Unavailable' }),
  ).toBeDisabled();
  await capture('automation');
  await page.goto('/expenses?workspace=' + wid);
  await expect(page.getByText(/Balance AUD 87.66/)).toBeVisible();
  await capture('reconciled');
  for (const path of ['/', '/dashboard']) {
    await page.goto(path + '?workspace=' + wid);
    await expect(page.locator('.income-kpis')).toContainText('AUD 100.00');
    await expect(page.locator('.income-kpis')).toContainText('AUD 12.34');
    await expect(page.locator('.income-kpis')).toContainText('AUD 87.66');
    await page.reload();
    await expect(page.locator('.income-kpis')).toContainText('AUD 87.66');
  }

  const guestEmail = `journey-viewer-${randomUUID()}@example.test`;
  expect(
    (
      await request.post('/api/v1/auth/register', {
        headers,
        data: { fullName: 'Journey Viewer', email: guestEmail, password },
      })
    ).status(),
  ).toBe(200);
  const guestLogin = await request.post('/api/v1/auth/login', {
    headers,
    data: { email: guestEmail, password },
  });
  expect(guestLogin.status()).toBe(200);
  const guestId = (await guestLogin.json()).data.id;
  const invitation = await api('post', '/invitations', {
    email: guestEmail,
    role: 'viewer',
  });
  expect(
    (
      await request.post('/api/v1/invitations/accept', {
        headers,
        data: { token: invitation.token },
      })
    ).status(),
  ).toBe(200);
  expect((await request.get(base + '/accounts')).status()).toBe(200);
  expect(
    (
      await request.post(base + '/transactions', {
        headers,
        data: {
          id: randomUUID(),
          accountId: account.id,
          currency: 'AUD',
          date: '2026-11-19',
          description: 'Denied viewer write',
          type: 'expense',
          amountMinor: '-100',
        },
      })
    ).status(),
  ).toBe(403);
  const member = (await api('get', '/members')).find(
    (x) => x.userId === guestId,
  );
  await api('patch', `/members/${member.id}`, {
    role: 'viewer',
    status: 'revoked',
  });
  for (const path of [
    '/accounts',
    '/invoices?currency=AUD',
    '/investments',
    '/settings',
  ])
    expect((await request.get(base + path)).status()).toBe(404);
  expect(errors).toEqual([]);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  for (const path of [
    '/accounts',
    '/invoices?currency=AUD',
    '/imports',
    '/investments',
    '/settings',
  ])
    expect((await page.request.get(base + path)).status()).toBe(401);
});
