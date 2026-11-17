import { useId, useState } from 'react';
import Icon from './Icon.jsx';
export function InputField({ label, error, hint, icon, children, ...props }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`input-wrap ${error ? 'has-error' : ''}`}>
        {icon && <Icon name={icon} className="field-icon" />}
        {children ? (
          <select
            {...props}
            id={id}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? `${id}-error` : hint ? `${id}-hint` : undefined
            }
          >
            {children}
          </select>
        ) : (
          <input
            {...props}
            id={id}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? `${id}-error` : hint ? `${id}-hint` : undefined
            }
          />
        )}
      </div>
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
export function PasswordField({ label = 'Password', error, hint, ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`input-wrap password-wrap ${error ? 'has-error' : ''}`}>
        <input
          {...props}
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
        />
        <button
          className="password-toggle"
          type="button"
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          <Icon name={visible ? 'hidden' : 'eye'} />
        </button>
      </div>
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
export function PrimaryButton({
  children,
  loading = false,
  disabled,
  ...props
}) {
  return (
    <button
      className="primary-button"
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <>
          <span className="spinner" aria-hidden="true" /> Please wait…
        </>
      ) : (
        <>
          {children}
          <Icon name="arrow" />
        </>
      )}
    </button>
  );
}
export function FormError({ children }) {
  return children ? (
    <div className="form-error" role="alert" tabIndex="-1">
      {children}
    </div>
  ) : null;
}
