import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { WorkspaceContext, useWorkspace } from '../finance/WorkspaceContext.js';
import { useAuth } from '../auth/hooks/useAuth.js';
import { api } from '../../services/persistentApi.js';
import { Field } from '../income/components/IncomeUI.jsx';
import InvestmentDashboard from '../investments/InvestmentDashboard.jsx';
import InvestmentEditor from '../investments/InvestmentEditor.jsx';
import InvestmentDetails from '../investments/InvestmentDetails.jsx';
const allowed = {
  create: [
    'name',
    'assetType',
    'customType',
    'symbol',
    'investmentAccountId',
    'currency',
    'date',
    'quantity',
    'unitPrice',
    'fee',
    'amount',
    'estimatedValue',
    'valuedAt',
    'notes',
    'tags',
    'interestInfo',
  ],
  update: [
    'name',
    'assetType',
    'customType',
    'symbol',
    'investmentAccountId',
    'currency',
    'notes',
    'tags',
    'interestInfo',
  ],
  recordMovement: [
    'type',
    'currency',
    'date',
    'quantity',
    'unitPrice',
    'amount',
    'fee',
    'notes',
  ],
  editMovement: [
    'type',
    'currency',
    'date',
    'quantity',
    'unitPrice',
    'amount',
    'fee',
    'notes',
  ],
  valuation: ['currency', 'valuedAt', 'estimatedValue', 'notes'],
};
export default function PersistentInvestments({ screen = 'overview' }) {
  const user = useAuth(),
    [params, setParams] = useSearchParams();
  const workspaces = useQuery({
    queryKey: ['persistent', user.id, 'workspaces'],
    queryFn: () => api('/workspaces'),
    retry: false,
  });
  const selected = params.has('workspace')
    ? workspaces.data?.find((w) => w.id === params.get('workspace'))
    : workspaces.data?.[0];
  return (
    <>
      <section className="workspace-content">
        <p className="data-provenance">
          Persistent development portfolio · manual values · cash ledger remains
          separate
        </p>
        {workspaces.isPending ? (
          <p role="status">Loading workspaces…</p>
        ) : workspaces.isError ? (
          <p role="alert">{workspaces.error.message}</p>
        ) : (
          <Field label="Persistent workspace">
            <select
              aria-label="Persistent workspace"
              value={selected?.id || ''}
              onChange={(e) => setParams({ workspace: e.target.value })}
            >
              <option value="" disabled>
                Select workspace
              </option>
              {workspaces.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} · {w.role}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!selected && !workspaces.isPending && (
          <p role="alert">Workspace unavailable.</p>
        )}
      </section>
      {selected && (
        <Records
          key={selected.id}
          workspace={selected}
          user={user}
          screen={screen}
        />
      )}
    </>
  );
}
function Records({ workspace, user, screen }) {
  const parent = useWorkspace(),
    client = useQueryClient(),
    busy = useRef(false),
    pending = useRef(null);
  const [currency, setCurrency] = useState('AUD'),
    [saving, setSaving] = useState(false);
  const key = ['persistent', user.id, workspace.id, 'investments'];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api(`/workspaces/${workspace.id}/investments`),
    retry: false,
  });
  const data = query.data;
  const filters = {
    workspaceId: workspace.id,
    currency,
    periodId: 'all',
    scenario: 'normal',
    role: workspace.role,
  };
  const command = async (name, payload) => {
    if (busy.current) throw new Error('A save is already in progress.');
    const action = name.replace('investment:', '');
    let p;
    if (action === 'createAccount') p = payload;
    else {
      p = {};
      if (action !== 'create') p.id = payload.id;
      if (allowed[action])
        p.form = Object.fromEntries(
          allowed[action]
            .filter(
              (k) => payload.form[k] !== undefined && payload.form[k] !== null,
            )
            .map((k) => [k, String(payload.form[k])]),
        );
      if (action === 'editMovement' || action === 'deleteMovement')
        p.movementId = payload.movementId;
      if (action === 'deleteValuation') p.valuationId = payload.valuationId;
      if (
        ['editMovement', 'deleteMovement', 'deleteValuation'].includes(action)
      )
        p.confirmed = payload.confirmed;
    }
    const body = {
      action,
      payload: p,
      ...(p.id
        ? {
            version:
              payload.expectedVersion ??
              data.investments.find((i) => i.id === p.id)?.version,
          }
        : {}),
    };
    const signature = JSON.stringify(body);
    if (pending.current?.signature !== signature)
      pending.current = { signature, key: crypto.randomUUID() };
    busy.current = true;
    setSaving(true);
    try {
      const result = await api(
        `/workspaces/${workspace.id}/investments/commands`,
        { method: 'POST', body: { key: pending.current.key, ...body } },
      );
      client.setQueryData(key, result.data);
      pending.current = null;
      return result.result;
    } catch (e) {
      if (e.status === 409) {
        pending.current = null;
        await query.refetch();
      }
      throw e;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const periods = data
    ? [
        {
          id: 'all',
          label: 'All recorded history',
          start: data.coverageStart,
          end: data.asOf,
        },
        {
          id: 'year',
          label: 'Current year',
          start: data.asOf.slice(0, 4) + '-01-01',
          end: data.asOf,
        },
        {
          id: 'month',
          label: 'Current month',
          start: data.asOf.slice(0, 7) + '-01',
          end: data.asOf,
        },
      ]
    : [];
  return (
    <WorkspaceContext.Provider
      value={{
        ...parent,
        persistent: true,
        periods,
        filters,
        ledger: query,
        command,
        canEdit: workspace.role !== 'viewer' && !saving && !query.isError,
        setFilter: (name, value) =>
          name === 'currency' ? setCurrency(value) : query.refetch(),
      }}
    >
      {saving && <p role="status">Saving investment records…</p>}
      {screen === 'overview' ? (
        <InvestmentDashboard />
      ) : screen === 'detail' ? (
        <InvestmentDetails />
      ) : (
        <InvestmentEditor />
      )}
    </WorkspaceContext.Provider>
  );
}
