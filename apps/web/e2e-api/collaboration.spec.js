import { test, expect } from '../e2e-support/api-test.js';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
test('settings, local invitations and automation configurations persist with permissions', async ({
  page,
  request,
  browser,
}, info) => {
  const password = 'Fictional-collaboration-browser!',
    email = `owner-${randomUUID()}@example.test`,
    recipient = `viewer-${randomUUID()}@example.test`;
  const headers = {
    Origin: 'http://localhost:5173',
    'X-EasyFinance-CSRF': '1',
  };
  for (const e of [email, recipient])
    expect(
      (
        await request.post('/api/v1/auth/register', {
          headers,
          data: { fullName: 'Settings Browser', email: e, password },
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
  await page.goto('/settings');
  await expect(page.getByLabel('Persistent workspace')).toContainText('owner');
  const wid = await page.getByLabel('Persistent workspace').inputValue();
  await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
  await page
    .getByLabel('Full Name', { exact: true })
    .fill('Persistent Profile');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page.locator('.settings-feedback')).toContainText(
    'preferences saved',
  );
  await page.reload();
  await expect(page.getByLabel('Full Name', { exact: true })).toHaveValue(
    'Persistent Profile',
  );
  await mkdir('test-results/block9b4-layouts', { recursive: true });
  async function capture(name) {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator('img')
        .evaluateAll((images) =>
          images.every((image) => image.complete && image.naturalWidth > 0),
        ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/block9b4-layouts/${info.project.name}-${name}.png`,
      fullPage: true,
    });
    await page.screenshot({
      path: `test-results/block9b4-layouts/${info.project.name}-${name}-viewport.png`,
    });
  }
  await capture('f19-settings');
  await page.goto(`/settings/sharing?workspace=${wid}`);
  await page
    .getByRole('button', { name: 'Invite Member', exact: true })
    .click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Invitation Email').fill(recipient);
  await dialog.getByLabel('Invitation Role').selectOption('viewer');
  await dialog
    .getByRole('button', { name: 'Prepare Local Invitation' })
    .click();
  dialog = page.getByRole('dialog', { name: 'Local Invitation Prepared' });
  await expect(dialog).toBeVisible();
  const token = await dialog.getByLabel('Local invitation token').inputValue();
  await dialog.getByRole('button', { name: 'Close invitation secret' }).click();
  await expect(page.locator('.settings-invitation')).toContainText('pending');
  await capture('f20-sharing');
  const context = await browser.newContext({
    viewport: info.project.use.viewport,
  });
  const guest = await context.newPage();
  await guest.goto('/login');
  await guest.getByLabel('Email address', { exact: true }).fill(recipient);
  await guest.getByLabel('Password', { exact: true }).fill(password);
  await guest.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(guest).toHaveURL(/onboarding/);
  for (let i = 0; i < 3; i++)
    await guest.getByRole('button', { name: /Continue/ }).click();
  await guest
    .getByRole('button', { name: /Start|Finish|Go to|Complete/ })
    .click();
  await expect(guest).toHaveURL('http://localhost:5173/');
  await guest.goto('/settings/sharing');
  await guest.getByText('Accept a local invitation', { exact: true }).click();
  await guest.getByLabel('Invitation token', { exact: true }).fill(token);
  await guest
    .getByRole('button', { name: 'Accept Invitation', exact: true })
    .click();
  await expect(guest.getByLabel('Persistent workspace')).toHaveValue(wid);
  await expect(
    guest.getByRole('button', { name: 'Invite Member', exact: true }),
  ).toBeDisabled();
  await guest.goto(`/settings/automations?workspace=${wid}`);
  await expect(
    guest.getByRole('button', { name: 'Create Automation', exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.locator('.settings-table')).toContainText(recipient);
  await page.goto(`/settings/automations?workspace=${wid}`);
  await page
    .getByRole('button', { name: 'Create Automation', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Automation Name').fill('Monthly financial review');
  await capture('f21-editor');
  await dialog
    .getByRole('button', { name: 'Save Automation', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.settings-table')).toContainText(
    'Monthly financial review',
  );
  await page
    .getByRole('button', { name: 'Pause Automation', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Resume Automation', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Resume Automation', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Execution Unavailable' }),
  ).toBeDisabled();
  await expect(
    page.getByText('No executions recorded.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Save Notification Preferences', exact: true })
    .click();
  await expect(page.locator('.settings-feedback')).toContainText(
    'Notification preferences saved',
  );
  await capture('f21-automations');
  await page.goto(`/settings/sharing?workspace=${wid}`);
  const row = page.getByRole('row').filter({ hasText: recipient });
  await row.getByRole('button', { name: 'Remove Member', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Remove Access', exact: true })
    .click();
  await expect(row).toContainText('revoked');
  await guest.reload();
  await expect(
    guest.getByText('Select an authorized workspace.', { exact: true }),
  ).toBeVisible();
  await context.close();
  expect(errors).toEqual([]);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
});
