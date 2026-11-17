import { focusFirstError } from '../validation/focusFirstError.js';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import {
  InputField,
  PasswordField,
  PrimaryButton,
  FormError,
} from '../components/FormControls.jsx';
import { validateSignUp } from '../validation/authValidation.js';
import { authService, MOCK_AUTH_ENABLED } from '../services/authService.js';
export default function SignUpPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    consent: false,
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const update = (event) =>
    setValues({
      ...values,
      [event.target.name]:
        event.target.type === 'checkbox'
          ? event.target.checked
          : event.target.value,
    });
  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    const next = validateSignUp(values);
    setErrors(next);
    setError('');
    if (Object.keys(next).length) {
      focusFirstError(event.currentTarget);
      return;
    }
    setLoading(true);
    try {
      await authService.signUp(values);
      navigate('/onboarding', { replace: true });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthLayout
      variant="signup"
      title="Create your account"
      subtitle="Start your journey to smarter financial management."
      footer={
        <p>
          Already have an account? <Link to="/login">Sign in →</Link>
        </p>
      }
    >
      {(openInfo) => (
        <form noValidate onSubmit={submit} aria-label="Create account">
          <fieldset disabled={loading || !MOCK_AUTH_ENABLED}>
            <InputField
              label="Full name"
              name="fullName"
              autoComplete="name"
              icon="user"
              placeholder="Enter your full name"
              value={values.fullName}
              onChange={update}
              error={errors.fullName}
              maxLength={100}
              required
            />
            <InputField
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              icon="mail"
              placeholder="name@example.com"
              value={values.email}
              onChange={update}
              error={errors.email}
              required
            />
            <PasswordField
              name="password"
              autoComplete="new-password"
              placeholder="Create a password"
              value={values.password}
              onChange={update}
              error={errors.password}
              hint="Use at least 12 characters. A memorable passphrase works well."
              required
            />
            <PasswordField
              label="Confirm password"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Confirm your password"
              value={values.confirmPassword}
              onChange={update}
              error={errors.confirmPassword}
              required
            />
            <div className="consent">
              <label className="checkbox-label">
                <input
                  name="consent"
                  type="checkbox"
                  checked={values.consent}
                  onChange={update}
                  required
                  aria-invalid={Boolean(errors.consent)}
                  aria-describedby={
                    errors.consent ? 'consent-error' : undefined
                  }
                />
                <span>I understand this is a demo.</span>
              </label>
              <p>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => openInfo('Terms of Service')}
                >
                  Terms of Service
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => openInfo('Privacy Policy')}
                >
                  Privacy Policy
                </button>
              </p>
              {errors.consent && (
                <p id="consent-error" className="field-error">
                  {errors.consent}
                </p>
              )}
            </div>
            <FormError>{error}</FormError>
            <PrimaryButton type="submit" loading={loading}>
              Create account
            </PrimaryButton>
          </fieldset>
        </form>
      )}
    </AuthLayout>
  );
}
