import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
export default function SessionRoute({ children, access = 'complete' }) {
  const user = useAuth();
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
