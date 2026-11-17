import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';

import SessionRoute from './features/auth/components/SessionRoute.jsx';

const ProfileSettings = lazy(
  () => import('./features/settings/ProfileSettings.jsx'),
);
const SharingSettings = lazy(
  () => import('./features/settings/SharingSettings.jsx'),
);
const AutomationSettings = lazy(
  () => import('./features/settings/AutomationSettings.jsx'),
);
const InvestmentDashboard = lazy(
  () => import('./features/investments/InvestmentDashboard.jsx'),
);
const InvestmentEditor = lazy(
  () => import('./features/investments/InvestmentEditor.jsx'),
);
const InvestmentDetails = lazy(
  () => import('./features/investments/InvestmentDetails.jsx'),
);
const ExpenseOverview = lazy(
  () => import('./features/expenses/ExpenseOverview.jsx'),
);
const StatementImport = lazy(
  () => import('./features/expenses/StatementImport.jsx'),
);
const TransactionsPage = lazy(
  () => import('./features/expenses/TransactionsPage.jsx'),
);
const CategoriesPage = lazy(
  () => import('./features/expenses/CategoriesPage.jsx'),
);
const IncomeOverview = lazy(
  () => import('./features/income/IncomeOverview.jsx'),
);
const InvoiceList = lazy(() => import('./features/income/InvoiceList.jsx'));
const InvoiceEditor = lazy(() => import('./features/income/InvoiceEditor.jsx'));
const InvoiceDetails = lazy(
  () => import('./features/income/InvoiceDetails.jsx'),
);
const ClientsPage = lazy(() => import('./features/income/ClientsPage.jsx'));
import LoginPage from './features/auth/pages/LoginPage.jsx';
import SignUpPage from './features/auth/pages/SignUpPage.jsx';
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage.jsx';
import OnboardingPage from './features/auth/pages/OnboardingPage.jsx';
const FoundationPage = lazy(() => import('./pages/FoundationPage.jsx'));
const WorkspaceProvider = lazy(
  () => import('./features/finance/WorkspaceProvider.jsx'),
);
const AppShell = lazy(() => import('./components/layout/AppShell.jsx'));
const HomePage = lazy(() => import('./features/assistant/HomePage.jsx'));
const DashboardPage = lazy(
  () => import('./features/finance/DashboardPage.jsx'),
);
const titles = {
  '/login': 'Sign in',
  '/signup': 'Create account',
  '/forgot-password': 'Password recovery',
  '/onboarding': 'Workspace setup',
  '/': 'AI Assistant',
  '/dashboard': 'Financial Overview',
  '/development': 'Development home',
};
export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${titles[pathname] || (pathname.startsWith('/settings') ? 'Settings' : pathname.startsWith('/investments') ? 'Investments' : pathname.startsWith('/income') ? 'Income & Invoices' : pathname.startsWith('/expenses') ? 'Expenses' : 'Page not found')} · EasyFinance`;
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <Suspense
      fallback={
        <main className="foundation-page" role="status">
          Loading EasyFinance…
        </main>
      }
    >
      <Routes>
        <Route
          path="/login"
          element={
            <SessionRoute access="guest">
              <LoginPage />
            </SessionRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <SessionRoute access="guest">
              <SignUpPage />
            </SessionRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <SessionRoute access="guest">
              <ForgotPasswordPage />
            </SessionRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <SessionRoute access="onboarding">
              <OnboardingPage />
            </SessionRoute>
          }
        />
        <Route
          element={
            <SessionRoute>
              <WorkspaceProvider>
                <AppShell />
              </WorkspaceProvider>
            </SessionRoute>
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<ProfileSettings />} />
          <Route path="/settings/sharing" element={<SharingSettings />} />
          <Route
            path="/settings/automations"
            element={<AutomationSettings />}
          />
          <Route path="/expenses" element={<ExpenseOverview />} />
          <Route path="/expenses/import" element={<StatementImport />} />
          <Route path="/expenses/transactions" element={<TransactionsPage />} />
          <Route path="/expenses/categories" element={<CategoriesPage />} />
          <Route path="/investments" element={<InvestmentDashboard />} />
          <Route path="/investments/new" element={<InvestmentEditor />} />
          <Route path="/investments/:id" element={<InvestmentDetails />} />
          <Route path="/investments/:id/edit" element={<InvestmentEditor />} />
          <Route path="/income" element={<IncomeOverview />} />
          <Route path="/income/invoices" element={<InvoiceList />} />
          <Route path="/income/invoices/new" element={<InvoiceEditor />} />
          <Route path="/income/invoices/:id" element={<InvoiceDetails />} />
          <Route path="/income/invoices/:id/edit" element={<InvoiceEditor />} />
          <Route path="/income/clients" element={<ClientsPage />} />
        </Route>
        <Route
          path="/development"
          element={
            <SessionRoute>
              <FoundationPage />
            </SessionRoute>
          }
        />
        <Route
          path="*"
          element={
            <main className="foundation-page">
              <h1>Page not found</h1>
              <Link to="/">Return to EasyFinance</Link>
            </main>
          }
        />
      </Routes>
    </Suspense>
  );
}
