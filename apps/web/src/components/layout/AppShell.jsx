import PasswordChange from '../../features/persistent/PasswordChange.jsx';
import { API_MODE } from '../../services/persistentApi.js';
import NotificationCenter from '../../features/settings/NotificationCenter.jsx';
import { useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import logo from '../../assets/brand/color.svg';
import { useWorkspace } from '../../features/finance/WorkspaceContext.js';
import { authService } from '../../features/auth/services/authService.js';
import { getHealth } from '../../services/api.js';
import ConversationHistory from '../../features/assistant/ConversationHistory.jsx';
import AppDialog from '../ui/AppDialog.jsx';
import AppIcon from '../ui/AppIcon.jsx';
import './workspace.css';
const nav = [
  ['Home', '/', 'home'],
  ['Dashboard', '/dashboard', 'dashboard'],
  ['Income', '/income', 'income'],
  ['Expenses', '/expenses', 'expenses'],
  ['Investments', '/investments', 'investments'],
];
function Navigation({ onNavigate = () => {} }) {
  const { unavailable } = useWorkspace();
  return (
    <nav aria-label="Primary navigation">
      {nav.map(([name, path, icon]) =>
        path ? (
          <NavLink
            key={name}
            to={path}
            end={!['/income', '/expenses', '/investments'].includes(path)}
            onClick={onNavigate}
          >
            <AppIcon name={icon} />
            <span>{name}</span>
          </NavLink>
        ) : (
          <button key={name} onClick={() => unavailable(name)}>
            <AppIcon name={icon} />
            <span>{name}</span>
            <span className="sr-only"> · unavailable</span>
          </button>
        ),
      )}
    </nav>
  );
}
function SidebarContent({ close, openProfile }) {
  const { user, settings, filters, setFilter, unavailable } = useWorkspace();
  return (
    <>
      <img className="workspace-logo" src={logo} alt="EasyFinance" />
      <label className="workspace-selector">
        <span className="sr-only">Workspace</span>
        {API_MODE && <small>Demo workspace (other modules)</small>}
        <select
          aria-label="Workspace"
          value={filters.workspaceId}
          onChange={(e) => setFilter('workspaceId', e.target.value)}
        >
          {settings.workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
          {!settings.workspaces.length && (
            <option value="no-access">No workspace access</option>
          )}
        </select>
      </label>
      <Navigation onNavigate={close} />
      <ConversationHistory onOpen={close} />
      <div className="sidebar-bottom">
        <NavLink className="settings-nav-link" to="/settings" onClick={close}>
          <AppIcon name="settings" />
          Settings
        </NavLink>
        <button onClick={() => unavailable('Help & Support')}>
          ⓘ Help & Support
        </button>
        <button className="user-summary" onClick={openProfile}>
          <span className="avatar">
            {user.fullName.slice(0, 2).toUpperCase()}
          </span>
          <span>
            <strong>{user.fullName}</strong>
            <small>{user.email}</small>
          </span>
        </button>
      </div>
    </>
  );
}
export default function AppShell() {
  const {
    user,
    settings,
    hasAccess,
    demoIdentities,
    switchDemoIdentity,
    workspaceName,
    notice,
    setNotice,
    unavailable,
    newChat,
    busy,
    confirmDiscard,
  } = useWorkspace();
  const [drawer, setDrawer] = useState(false);
  const [profile, setProfile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    retry: false,
  });
  return (
    <div className="workspace-app">
      <aside className="workspace-sidebar">
        <SidebarContent close={() => {}} openProfile={() => setProfile(true)} />
      </aside>
      <div className="workspace-main">
        <header className="workspace-header">
          <div className="desktop-breadcrumb">
            {workspaceName} <span>›</span>{' '}
            <strong>
              {location.pathname.startsWith('/settings')
                ? 'Settings'
                : location.pathname.startsWith('/investments')
                  ? 'Investments'
                  : location.pathname.startsWith('/expenses')
                    ? 'Expenses'
                    : location.pathname.startsWith('/income')
                      ? 'Income & Invoices'
                      : location.pathname === '/dashboard'
                        ? 'Dashboard'
                        : 'AI Assistant'}
            </strong>
          </div>
          <button
            className="icon-button mobile-only"
            aria-label="Open navigation and history"
            onClick={() => setDrawer(true)}
          >
            <AppIcon name="menu" />
          </button>
          <div className="header-actions">
            <button
              className="compact-button desktop-only"
              onClick={() => unavailable('Export report')}
            >
              ↥ Export
            </button>
            <button
              className="compact-button brand-button desktop-only"
              onClick={() =>
                navigate(
                  '/expenses/transactions?add=' +
                    (API_MODE ? crypto.randomUUID() : '1'),
                )
              }
            >
              ＋ Add Record
            </button>
            <button
              className="icon-button mobile-only"
              aria-label="New chat"
              disabled={busy}
              onClick={() => {
                newChat();
                navigate('/');
              }}
            >
              <AppIcon name="plus" />
            </button>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() => setNotifications(true)}
            >
              <AppIcon name="bell" />
              {settings.notifications.some((n) => !n.read) && (
                <span className="notification-count">
                  {settings.notifications.filter((n) => !n.read).length}
                </span>
              )}
            </button>
            <button
              className="icon-button profile-button"
              aria-label="Open profile"
              onClick={() => setProfile(true)}
            >
              <AppIcon name="user" />
            </button>
          </div>
        </header>
        <div className="demo-ledger-strip">
          <span className="status-dot" />
          <strong>Financial Intelligence</strong>
          <span className="app-badge">
            {API_MODE ? 'MIXED DEVELOPMENT MODE' : 'SAMPLE DATA'}
          </span>
          {API_MODE && (
            <span>
              Income / Invoices, Expenses / Transactions and CSV imports
              persist. Other financial screens and shell workspace controls are
              separate demos.
            </span>
          )}
          <span>No live bank connection or AI service</span>
        </div>
        {hasAccess || API_MODE ? (
          <Outlet key={user.id} />
        ) : (
          <main className="workspace-content">
            <section className="finance-card">
              <h1>No Workspace Access</h1>
              <p>
                This demo identity has no active membership. Financial details
                are unavailable.
              </p>
              <button
                className="secondary-button"
                onClick={() => setProfile(true)}
              >
                Choose Demo Identity
              </button>
            </section>
          </main>
        )}
        <footer className="workspace-health">
          <span role="status">
            API:{' '}
            {health.isPending
              ? 'checking…'
              : health.isError
                ? 'unavailable — start the API server'
                : health.data.status}
          </span>
          <span>
            {API_MODE
              ? 'Local development · Persistent Income & Expenses; other modules are demos'
              : 'Session-only demo · Financial data is fictional'}
          </span>
        </footer>
      </div>
      <div className="mobile-navigation">
        <Navigation />
      </div>
      <AppDialog
        open={drawer}
        title="Navigation & history"
        onClose={() => setDrawer(false)}
      >
        <SidebarContent
          close={() => setDrawer(false)}
          openProfile={() => {
            setDrawer(false);
            setProfile(true);
          }}
        />
      </AppDialog>
      <AppDialog
        open={profile}
        title="Your demo profile"
        onClose={() => setProfile(false)}
      >
        <p>
          <strong>{user.fullName}</strong>
          <br />
          {user.email}
        </p>
        {user.preferences && (
          <p>
            {user.preferences.workspaceName} · {user.preferences.currency} ·{' '}
            {user.preferences.timeZone}
          </p>
        )}
        <p>
          Refreshing or signing out clears this simulated session and its
          conversations.
        </p>
        <NavLink
          className="secondary-button"
          to="/settings"
          onClick={() => setProfile(false)}
        >
          Profile & Settings
        </NavLink>
        <label className="income-field">
          Demo identity (explicit simulation)
          <select
            aria-label="Demo identity"
            value={user.id}
            onChange={(e) => {
              switchDemoIdentity(e.target.value);
              setProfile(false);
            }}
          >
            {demoIdentities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </label>
        <p>
          Switching fictional identities tests permissions within this session.
          It is not another login or production authorization.
        </p>
        <button
          className="primary-button"
          onClick={() => {
            if (confirmDiscard()) {
              Promise.resolve(authService.signOut()).catch((e) =>
                setNotice({ title: 'Sign out failed', body: e.message }),
              );
            }
          }}
        >
          Sign out
        </button>
        {API_MODE && <PasswordChange />}
      </AppDialog>
      <NotificationCenter
        key={user.id}
        open={notifications}
        onClose={() => setNotifications(false)}
      />
      <AppDialog
        open={Boolean(notice)}
        title={notice?.title || 'Information'}
        onClose={() => setNotice(null)}
      >
        <p>{notice?.body}</p>
        {notice?.href && (
          <Link
            className="text-button"
            to={notice.href}
            onClick={() => setNotice(null)}
          >
            {notice.linkLabel}
          </Link>
        )}
        <button className="secondary-button" onClick={() => setNotice(null)}>
          Got it
        </button>
      </AppDialog>
    </div>
  );
}
