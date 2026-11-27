import { API_MODE } from '../../../services/persistentApi.js';
import { focusFirstError } from '../validation/focusFirstError.js';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import {
  InputField,
  PrimaryButton,
  FormError,
} from '../components/FormControls.jsx';
import Icon from '../components/Icon.jsx';
import { emailError } from '../validation/authValidation.js';
import { authService, AUTH_ENABLED } from '../services/authService.js';
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [validation, setValidation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    const issue = emailError(email);
    setValidation(issue);
    setError('');
    if (issue) {
      focusFirstError(event.currentTarget);
      return;
    }
    setLoading(true);
    try {
      await authService.requestPasswordReset(email);
      setSent(true);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthLayout
      variant="recovery"
      title={
        sent
          ? API_MODE
            ? 'Request received'
            : 'Check your email'
          : 'Forgot your password?'
      }
      subtitle={
        sent
          ? API_MODE
            ? 'If eligible, instructions will be sent. This response does not confirm delivery.'
            : 'Your recovery request has been simulated.'
          : 'No worries. Enter your email address to start the recovery process.'
      }
      footer={
        <Link className="back-link" to="/login">
          <Icon name="back" />
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="confirmation" role="status">
          <Icon name="mail" />
          <p>
            If an account exists for this email address, you’ll receive password
            reset instructions.
          </p>
          <p>
            <strong>
              {API_MODE
                ? 'Delivery is not confirmed by this response.'
                : 'Demo only: no email was sent.'}
            </strong>
          </p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setSent(false);
              setEmail('');
            }}
          >
            Try another email
          </button>
        </div>
      ) : (
        <form noValidate onSubmit={submit} aria-label="Password recovery">
          <fieldset disabled={loading || !AUTH_ENABLED}>
            <InputField
              label="Email address"
              name="email"
              type="email"
              icon="mail"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={validation}
              required
            />
            <FormError>{error}</FormError>
            <PrimaryButton type="submit" loading={loading}>
              Send reset link
            </PrimaryButton>
          </fieldset>
        </form>
      )}
      <p className="recovery-demo">
        {API_MODE
          ? 'Email delivery requires configured infrastructure. If unavailable, no message is sent.'
          : 'This is a simulated recovery flow. No email delivery or password-reset tokens are available.'}
      </p>
    </AuthLayout>
  );
}
