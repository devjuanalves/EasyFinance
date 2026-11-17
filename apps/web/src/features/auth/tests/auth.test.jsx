// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../../../App.jsx';
import { authService, DEMO_CREDENTIALS } from '../services/authService.js';
vi.mock('../../../services/api.js', () => ({
  getHealth: async () => ({ status: 'ok' }),
}));
beforeEach(() => {
  authService.signOut();
  // jsdom has no native dialog implementation; real focus trapping is covered by Playwright.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  window.scrollTo = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function setup(path = '/login') {
  const user = userEvent.setup();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return user;
}
async function registration(user, email = 'new@example.com') {
  await user.type(screen.getByLabelText('Full name'), 'Sam Taylor');
  await user.type(screen.getByLabelText('Email address'), email);
  await user.type(
    screen.getByLabelText('Password', { exact: true }),
    'a long demo passphrase',
  );
  await user.type(
    screen.getByLabelText('Confirm password'),
    'a long demo passphrase',
  );
  await user.click(screen.getByLabelText('I understand this is a demo.'));
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}
describe('Login', () => {
  it('validates required fields and focuses the first invalid field', async () => {
    const user = setup();
    await user.click(
      screen.getByRole('button', { name: 'Sign in', exact: true }),
    );
    expect(screen.getByText('Enter your email address.')).toBeVisible();
    expect(screen.getByText('Enter your password.')).toBeVisible();
    await waitFor(() =>
      expect(screen.getByLabelText('Email address')).toHaveFocus(),
    );
  });
  it('rejects invalid email', async () => {
    const user = setup();
    await user.type(screen.getByLabelText('Email address'), 'invalid');
    await user.click(
      screen.getByRole('button', { name: 'Sign in', exact: true }),
    );
    expect(screen.getByText('Enter a valid email address.')).toBeVisible();
  });
  it('toggles password visibility accessibly', async () => {
    const user = setup();
    const input = screen.getByLabelText('Password', { exact: true });
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('button', { name: 'Hide password' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });
  it('rejects incorrect mock credentials', async () => {
    const user = setup();
    await user.type(
      screen.getByLabelText('Email address'),
      'someone@example.com',
    );
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'wrong',
    );
    await user.click(
      screen.getByRole('button', { name: 'Sign in', exact: true }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email or password is incorrect',
    );
    expect(authService.getCurrentUser()).toBeNull();
  });
  it('signs in with the demo fixture, disables repeated submission, and signs out', async () => {
    const user = setup();
    await user.type(
      screen.getByLabelText('Email address'),
      DEMO_CREDENTIALS.email,
    );
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      DEMO_CREDENTIALS.password,
    );
    await user.click(screen.getByLabelText('Remember me'));
    await user.click(
      screen.getByRole('button', { name: 'Sign in', exact: true }),
    );
    expect(screen.getByRole('button', { name: /Please wait/ })).toBeDisabled();
    expect(
      await screen.findByRole('heading', {
        name: /^Welcome,/,
      }),
    ).toBeVisible();
    expect(authService.getCurrentUser().rememberMe).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Open profile' }));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(
      await screen.findByRole('heading', { name: 'Welcome back' }),
    ).toBeVisible();
  });
  it('routes to signup and recovery', async () => {
    const user = setup();
    await user.click(screen.getByRole('link', { name: 'Create an account' }));
    expect(
      screen.getByRole('heading', { name: 'Create your account' }),
    ).toBeVisible();
    await user.click(screen.getAllByRole('link', { name: 'Sign in →' })[0]);
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }));
    expect(
      screen.getByRole('heading', { name: 'Forgot your password?' }),
    ).toBeVisible();
  });
  it('guards protected routes', () => {
    setup('/');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
  it('guards onboarding without a registration', () => {
    setup('/onboarding');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
});
describe('Registration', () => {
  it('requires all fields and explicit demo consent', async () => {
    const user = setup('/signup');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    for (const message of [
      'Enter your full name.',
      'Enter your email address.',
      'Enter your password.',
      'Confirm your password.',
      'Confirm that you understand this is a demo.',
    ])
      expect(screen.getByText(message)).toBeVisible();
  });
  it('validates email, minimum password length and confirmation mismatch', async () => {
    const user = setup('/signup');
    await user.type(screen.getByLabelText('Email address'), 'invalid');
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'short',
    );
    await user.type(screen.getByLabelText('Confirm password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Enter a valid email address.')).toBeVisible();
    expect(screen.getByText('Use at least 12 characters.')).toBeVisible();
    expect(screen.getByText('Passwords do not match.')).toBeVisible();
  });
  it('navigates successful simulated registration to onboarding with the name prefilled', async () => {
    const user = setup('/signup');
    await registration(user);
    expect(
      await screen.findByRole('heading', { name: 'Make EasyFinance yours' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Full name')).toHaveValue('Sam Taylor');
    expect(authService.getCurrentUser()).not.toHaveProperty('password');
  });
  it('shows deterministic registration failure', async () => {
    const user = setup('/signup');
    await registration(user, 'error@example.com');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Demo registration could not be completed',
    );
  });
});
describe('Recovery', () => {
  it('validates required and malformed emails', async () => {
    const user = setup('/forgot-password');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(screen.getByText('Enter your email address.')).toBeVisible();
    await user.type(screen.getByLabelText('Email address'), 'invalid');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(screen.getByText('Enter a valid email address.')).toBeVisible();
  });
  it('shows loading and neutral simulated confirmation, and returns to login', async () => {
    const user = setup('/forgot-password');
    await user.type(
      screen.getByLabelText('Email address'),
      'anyone@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(screen.getByRole('button', { name: /Please wait/ })).toBeDisabled();
    expect(
      await screen.findByRole('heading', { name: 'Check your email' }),
    ).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      'If an account exists',
    );
    expect(screen.getByText('Demo only: no email was sent.')).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Back to sign in' }));
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
  it('supports recovery error and retry', async () => {
    const user = setup('/forgot-password');
    await user.type(
      screen.getByLabelText('Email address'),
      'error@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'simulated recovery service is unavailable',
    );
    await user.clear(screen.getByLabelText('Email address'));
    await user.type(
      screen.getByLabelText('Email address'),
      'retry@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(
      await screen.findByRole('heading', { name: 'Check your email' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try another email' }));
    expect(screen.getByLabelText('Email address')).toHaveValue('');
  });
});
describe('Onboarding', () => {
  it('validates steps, retains edits going back, and completes with configurable preferences', async () => {
    const user = setup('/signup');
    await registration(user);
    await screen.findByRole('heading', { name: 'Make EasyFinance yours' });
    await user.clear(screen.getByLabelText('Full name'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter your full name.')).toBeVisible();
    await user.type(screen.getByLabelText('Full name'), 'Sam Updated');
    await user.selectOptions(
      screen.getByLabelText('Preferred language'),
      'pt-BR',
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.clear(screen.getByLabelText('Workspace name'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter a workspace name.')).toBeVisible();
    await user.type(screen.getByLabelText('Workspace name'), 'Our finances');
    await user.selectOptions(screen.getByLabelText('Workspace type'), 'shared');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Full name')).toHaveValue('Sam Updated');
    expect(screen.getByLabelText('Preferred language')).toHaveValue('pt-BR');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Workspace name')).toHaveValue('Our finances');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.selectOptions(screen.getByLabelText('Primary currency'), 'USD');
    await user.selectOptions(
      screen.getByLabelText('Date format'),
      'MM/DD/YYYY',
    );
    await user.selectOptions(
      screen.getByLabelText('Time zone'),
      'America/New_York',
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Our finances')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Start using EasyFinance' }),
    );
    expect(
      await screen.findByRole('heading', {
        name: /^Welcome,/,
      }),
    ).toBeVisible();
    expect(authService.getCurrentUser()).toMatchObject({
      fullName: 'Sam Updated',
      onboardingComplete: true,
      preferences: {
        workspaceName: 'Our finances',
        currency: 'USD',
        timeZone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        language: 'pt-BR',
        workspaceType: 'shared',
      },
    });
  }, 15000);
});
