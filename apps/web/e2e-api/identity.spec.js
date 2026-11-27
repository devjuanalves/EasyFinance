import { test, expect } from '../e2e-support/api-test.js';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createRuntimeClient } from '../../api/src/db/runtime.js';
import { authentication } from '../../api/src/services/auth.js';
import { identityService } from '../../api/src/services/identity.js';
import { tokenHash } from '../../api/src/security/http.js';
test.use({ trace: 'off' });
test('identity proof links, reset, replay, verification and unavailable delivery', async ({
  page,
}, info) => {
  const db = createRuntimeClient();
  const email = `browser-identity-${randomUUID()}@example.test`,
    password = 'Fictional-browser-identity-password!';
  const messages = [],
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const auth = authentication(db);
    await auth.register({
      email,
      password,
      fullName: 'Fictional Identity Browser',
    });
    const login = await auth.login({ email, password });
    const actor = { userId: login.user.id, hash: tokenHash(login.token) };
    const service = identityService(
      db,
      { nodeEnv: 'test', webOrigin: 'http://localhost:5173' },
      {
        kind: 'test',
        send: async (m) => {
          messages.push(m);
        },
      },
    );
    const proofUrl = () => messages.at(-1).text.split('\n')[1];
    await service.requestVerification(actor);
    await page.goto(proofUrl());
    await expect(page).toHaveURL('http://localhost:5173/verify-email');
    await page
      .getByRole('button', { name: 'Confirm email', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('Email verified.');
    await service.requestReset(email);
    const resetUrl = proofUrl();
    await page.goto(resetUrl);
    await expect(page).toHaveURL('http://localhost:5173/reset-password');
    await page
      .getByLabel('New password', { exact: true })
      .fill(password + 'new');
    await page
      .getByLabel('Confirm new password', { exact: true })
      .fill(password + 'new');
    await mkdir('test-results/block10d-layouts', { recursive: true });
    await page.screenshot({
      path: `test-results/block10d-layouts/${info.project.name}-reset.png`,
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'Change password', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('Password changed.');
    await page.goto(resetUrl);
    await page.getByLabel('New password', { exact: true }).fill(password);
    await page
      .getByLabel('Confirm new password', { exact: true })
      .fill(password);
    await page
      .getByRole('button', { name: 'Change password', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText('invalid or expired');
    await page.screenshot({
      path: `test-results/block10d-layouts/${info.project.name}-invalid.png`,
      fullPage: true,
    });
    await page.goto('/forgot-password');
    await page.getByLabel('Email address', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('alert')).toContainText(
      'Email delivery is unavailable',
    );
    await page.goto('/login');
    await page.getByLabel('Email address', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password + 'new');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/onboarding/);
    for (let i = 0; i < 3; i++)
      await page.getByRole('button', { name: /Continue/ }).click();
    await page
      .getByRole('button', { name: /Start|Finish|Go to|Complete/ })
      .click();
    await expect(page).toHaveURL('http://localhost:5173/');
    await page.goto('/account-security');
    await expect(page.getByText('Verified', { exact: true })).toBeVisible();
    await page
      .getByLabel('New email address', { exact: true })
      .fill(`change-${randomUUID()}@example.test`);
    await page
      .getByLabel('Current password', { exact: true })
      .fill(password + 'new');
    await page.getByRole('button', { name: 'Request email change' }).click();
    await expect(page.getByRole('alert')).toContainText(
      'Email delivery is unavailable',
    );
    await page.screenshot({
      path: `test-results/block10d-layouts/${info.project.name}-account-security.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(() => localStorage.length + sessionStorage.length),
    ).toBe(0);
  } finally {
    await db.$disconnect();
  }
});
