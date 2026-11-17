import { describe, it, expect, vi } from 'vitest';
import {
  createMockAuthService,
  DEMO_CREDENTIALS,
} from '../services/authService.js';
import {
  DEFAULT_PREFERENCES,
  validateOnboarding,
} from '../validation/authValidation.js';
const registration = {
  fullName: 'Demo User',
  email: 'new@example.com',
  password: 'a long demo passphrase',
  confirmPassword: 'a long demo passphrase',
  consent: true,
};
describe('isolated mock auth contract', () => {
  it('rejects all operations when disabled', async () => {
    const service = createMockAuthService({ enabled: false, latency: 0 });
    await expect(service.signIn(DEMO_CREDENTIALS)).rejects.toThrow('disabled');
    await expect(service.signUp(registration)).rejects.toThrow('disabled');
    await expect(
      service.requestPasswordReset('new@example.com'),
    ).rejects.toThrow('disabled');
    expect(service.getCurrentUser()).toBeNull();
  });
  it('retains neither passwords nor confirmation and resets when recreated', async () => {
    const service = createMockAuthService({ enabled: true, latency: 0 });
    const spy = vi.fn();
    const unsubscribe = service.subscribe(spy);
    await service.signUp(registration);
    expect(JSON.stringify(service.getCurrentUser())).not.toContain(
      registration.password,
    );
    expect(service.getCurrentUser()).not.toHaveProperty('confirmPassword');
    expect(
      createMockAuthService({ enabled: true }).getCurrentUser(),
    ).toBeNull();
    service.signOut();
    expect(service.getCurrentUser()).toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
  it('does not authenticate arbitrary newly registered credentials', async () => {
    const service = createMockAuthService({ enabled: true, latency: 0 });
    await service.signUp(registration);
    service.signOut();
    await expect(service.signIn(registration)).rejects.toThrow('incorrect');
    expect(service.getCurrentUser()).toBeNull();
  });
  it('rejects incomplete onboarding and accepts complete values only after registration', async () => {
    const service = createMockAuthService({ enabled: true, latency: 0 });
    await expect(
      service.completeOnboarding({
        ...DEFAULT_PREFERENCES,
        fullName: 'Demo User',
      }),
    ).rejects.toThrow('registration');
    await service.signUp(registration);
    await expect(
      service.completeOnboarding({ ...DEFAULT_PREFERENCES, fullName: '' }),
    ).rejects.toThrow('Review');
    expect(service.getCurrentUser().onboardingComplete).toBe(false);
  });
  it('validates currency, date, timezone and workspace options', () => {
    expect(
      validateOnboarding(
        { currency: 'XXX', dateFormat: 'bad', timeZone: 'invalid' },
        2,
      ),
    ).toEqual({
      currency: expect.any(String),
      dateFormat: expect.any(String),
      timeZone: expect.any(String),
    });
    expect(
      validateOnboarding({ workspaceName: 'A', workspaceType: 'invalid' }, 1),
    ).toHaveProperty('workspaceType');
  });
  it('returns identical recovery responses for known and unknown addresses', async () => {
    const service = createMockAuthService({ enabled: true, latency: 0 });
    expect(await service.requestPasswordReset(DEMO_CREDENTIALS.email)).toEqual(
      await service.requestPasswordReset('unknown@example.com'),
    );
  });
});
