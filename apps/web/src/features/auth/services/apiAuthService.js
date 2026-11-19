import {
  api,
  setUnauthorizedHandler,
} from '../../../services/persistentApi.js';
export function createApiAuthService() {
  let user = { loading: true };
  const listeners = new Set();
  const emit = (value) => {
    user = value;
    listeners.forEach((fn) => fn());
  };
  setUnauthorizedHandler(() => emit(null));
  const service = {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getCurrentUser: () => user,
    async refresh() {
      emit({ loading: true });
      try {
        emit(await api('/auth/session'));
      } catch (e) {
        emit(e.status === 401 ? null : { sessionError: e.message });
      }
    },
    async signIn({ email, password, rememberMe }) {
      emit(
        await api('/auth/login', {
          method: 'POST',
          body: { email, password, rememberMe },
        }),
      );
      return user;
    },
    signUp: ({ fullName, email, password }) =>
      api('/auth/register', {
        method: 'POST',
        body: { fullName, email, password },
      }),
    requestPasswordReset: (email) =>
      api('/auth/recovery', { method: 'POST', body: { email } }),
    async completeOnboarding({
      workspaceName,
      currency,
      timeZone,
      workspaceType,
      fullName,
      language,
      dateFormat,
    }) {
      await api('/onboarding', {
        method: 'POST',
        body: {
          workspaceName,
          currency,
          timeZone,
          workspaceType,
          fullName,
          language,
          dateFormat,
        },
      });
      await service.refresh();
      return user;
    },
    async signOut() {
      await api('/auth/logout', { method: 'POST', body: {} });
      emit(null);
    },
  };
  void service.refresh();
  return service;
}
