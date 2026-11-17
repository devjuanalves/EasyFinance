import { focusFirstError } from '../validation/focusFirstError.js';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import {
  InputField,
  PrimaryButton,
  FormError,
} from '../components/FormControls.jsx';
import {
  DEFAULT_PREFERENCES,
  LANGUAGES,
  CURRENCIES,
  DATE_FORMATS,
  validateOnboarding,
} from '../validation/authValidation.js';
import { authService } from '../services/authService.js';
import { useAuth } from '../hooks/useAuth.js';
const steps = ['Your profile', 'Your workspace', 'Preferences', 'Ready to go'];
const timeZones = [
  ...new Set([
    DEFAULT_PREFERENCES.timeZone,
    'UTC',
    ...Intl.supportedValuesOf('timeZone'),
  ]),
];
export default function OnboardingPage() {
  const user = useAuth();
  const navigate = useNavigate();
  const heading = useRef(null);
  const [values, setValues] = useState({
    ...DEFAULT_PREFERENCES,
    fullName: user?.fullName || '',
  });
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const update = (event) =>
    setValues({ ...values, [event.target.name]: event.target.value });
  function go(next) {
    setErrors({});
    setError('');
    setStep(next);
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    const next = validateOnboarding(values, step);
    setErrors(next);
    setError('');
    if (Object.keys(next).length) {
      focusFirstError(event.currentTarget);
      return;
    }
    if (step < 3) {
      go(step + 1);
      return;
    }
    setLoading(true);
    try {
      await authService.completeOnboarding(values);
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }
  const field = (name) => ({
    name,
    value: values[name],
    onChange: update,
    error: errors[name],
    required: true,
  });
  return (
    <AuthLayout
      variant="onboarding"
      title="Make EasyFinance yours"
      subtitle="Your demo account is ready. Let’s set up your financial workspace."
      footer={<p>Setup is saved only for this demo session.</p>}
    >
      <ol className="step-progress" aria-label="Setup progress">
        {steps.map((name, index) => (
          <li key={name} aria-current={step === index ? 'step' : undefined}>
            <span>{index + 1}</span>
            <small>{name}</small>
          </li>
        ))}
      </ol>
      <h2 ref={heading} tabIndex="-1" className="step-title">
        Step {step + 1} of 4: {steps[step]}
      </h2>
      <form noValidate onSubmit={submit} aria-label="Workspace setup">
        <fieldset disabled={loading}>
          {step === 0 && (
            <>
              <InputField
                label="Full name"
                autoComplete="name"
                maxLength={100}
                {...field('fullName')}
              />
              <InputField label="Preferred language" {...field('language')}>
                {Object.entries(LANGUAGES).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </InputField>
            </>
          )}
          {step === 1 && (
            <>
              <InputField
                label="Workspace name"
                maxLength={80}
                {...field('workspaceName')}
              />
              <InputField label="Workspace type" {...field('workspaceType')}>
                <option value="personal">Personal</option>
                <option value="shared">Shared</option>
              </InputField>
              <p className="field-hint">
                You can invite a partner later. Invitations and permissions are
                not available in this demo.
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <InputField label="Primary currency" {...field('currency')}>
                {CURRENCIES.map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </InputField>
              <InputField label="Date format" {...field('dateFormat')}>
                {DATE_FORMATS.map((format) => (
                  <option key={format}>{format}</option>
                ))}
              </InputField>
              <InputField label="Time zone" {...field('timeZone')}>
                {timeZones.map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </InputField>
            </>
          )}
          {step === 3 && (
            <dl className="setup-summary">
              {[
                ['Full name', values.fullName],
                ['Language', LANGUAGES[values.language]],
                ['Workspace', values.workspaceName],
                ['Type', values.workspaceType],
                ['Currency', values.currency],
                ['Date format', values.dateFormat],
                ['Time zone', values.timeZone],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <FormError>{error}</FormError>
          <div className="step-actions">
            {step > 0 && (
              <button
                className="secondary-button"
                type="button"
                onClick={() => go(step - 1)}
              >
                Back
              </button>
            )}
            <PrimaryButton type="submit" loading={loading}>
              {step === 3 ? 'Start using EasyFinance' : 'Continue'}
            </PrimaryButton>
          </div>
        </fieldset>
      </form>
    </AuthLayout>
  );
}
