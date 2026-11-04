import { useQuery } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import { getHealth } from './services/api.js';
function Foundation() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    retry: false,
  });
  return (
    <main className="p-6 text-foreground">
      <h1>EasyFinance development foundation</h1>
      <p>
        Block 0 infrastructure placeholder. This is not an approved application
        screen.
      </p>
      <p role="status">
        API:{' '}
        {health.isPending
          ? 'checking…'
          : health.isError
            ? 'unavailable — start the API server'
            : health.data.status}
      </p>
    </main>
  );
}
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Foundation />} />
      <Route
        path="*"
        element={
          <main className="p-6">
            No application screens are implemented yet.
          </main>
        }
      />
    </Routes>
  );
}
