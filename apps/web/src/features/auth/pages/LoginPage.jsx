import { API_MODE } from '../../../services/persistentApi.js';
import googleIcon from '../../../assets/brand/google.svg';
import appleIcon from '../../../assets/brand/apple.svg';
import { focusFirstError } from '../validation/focusFirstError.js';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import {
  InputField,
  PasswordField,
  PrimaryButton,
  FormError,
} from '../components/FormControls.jsx';
import { validateLogin } from '../validation/authValidation.js';
import { authService, AUTH_ENABLED } from '../services/authService.js';
export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [values, setValues] = useState({
    email: '',
    password: '',
    rememberMe: false,
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
    const next = validateLogin(values);
    setErrors(next);
    setError('');
    if (Object.keys(next).length) {
      focusFirstError(event.currentTarget);
      return;
    }
    setLoading(true);
    try {
      await authService.signIn(values);
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your EasyFinance account"
      footer={
        <p>
          Don’t have an account? <Link to="/signup">Create an account</Link>
        </p>
      }
    >
      {API_MODE && params.has('registered') && (
        <p role="status">
          Registration request processed. Sign in to continue. Existing accounts
          are unchanged.
        </p>
      )}
      <form noValidate onSubmit={submit} aria-label="Sign in">
        <fieldset disabled={loading || !AUTH_ENABLED}>
          <InputField
            label="Email address"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="name@example.com"
            value={values.email}
            onChange={update}
            error={errors.email}
            required
          />
          <PasswordField
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={values.password}
            onChange={update}
            error={errors.password}
            required
          />
          <div className="form-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="rememberMe"
                checked={values.rememberMe}
                onChange={update}
                aria-describedby="remember-note"
              />
              Remember me
            </label>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
          <span id="remember-note" className="sr-only">
            {API_MODE
              ? 'Keep this session for up to seven days; otherwise it expires after twelve hours.'
              : 'Demo preference only. Refreshing ends this session.'}
          </span>
          <FormError>{error}</FormError>
          <PrimaryButton type="submit" loading={loading}>
            Sign in
          </PrimaryButton>
        </fieldset>
      </form>
      <div className="social-separator">OR CONTINUE WITH</div>
      <div className="social-buttons">
        <button disabled aria-describedby="social-note">
          <img src={googleIcon} width="17" height="17" alt="" /> Google
        </button>
        <button disabled aria-describedby="social-note">
          <img src={appleIcon} width="17" height="17" alt="" /> Apple
        </button>
      </div>
      <p id="social-note" className="field-hint social-note">
        Social sign-in is unavailable in this demo.
      </p>
    </AuthLayout>
  );
}
