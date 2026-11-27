const PersistentSettings = lazy(
  () => import('./features/persistent/PersistentSettings.jsx'),
);
const PersistentInvestments = lazy(
  () => import('./features/persistent/PersistentInvestments.jsx'),
);
const PersistentImport = lazy(
  () => import('./features/persistent/PersistentImport.jsx'),
);
const PersistentIncome = lazy(
  () => import('./features/persistent/PersistentIncome.jsx'),
);
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './features/auth/hooks/useAuth.js';
import { API_MODE } from './services/persistentApi.js';
const PersistentExpenses = lazy(
  () => import('./features/persistent/PersistentExpenses.jsx'),
);
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
import IdentityPage from './features/auth/pages/IdentityPage.jsx';
import LoginPage from './features/auth/pages/LoginPage.jsx';
import SignUpPage from './features/auth/pages/SignUpPage.jsx';
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage.jsx';
import OnboardingPage from './features/auth/pages/OnboardingPage.jsx';
const FoundationPage = lazy(() => import('./pages/FoundationPage.jsx'));
const WorkspaceProvider = lazy(
  () => import('./features/finance/WorkspaceProvider.jsx'),
);
const AppShell = lazy(() => import('./components/layout/AppShell.jsx'));
const PersistentDashboard = lazy(
  () => import('./features/persistent/PersistentDashboard.jsx'),
);
const PersistentCategories = lazy(
  () => import('./features/persistent/PersistentCategories.jsx'),
);
const HomePage = lazy(() => import('./features/assistant/HomePage.jsx'));
const DashboardPage = lazy(
  () => import('./features/finance/DashboardPage.jsx'),
);
const titles = {
  '/login': 'Sign in',
  '/signup': 'Create account',
  '/forgot-password': 'Password recovery',
  '/reset-password': 'Reset password',
  '/verify-email': 'Verify email',
  '/account-security': 'Account security',
  '/onboarding': 'Workspace setup',
  '/': 'AI Assistant',
  '/dashboard': 'Financial Overview',
  '/development': 'Development home',
};
export default function App() {
  const session = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (API_MODE && (!session || session.sessionError)) queryClient.clear();
  }, [session, queryClient]);
  const { pathname, search, hash } = useLocation();
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
          path="/reset-password"
          element={<IdentityPage key={'reset' + hash} mode="reset" />}
        />
        <Route
          path="/verify-email"
          element={<IdentityPage key={'verify' + hash} mode="verify" />}
        />
        <Route
          path="/account-security"
          element={
            <SessionRoute>
              <IdentityPage mode="account" />
            </SessionRoute>
          }
        />
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
          <Route
            path="/"
            element={API_MODE ? <PersistentDashboard home /> : <HomePage />}
          />
          <Route
            path="/dashboard"
            element={API_MODE ? <PersistentDashboard /> : <DashboardPage />}
          />
          <Route
            path="/settings"
            element={API_MODE ? <PersistentSettings /> : <ProfileSettings />}
          />
          <Route
            path="/settings/sharing"
            element={
              API_MODE ? (
                <PersistentSettings screen="sharing" />
              ) : (
                <SharingSettings />
              )
            }
          />
          <Route
            path="/settings/automations"
            element={
              API_MODE ? (
                <PersistentSettings screen="automations" />
              ) : (
                <AutomationSettings />
              )
            }
          />
          <Route
            path="/expenses"
            element={
              API_MODE ? <PersistentExpenses overview /> : <ExpenseOverview />
            }
          />
          <Route
            path="/expenses/import"
            element={API_MODE ? <PersistentImport /> : <StatementImport />}
          />
          <Route
            path="/expenses/transactions"
            element={
              API_MODE ? (
                <PersistentExpenses key={search} />
              ) : (
                <TransactionsPage />
              )
            }
          />
          <Route
            path="/expenses/categories"
            element={API_MODE ? <PersistentCategories /> : <CategoriesPage />}
          />
          <Route
            path="/investments"
            element={
              API_MODE ? (
                <PersistentInvestments screen="overview" />
              ) : (
                <InvestmentDashboard />
              )
            }
          />
          <Route
            path="/investments/new"
            element={
              API_MODE ? (
                <PersistentInvestments screen="new" />
              ) : (
                <InvestmentEditor />
              )
            }
          />
          <Route
            path="/investments/:id"
            element={
              API_MODE ? (
                <PersistentInvestments screen="detail" />
              ) : (
                <InvestmentDetails />
              )
            }
          />
          <Route
            path="/investments/:id/edit"
            element={
              API_MODE ? (
                <PersistentInvestments screen="edit" />
              ) : (
                <InvestmentEditor />
              )
            }
          />
          <Route
            path="/income"
            element={
              API_MODE ? (
                <PersistentIncome screen="overview" />
              ) : (
                <IncomeOverview />
              )
            }
          />
          <Route
            path="/income/invoices"
            element={
              API_MODE ? <PersistentIncome screen="list" /> : <InvoiceList />
            }
          />
          <Route
            path="/income/invoices/new"
            element={
              API_MODE ? <PersistentIncome screen="new" /> : <InvoiceEditor />
            }
          />
          <Route
            path="/income/invoices/:id"
            element={
              API_MODE ? (
                <PersistentIncome screen="detail" />
              ) : (
                <InvoiceDetails />
              )
            }
          />
          <Route
            path="/income/invoices/:id/edit"
            element={
              API_MODE ? <PersistentIncome screen="edit" /> : <InvoiceEditor />
            }
          />
          <Route
            path="/income/clients"
            element={
              API_MODE ? <PersistentIncome screen="clients" /> : <ClientsPage />
            }
          />
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
