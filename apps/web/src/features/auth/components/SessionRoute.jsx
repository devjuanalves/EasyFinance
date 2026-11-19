import { authService } from '../services/authService.js';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
export default function SessionRoute({ children, access = 'complete' }) {
  const user = useAuth();
  if (user?.loading)
    return (
      <main className="foundation-page" role="status">
        Checking session…
      </main>
    );
  if (user?.sessionError)
    return (
      <main className="foundation-page">
        <p role="alert">{user.sessionError}</p>
        <button onClick={() => authService.refresh()}>Retry session</button>
      </main>
    );
  if (access === 'guest')
    return user ? (
      <Navigate to={user.onboardingComplete ? '/' : '/onboarding'} replace />
    ) : (
      children
    );
  if (!user) return <Navigate to="/login" replace />;
  if (access === 'complete' && !user.onboardingComplete)
    return <Navigate to="/onboarding" replace />;
  if (access === 'onboarding' && user.onboardingComplete)
    return <Navigate to="/" replace />;
  return children;
}
