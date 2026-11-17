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
  await page.getByRole('button', { name: 'Open profile', exact: true }).click();
  await page
    .getByRole('link', { name: 'Profile & Settings', exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Profile & Settings', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Full Name', { exact: true })).toBeVisible();
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
  await mkdir('test-results/block6-layouts', { recursive: true });
  await page.screenshot({
    path: `test-results/block6-layouts/${info.project.name}-${name}.png`,
    fullPage: true,
  });
  await page.screenshot({
    path: `test-results/block6-layouts/${info.project.name}-${name}-viewport.png`,
  });
}
async function tab(page, name) {
  await page
    .getByRole('navigation', { name: 'Settings navigation' })
    .getByRole('link', { name, exact: true })
    .click();
}
async function identity(page, value) {
  await page.getByRole('button', { name: 'Open profile', exact: true }).click();
  await page.getByLabel('Demo identity', { exact: true }).selectOption(value);
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function close(page) {
  await page
    .getByRole('button', { name: 'Close dialog', exact: true })
    .last()
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
test('Settings profile, personal formats, workspace configuration, unsaved changes and security', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  await capture(page, 'f19-profile', info);
  await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
  await page.getByLabel('Full Name', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Name is required');
  await page.getByLabel('Full Name', { exact: true }).fill('Alex Updated');
  await page
    .getByLabel('Preferred Language', { exact: true })
    .selectOption('pt-BR');
  await page
    .getByLabel('Number Format', { exact: true })
    .selectOption('1.234,56');
  await page
    .getByLabel('Date Format', { exact: true })
    .selectOption('YYYY-MM-DD');
  await capture(page, 'profile-editing', info);
  await tab(page, 'Sharing & Permissions');
  await expect(page.getByRole('dialog')).toContainText('Unsaved Settings');
  await page.getByRole('button', { name: 'Keep Editing', exact: true }).click();
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Profile and personal' }),
  ).toBeVisible();
  await expect(
    page.getByText('Preview: 2026-10-31 · AUD 1.234,56'),
  ).toBeVisible();
  await page.getByLabel('Workspace Name', { exact: true }).fill('Family Demo');
  await page
    .getByLabel('Workspace Base Currency', { exact: true })
    .selectOption('EUR');
  await capture(page, 'workspace-preferences', info);
  await page
    .getByRole('button', { name: 'Save Workspace Changes', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Workspace settings saved' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'View limitation', exact: true })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toContainText('No password');
  await close(page);
  await page
    .getByRole('button', { name: 'View Current Session', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('alex@example.com');
  await close(page);
  await page
    .getByRole('button', { name: 'Request Account Deletion', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm Demo Request', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'No deletion request sent' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
  await page.getByLabel('Full Name', { exact: true }).fill('Discard Me');
  await page
    .getByRole('button', { name: 'Cancel Profile Changes', exact: true })
    .click();
  await expect(page.getByLabel('Full Name', { exact: true })).toHaveValue(
    'Alex Updated',
  );
  await identity(page, 'sam-demo');
  await expect(page.getByLabel('Full Name', { exact: true })).toHaveValue(
    'Sam Taylor',
  );
  await expect(
    page.getByLabel('Workspace Name', { exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel('Number Format', { exact: true })).toHaveValue(
    '1,234.56',
  );
  await identity(page, 'demo-user');
  await page.getByText('Demonstration states', { exact: true }).click();
  await page
    .getByLabel('Settings data state', { exact: true })
    .selectOption('error');
  await expect(page.getByRole('alert')).toContainText('Settings unavailable');
  await page
    .getByRole('button', { name: 'Retry Settings', exact: true })
    .click();
  await expect(page.getByLabel('Full Name', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
});
test('Sharing invitation lifecycle, role management, revocation and read-only financial routes', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  await tab(page, 'Sharing & Permissions');
  await capture(page, 'f20-sharing', info);
  await page
    .getByRole('button', { name: 'Invite Member', exact: true })
    .click();
  await page.getByLabel('Invitation Email', { exact: true }).fill('bad');
  await page
    .getByRole('button', { name: 'Send Invitation (Demo)', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('valid email');
  await page
    .getByLabel('Invitation Email', { exact: true })
    .fill('alex@example.com');
  await page
    .getByRole('button', { name: 'Send Invitation (Demo)', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'already an active member',
  );
  await page
    .getByLabel('Invitation Email', { exact: true })
    .fill('new@example.com');
  await capture(page, 'invite-member', info);
  await page
    .getByRole('button', { name: 'Send Invitation (Demo)', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Invitation prepared' }),
  ).toBeVisible();
  const inv = page
    .locator('article')
    .filter({ has: page.getByText('new@example.com', { exact: true }) });
  await inv
    .getByRole('button', { name: 'Resend Invitation', exact: true })
    .click();
  await inv
    .getByRole('button', { name: 'Simulate Acceptance', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm Demo Acceptance', exact: true })
    .click();
  await expect(
    page.getByRole('table').getByText('new@example.com', { exact: true }),
  ).toBeVisible();
  const sam = page
    .getByRole('row')
    .filter({ has: page.getByText('sam@example.com', { exact: true }) });
  await sam.getByRole('button', { name: 'Change Role', exact: true }).click();
  await page.getByLabel('Member Role', { exact: true }).selectOption('viewer');
  await capture(page, 'role-change', info);
  await page.getByRole('button', { name: 'Save Role', exact: true }).click();
  await expect(sam).toContainText('viewer');
  await identity(page, 'sam-demo');
  await expect(
    page.getByRole('button', { name: 'Invite Member', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('link', { name: 'Income', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('link', { name: 'Invoices', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /Invoices/ }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open profile', exact: true }).click();
  await page
    .getByRole('link', { name: 'Profile & Settings', exact: true })
    .filter({ visible: true })
    .click();
  await tab(page, 'Sharing & Permissions');
  await identity(page, 'demo-user');
  await sam.getByRole('button', { name: 'Remove Member', exact: true }).click();
  await capture(page, 'remove-member', info);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(sam).toContainText('active');
  await sam.getByRole('button', { name: 'Remove Member', exact: true }).click();
  await page
    .getByRole('button', { name: 'Remove Access', exact: true })
    .click();
  await identity(page, 'sam-demo');
  await expect(
    page.getByRole('heading', { name: 'No Workspace Access', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('new@example.com', { exact: true })).toHaveCount(
    0,
  );
  await identity(page, 'demo-user');
  await expect(
    page.getByRole('heading', { name: 'Sharing & Permissions', exact: true }),
  ).toBeVisible();
  const pending = page
    .locator('article')
    .filter({ has: page.getByText('partner@example.com', { exact: true }) });
  await pending
    .getByRole('button', { name: 'Revoke Invitation', exact: true })
    .click();
  await expect(pending).toContainText('revoked');
  expect(errors).toEqual([]);
});
test('Automations configure, simulate, pause, delete and isolate in-app notification preferences', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  await tab(page, 'Automations & Notifications');
  await page
    .getByRole('button', { name: 'Create Automation', exact: true })
    .click();
  await page
    .getByLabel('Automation Type', { exact: true })
    .selectOption('alert');
  await page
    .getByRole('button', { name: 'Save Automation', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('name');
  await page
    .getByLabel('Automation Name', { exact: true })
    .fill('Monthly Review');
  await capture(page, 'automation-editor', info);
  await page
    .getByRole('button', { name: 'Save Automation', exact: true })
    .click();
  await capture(page, 'f21-automations', info);
  const row = page
    .getByRole('row')
    .filter({ has: page.getByText('Monthly Review', { exact: true }) });
  await row
    .getByRole('button', { name: 'Pause Automation', exact: true })
    .click();
  await expect(
    row.getByRole('button', { name: 'Simulate Next Occurrence', exact: true }),
  ).toBeDisabled();
  await row
    .getByRole('button', { name: 'Resume Automation', exact: true })
    .click();
  await row
    .getByRole('button', { name: 'Edit Automation', exact: true })
    .click();
  await page
    .getByLabel('Automation Frequency', { exact: true })
    .selectOption('fortnightly');
  await page
    .getByRole('button', { name: 'Save Automation', exact: true })
    .click();
  await row
    .getByRole('button', { name: 'Simulate Next Occurrence', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Run Demo Once', exact: true })
    .click();
  await expect(page.locator('#automation-activity')).toContainText('completed');
  await page
    .getByRole('button', { name: 'Retry Same Occurrence', exact: true })
    .click();
  await expect(page.locator('#automation-activity article')).toHaveCount(1);
  await capture(page, 'automation-activity', info);
  await page
    .getByRole('button', { name: 'Notifications', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'Review your financial overview',
  );
  await capture(page, 'notification-center', info);
  await page.getByRole('button', { name: 'Mark as Read', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Read');
  await page
    .getByRole('button', { name: 'Mark All as Read', exact: true })
    .click();
  await close(page);
  await page.getByLabel('In-app Financial alerts', { exact: true }).uncheck();
  await page
    .getByLabel('Notification Schedule', { exact: true })
    .selectOption('daily');
  await capture(page, 'notification-preferences', info);
  await page
    .getByRole('button', { name: 'Save Notification Preferences', exact: true })
    .click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Notification preferences saved' }),
  ).toBeVisible();
  await identity(page, 'viewer-demo');
  await expect(
    page.getByRole('button', { name: 'Create Automation', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Notifications', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('No notifications');
  await close(page);
  await identity(page, 'demo-user');
  await row
    .getByRole('button', { name: 'Delete Automation', exact: true })
    .click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await row
    .getByRole('button', { name: 'Delete Automation', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm Delete', exact: true })
    .click();
  await expect(
    page.getByText('No automations configured.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Manage Rules', exact: true }).click();
  await expect(page).toHaveURL(/expenses\/categories/);
  expect(errors).toEqual([]);
});
test('Recurring automation reuses invoice templates and creates one reviewable draft', async ({
  page,
}, info) => {
  const errors = watch(page);
  await login(page);
  await tab(page, 'Automations & Notifications');
  await page
    .getByRole('button', { name: 'Create Invoice Template', exact: true })
    .click();
  await page
    .getByLabel('Template Name', { exact: true })
    .fill('Monthly service');
  await page
    .getByLabel('Description 1', { exact: true })
    .fill('Review service');
  await page.getByLabel('Quantity 1', { exact: true }).fill('1.25');
  await page.getByLabel('Unit price 1', { exact: true }).fill('100');
  await page
    .getByRole('button', { name: 'Save Review Template', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Create Automation', exact: true })
    .click();
  await page
    .getByLabel('Automation Name', { exact: true })
    .fill('Prepare Monthly Draft');
  await page
    .getByLabel('Invoice Template', { exact: true })
    .selectOption({ label: 'Monthly service' });
  await page
    .getByRole('button', { name: 'Save Automation', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Simulate Next Occurrence', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Run Demo Once', exact: true })
    .click();
  await expect(page.locator('#automation-activity')).toContainText(
    'pending-review',
  );
  await page
    .getByRole('button', { name: 'Retry Same Occurrence', exact: true })
    .click();
  await expect(page.locator('#automation-activity article')).toHaveCount(1);
  await page
    .getByRole('link', { name: 'Review Invoice Draft', exact: true })
    .click();
  await expect(
    page.getByText('Review service', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText('AUD 125.00', { exact: true }).first(),
  ).toBeVisible();
  await capture(page, 'generated-draft', info);
  expect(errors).toEqual([]);
});
