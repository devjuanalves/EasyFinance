import { useState } from 'react';
import { useWorkspace } from '../../finance/WorkspaceContext.js';
import { Field } from './IncomeUI.jsx';
export default function ClientForm({
  client,
  onSaved,
  onSubmitClient,
  editable,
}) {
  const { command, canEdit } = useWorkspace();
  const [form, setForm] = useState(
    client || {
      type: 'business',
      name: '',
      businessName: '',
      email: '',
      phone: '',
      address: '',
      taxId: '',
      defaultCurrency: 'AUD',
      paymentTerms: '14',
      notes: '',
    },
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (name, value) => setForm({ ...form, [name]: value });
  return (
    <form
      className="income-form"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          setBusy(true);
          const id = onSubmitClient
            ? await onSubmitClient(form)
            : command('saveClient', { id: client?.id, client: form });
          onSaved(id, form);
        } catch (error) {
          setError(error.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="form-grid">
        <Field label="Client type">
          <select
            aria-label="Client type"
            value={form.type}
            onChange={(e) => change('type', e.target.value)}
          >
            <option value="business">Business</option>
            <option value="individual">Individual</option>
          </select>
        </Field>
        <Field
          label="Client name"
          value={form.name}
          onChange={(e) => change('name', e.target.value)}
          required
        />
        <Field
          label="Business name"
          value={form.businessName}
          onChange={(e) => change('businessName', e.target.value)}
          required={form.type === 'business'}
        />
        <Field
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => change('email', e.target.value)}
        />
        <Field
          label="Phone"
          value={form.phone}
          onChange={(e) => change('phone', e.target.value)}
        />
        <Field
          label="Address"
          value={form.address}
          onChange={(e) => change('address', e.target.value)}
        />
        <Field
          label="Tax identifier (optional)"
          value={form.taxId}
          onChange={(e) => change('taxId', e.target.value)}
        />
        <Field label="Default currency">
          <select
            aria-label="Default currency"
            value={form.defaultCurrency}
            onChange={(e) => change('defaultCurrency', e.target.value)}
          >
            <option>AUD</option>
            <option>EUR</option>
          </select>
        </Field>
        <Field
          label="Payment terms (days)"
          inputMode="numeric"
          value={form.paymentTerms}
          onChange={(e) => change('paymentTerms', e.target.value)}
        />
        <Field
          label="Client notes"
          value={form.notes}
          onChange={(e) => change('notes', e.target.value)}
        />
      </div>
      <p className="muted">
        Tax identifiers are optional, jurisdiction-specific and not verified. No
        tax registration is assumed.
      </p>
      <button
        className="primary-button"
        disabled={busy || !(editable ?? canEdit)}
      >
        Save client
      </button>
    </form>
  );
}
