import { API_MODE } from '../../../services/persistentApi.js';
import { createApiAuthService } from './apiAuthService.js';
import {
  validateLogin,
  validateSignUp,
  validateOnboarding,
  emailError,
} from '../validation/authValidation.js';
// Public demo fixtures, never production credentials. Submitted passwords are not retained.
export const DEMO_CREDENTIALS = Object.freeze({
  email: 'alex@example.com',
  password: 'EasyFinanceDemo!',
});
export const MOCK_AUTH_ENABLED =
  !API_MODE &&
  (import.meta.env.DEV || import.meta.env.VITE_AUTH_MODE === 'mock');
export const AUTH_ENABLED = API_MODE || MOCK_AUTH_ENABLED;
export function createMockAuthService({
  enabled = MOCK_AUTH_ENABLED,
  latency = 400,
} = {}) {
  let session = null;
  const listeners = new Set();
  const emit = (next) => {
    session = next;
    listeners.forEach((listener) => listener());
  };
  async function simulate() {
    if (!enabled)
      throw new Error('Demo authentication is disabled in this build.');
    await new Promise((resolve) => setTimeout(resolve, latency));
  }
  const normalize = (email) => email.trim().toLowerCase();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getCurrentUser() {
      return session;
    },
    async signIn(values) {
      await simulate();
      if (
        Object.keys(validateLogin(values)).length ||
        normalize(values.email) !== DEMO_CREDENTIALS.email ||
        values.password !== DEMO_CREDENTIALS.password
      )
        throw new Error(
          'Email or password is incorrect. Try the documented demo credentials.',
        );
      emit({
        id: 'demo-user',
        fullName: 'Alex Morgan',
        email: DEMO_CREDENTIALS.email,
        onboardingComplete: true,
        preferences: null,
        rememberMe: Boolean(values.rememberMe),
      });
      return session;
    },
    async signUp(values) {
      await simulate();
      if (Object.keys(validateSignUp(values)).length)
        throw new Error('Check the registration fields and try again.');
      if (
        [DEMO_CREDENTIALS.email, 'error@example.com'].includes(
          normalize(values.email),
        )
      )
        throw new Error(
          'Demo registration could not be completed. Try another address or sign in.',
        );
      emit({
        id: 'demo-registration',
        fullName: values.fullName.trim(),
        email: normalize(values.email),
        onboardingComplete: false,
        preferences: null,
      });
      return session;
    },
    async requestPasswordReset(email) {
      await simulate();
      if (emailError(email)) throw new Error('Enter a valid email address.');
      if (normalize(email) === 'error@example.com')
        throw new Error(
          'The simulated recovery service is unavailable. Please try again.',
        );
      return { simulated: true };
    },
    async completeOnboarding(values) {
      await simulate();
      if (!session)
        throw new Error(
          'Start a demo registration before setting up a workspace.',
        );
      if (
        [0, 1, 2].some(
          (step) => Object.keys(validateOnboarding(values, step)).length,
        )
      )
        throw new Error('Review your workspace settings before continuing.');
      const {
        language,
        workspaceName,
        workspaceType,
        currency,
        dateFormat,
        timeZone,
      } = values;
      emit({
        ...session,
        fullName: values.fullName.trim(),
        onboardingComplete: true,
        preferences: {
          language,
          workspaceName: workspaceName.trim(),
          workspaceType,
          currency,
          dateFormat,
          timeZone,
        },
      });
      return session;
    },
    signOut() {
      emit(null);
    },
  };
}
export const authService = API_MODE
  ? createApiAuthService()
  : createMockAuthService();
