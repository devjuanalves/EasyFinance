import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
async function capture(page, name, testInfo) {
  await expect(page.locator('body')).toBeVisible();
  await page.mouse.move(0, 0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator('img')
      .evaluateAll((images) =>
        images.every((img) => img.complete && img.naturalWidth > 0),
      ),
  ).toBe(true);
  await mkdir('test-results/auth-layouts', { recursive: true });
  await page.screenshot({
    path: `test-results/auth-layouts/${testInfo.project.name}-${name}.png`,
    fullPage: true,
  });
}
test('four responsive screens and complete simulated account lifecycle', async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await capture(page, 'login', testInfo);
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await capture(page, 'recovery', testInfo);
  await page.getByLabel('Email address').fill('preview@example.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText('Demo only: no email was sent.')).toBeVisible();
  await page.getByRole('link', { name: 'Back to sign in' }).click();
  await page.getByRole('link', { name: 'Create an account' }).click();
  await capture(page, 'signup', testInfo);
  await page.getByLabel('Full name').fill('Sam Taylor');
  await page.getByLabel('Email address').fill('sam@example.com');
  await page
    .getByLabel('Password', { exact: true })
    .fill('A long demo passphrase');
  await page
    .getByLabel('Confirm password', { exact: true })
    .fill('A long demo passphrase');
  await page.getByLabel('I understand this is a demo.').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await capture(page, 'onboarding', testInfo);
  await expect(page.getByLabel('Full name')).toHaveValue('Sam Taylor');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Workspace name').fill('My demo finances');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Primary currency').selectOption('EUR');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('My demo finances')).toBeVisible();
  await page.getByRole('button', { name: 'Start using EasyFinance' }).click();
  await expect(page.getByRole('heading', { name: /^Welcome,/ })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'API:' })).toHaveText(
    'API: ok',
  );
  await page
    .getByRole('link', { name: 'Dashboard', exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Financial Overview', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    })),
  ).toEqual({ local: [], session: [] });
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});
test('demo login, visibility, sign out and keyboard support dialog', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('alex@example.com');
  await page.getByLabel('Password', { exact: true }).fill('EasyFinanceDemo!');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'type',
    'text',
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Welcome,/ })).toBeVisible();
  await page.getByRole('button', { name: 'Open profile' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  const help = page.getByRole('button', { name: 'Demo sign-in details' });
  await help.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(help).toBeFocused();
});
