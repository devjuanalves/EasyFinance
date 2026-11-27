import { API_MODE } from '../../../services/persistentApi.js';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../../../assets/brand/color.svg';
import whiteLogo from '../../../assets/brand/white.svg';
import Icon from './Icon.jsx';
import InfoDialog from './InfoDialog.jsx';
import { AUTH_ENABLED } from '../services/authService.js';
function BrandPanel({ variant, openInfo }) {
  const recovery = variant === 'recovery';
  const signup = variant === 'signup' || variant === 'onboarding';
  return (
    <aside className="brand-panel" aria-label="About EasyFinance">
      <div className="brand-top">
        <img
          className="brand-logo"
          src={signup ? logo : whiteLogo}
          alt="EasyFinance"
        />
        <span className="brand-pill">
          ● {signup ? 'Banking Intelligence Platform' : 'Development demo'}
        </span>
      </div>
      <div className="brand-story">
        <p className="eyebrow">
          {recovery
            ? 'SECURE ACCOUNT RECOVERY'
            : signup
              ? 'HIGH-YIELD WEALTH ARCHITECTURE'
              : 'INTELLIGENT WEALTH INFRASTRUCTURE'}
        </p>
        <h2>
          {recovery ? (
            'Your financial journey continues.'
          ) : signup ? (
            <>
              Take control of your <em>financial future.</em>
            </>
          ) : (
            <>
              Your finances.
              <br />
              Finally, under control.
            </>
          )}
        </h2>
        <p className="brand-description">
          {recovery
            ? API_MODE
              ? 'Manage your account identity with expiring, single-use proof links. Email delivery is currently unavailable.'
              : 'Regain access to your account and get back to managing your finances. Explore the recovery flow in this local demo.'
            : signup
              ? 'One intelligent platform to manage your money, understand your finances, and build a better financial future.'
              : 'Manage your money, track investments, and grow your finances with the power of AI.'}
        </p>
        {recovery ? (
          <div className="recovery-illustration">
            <Icon name="shield" />
            <div>
              <strong>Account Recovery Protection</strong>
              <p>
                {API_MODE
                  ? 'Single-use identity proof · Email delivery unavailable'
                  : 'Simulated recovery preview'}
              </p>
            </div>
            <ol>
              <li>Identity</li>
              <li>Recovery link</li>
              <li>Access</li>
            </ol>
          </div>
        ) : (
          <div
            className="wealth-preview"
            aria-label="Illustrative sample, not live financial data"
          >
            <div className="wealth-total">
              <span>
                {signup
                  ? 'Smart Net Worth Projection'
                  : 'TOTAL PORTFOLIO BALANCE'}
                <strong>{signup ? '$418,290.00' : '$174,850.00'}</strong>
              </span>
              <small>↗ +14.8% sample</small>
            </div>
            {signup && (
              <div className="sample-chart" aria-hidden="true">
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} />
                ))}
              </div>
            )}
            <div className="wealth-stats">
              <div>
                <span>{signup ? 'AUTOMATED SAVINGS' : 'Liquidity Yield'}</span>
                <strong>{signup ? '$1,250/mo' : '4.85% APY'}</strong>
              </div>
              <div>
                <span>AI Optimization</span>
                <strong className="positive">Active</strong>
              </div>
              <div>
                <span>{signup ? 'TAX RESERVE' : 'Monthly Cashflow'}</span>
                <strong>{signup ? 'Optimized' : '+$6,420'}</strong>
              </div>
            </div>
            <p className="sample-note">
              Illustrative design sample · No live financial data
            </p>
          </div>
        )}
        <p className="brand-assurance">
          <Icon name="shield" /> Local demo · No bank connection
        </p>
      </div>
      <footer className="brand-footer">
        <span>EasyFinance · Development preview</span>
        <div>
          <button type="button" onClick={() => openInfo('Privacy Policy')}>
            Privacy
          </button>
          <button type="button" onClick={() => openInfo('Terms of Service')}>
            Terms
          </button>
        </div>
      </footer>
    </aside>
  );
}
export default function AuthLayout({
  variant = 'login',
  title,
  subtitle,
  children,
  footer,
}) {
  const [topic, setTopic] = useState(null);
  return (
    <div className={`auth-page auth-${variant}`}>
      <div className="auth-shell">
        <BrandPanel variant={variant} openInfo={setTopic} />
        <main className="auth-main">
          <header className="mobile-header">
            <Link to="/login" aria-label="EasyFinance sign in">
              <img src={logo} alt="EasyFinance" />
            </Link>
            {variant === 'signup' ? (
              <Link className="support-button" to="/login">
                Sign in →
              </Link>
            ) : (
              <button
                className="support-button"
                type="button"
                onClick={() => setTopic('Support')}
              >
                Support
              </button>
            )}
          </header>
          <div className="auth-content">
            <div className="mobile-badge">
              <Icon name="sparkle" /> AI-POWERED FINANCIAL INTELLIGENCE
            </div>
            {variant === 'recovery' && (
              <div className="recovery-key">
                <Icon name="key" />
              </div>
            )}
            <header className="auth-heading">
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </header>
            {!AUTH_ENABLED && (
              <p className="form-error" role="alert">
                Demo authentication is disabled in this build.
              </p>
            )}
            {typeof children === 'function' ? children(setTopic) : children}
          </div>
          <footer className="auth-footer">
            {footer}
            <p className="demo-notice">
              <Icon name="shield" />{' '}
              {API_MODE
                ? 'Local API mode · Accounts persist in the development database'
                : 'Development demo · No real accounts'}
            </p>
            <button
              type="button"
              className="text-button demo-help"
              onClick={() => setTopic('Support')}
            >
              {API_MODE ? 'Development support' : 'Demo sign-in details'}
            </button>
          </footer>
        </main>
      </div>
      <InfoDialog topic={topic} onClose={() => setTopic(null)} />
    </div>
  );
}
