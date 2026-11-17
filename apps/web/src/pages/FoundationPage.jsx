import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../services/api.js';
import { authService } from '../features/auth/services/authService.js';
import { useAuth } from '../features/auth/hooks/useAuth.js';
export default function FoundationPage() {
  const user = useAuth();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    retry: false,
  });
  return (
    <main className="foundation-page">
      <h1>EasyFinance development foundation</h1>
      <p>Welcome, {user.fullName}. You are using a simulated session.</p>
      <p>
        This is the existing Home placeholder. Financial screens are not
        implemented.
      </p>
      {user.preferences && (
        <section aria-label="Demo workspace preferences">
          <h2>{user.preferences.workspaceName}</h2>
          <p>
            {user.preferences.currency} · {user.preferences.dateFormat} ·{' '}
            {user.preferences.timeZone}
          </p>
        </section>
      )}
      <p role="status">
        API:{' '}
        {health.isPending
          ? 'checking…'
          : health.isError
            ? 'unavailable — start the API server'
            : health.data.status}
      </p>
      <button
        type="button"
        className="secondary-button"
        onClick={() => authService.signOut()}
      >
        Sign out
      </button>
    </main>
  );
}
