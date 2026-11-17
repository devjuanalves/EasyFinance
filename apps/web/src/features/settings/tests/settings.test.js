import { describe, it, expect } from 'vitest';
import {
  financialData,
  DEFAULT_FILTERS,
} from '../../finance/data/financialData.js';
import { summarize } from '../../finance/data/calculations.js';
import {
  createFinancialStore,
  blankInvoice,
  applyIncomeCommand,
} from '../../income/incomeService.js';
import { applyExpenseCommand } from '../../expenses/expenseService.js';
import { applyInvestmentCommand } from '../../investments/investmentService.js';
import {
  automationEntityLabel,
  seedSettings,
  applySettingsCommand,
  settingsView,
  defaults,
  formattedExample,
  notificationPrefs,
  nextOccurrence,
} from '../settingsService.js';
import { scopedFinancialData, authorizedWorkspaces } from '../permissions.js';
const owner = { ...DEFAULT_FILTERS, userId: 'demo-user', role: 'owner' };
const user = {
  id: 'demo-user',
  fullName: 'Alex Morgan',
  email: 'alex@example.com',
};
const seed = () => seedSettings(financialData, user);
const cmd = (data, action, payload = {}, context = owner) =>
  applySettingsCommand(data, context, action, payload);
const ctx = (userId) => ({ ...owner, userId });
const auto = (more = {}) => ({
  name: 'Review',
  type: 'alert',
  frequency: 'monthly',
  nextDate: '2026-10-31',
  timeZone: 'Australia/Sydney',
  status: 'active',
  ...more,
});
function automation(data = seed(), more = {}) {
  const saved = cmd(data, 'automation', { automation: auto(more) });
  return { data: saved.data, id: saved.result };
}
function template(data) {
  const client = data.clients.find(
    (c) => !c.archived && c.defaultCurrency === 'AUD',
  );
  const draft = blankInvoice(data, owner, client.id);
  return applyIncomeCommand(data, owner, 'saveTemplate', {
    template: {
      ...draft,
      name: 'Review template',
      frequency: 'monthly',
      nextDate: data.asOf,
      items: [
        {
          description: 'Work',
          quantity: '1.25',
          unit: 'hours',
          unitPrice: '100',
          taxRate: '0',
        },
      ],
    },
  });
}
describe('Settings identity and workspace boundaries', () => {
  it('seeds individual identities and authorized workspaces without changing ledger', () => {
    const d = seed();
    expect(d.transactions).toEqual(financialData.transactions);
    expect(settingsView(d, user.id, 'personal').members).toHaveLength(3);
    expect(authorizedWorkspaces(d, 'sam-demo')).toHaveLength(1);
    expect(
      settingsView(d, user.id, 'personal').members.every(
        (m) => !('preferences' in m),
      ),
    ).toBe(true);
  });
  it('saves profile and personal formats without modifying another user or financial records', () => {
    const d = seed(),
      out = cmd(d, 'profile', {
        fullName: 'Alex Updated',
        preferences: {
          ...defaults,
          currency: 'EUR',
          numberFormat: '1.234,56',
          dateFormat: 'YYYY-MM-DD',
        },
      }).data;
    expect(out.users[0].fullName).toBe('Alex Updated');
    expect(out.users[1]).toEqual(d.users[1]);
    expect(out.transactions).toEqual(d.transactions);
    expect(out.workspaces).toEqual(d.workspaces);
  });
  it.each([
    { fullName: '' },
    { preferences: { ...defaults, language: 'invalid' } },
    { preferences: { ...defaults, currency: 'XYZ' } },
    { preferences: { ...defaults, dateFormat: 'bad' } },
    { preferences: { ...defaults, numberFormat: 'bad' } },
    { preferences: { ...defaults, timeZone: 'Mars' } },
    { preferences: { ...defaults, monthStart: '29' } },
  ])('rejects invalid profile %j', (more) =>
    expect(() =>
      cmd(seed(), 'profile', {
        fullName: 'Alex',
        preferences: defaults,
        ...more,
      }),
    ).toThrow(),
  );
  it('formats decimal and date examples without converting money or dates', () => {
    expect(formattedExample({ ...defaults, numberFormat: '1.234,56' })).toEqual(
      { number: '1.234,56', date: '31/10/2026' },
    );
    expect(
      formattedExample({ ...defaults, dateFormat: 'MM/DD/YYYY' }).date,
    ).toBe('10/31/2026');
  });
  it('owner updates workspace metadata only', () => {
    const d = seed(),
      out = cmd(d, 'workspace', {
        name: 'Family',
        type: 'shared',
        baseCurrency: 'USD',
        timeZone: 'UTC',
      }).data;
    expect(out.workspaces[0].name).toBe('Family');
    expect(out.transactions).toEqual(d.transactions);
    expect(out.investments).toEqual(d.investments);
    expect(out.users).toEqual(d.users);
  });
  it.each(['sam-demo', 'viewer-demo'])(
    'rejects owner operations for %s even with forged owner role',
    (userId) => {
      for (const action of ['workspace', 'invite', 'member', 'automation'])
        expect(() => cmd(seed(), action, {}, ctx(userId))).toThrow(
          /Permission/,
        );
    },
  );
  it.each([
    ['income', applyIncomeCommand, 'saveInvoice'],
    ['expense', applyExpenseCommand, 'saveTransaction'],
    ['investment', applyInvestmentCommand, 'valuation'],
  ])('guards direct %s service mutations for viewers', (_, fn, action) =>
    expect(() => fn(seed(), ctx('viewer-demo'), action, {})).toThrow(
      /Permission/,
    ),
  );
  it('editor can create invoice draft but cannot escalate membership', () => {
    const d = seed(),
      client = d.clients.find((c) => c.defaultCurrency === 'AUD');
    const draft = {
      ...blankInvoice(d, owner, client.id),
      items: [
        {
          description: 'Work',
          quantity: '1',
          unit: 'hours',
          unitPrice: '100',
          taxRate: '0',
        },
      ],
    };
    expect(
      applyIncomeCommand(d, ctx('sam-demo'), 'saveInvoice', { draft }).result,
    ).toBeTruthy();
    expect(() =>
      cmd(
        d,
        'member',
        { id: 'member-sam-demo', role: 'owner' },
        ctx('sam-demo'),
      ),
    ).toThrow(/Permission/);
  });
  it('read snapshots omit unauthorized workspaces and dependent records', () => {
    const d = seed(),
      out = scopedFinancialData(d, 'sam-demo', 'empty');
    expect(out.transactions).toEqual([]);
    expect(out.invoices).toEqual([]);
    expect(out.invoiceItems).toEqual([]);
    expect(out.investmentValuations).toEqual([]);
    expect(out.users).toBeUndefined();
    expect(out.workspaces.map((w) => w.id)).toEqual(['personal']);
  });
});
describe('Invitations and membership lifecycle', () => {
  it.each(['bad', 'alex@example.com', 'partner@example.com'])(
    'rejects malformed, member or pending email %s',
    (email) =>
      expect(() => cmd(seed(), 'invite', { email, role: 'editor' })).toThrow(),
  );
  it('normalizes addresses and never allows invitation ownership', () => {
    const d = cmd(seed(), 'invite', {
      email: ' NEW@Example.com ',
      role: 'viewer',
    }).data;
    expect(d.invitations.at(-1).email).toBe('new@example.com');
    expect(() =>
      cmd(seed(), 'invite', { email: 'new@example.com', role: 'owner' }),
    ).toThrow(/Editor or Viewer/);
  });
  it('pending invitation grants no access; explicit acceptance creates one membership', () => {
    let d = seed();
    expect(authorizedWorkspaces(d, 'partner@example.com')).toEqual([]);
    expect(() =>
      cmd(d, 'invitation', { id: 'invite-sample', operation: 'accept' }),
    ).toThrow(/Explicit/);
    d = cmd(d, 'invitation', {
      id: 'invite-sample',
      operation: 'accept',
      confirmed: true,
    }).data;
    const recipient = d.users.find((u) => u.email === 'partner@example.com');
    expect(authorizedWorkspaces(d, recipient.id)).toHaveLength(1);
    expect(() =>
      cmd(d, 'invitation', {
        id: 'invite-sample',
        operation: 'accept',
        confirmed: true,
      }),
    ).toThrow(/pending/);
  });
  it('revocation blocks acceptance and resend; expiration allows preparation but no premature acceptance', () => {
    let d = cmd(seed(), 'invitation', {
      id: 'invite-sample',
      operation: 'revoke',
    }).data;
    expect(() =>
      cmd(d, 'invitation', {
        id: 'invite-sample',
        operation: 'accept',
        confirmed: true,
      }),
    ).toThrow();
    expect(() =>
      cmd(d, 'invitation', { id: 'invite-sample', operation: 'resend' }),
    ).toThrow();
    expect(() =>
      cmd(d, 'invitation', {
        id: 'invite-expired',
        operation: 'accept',
        confirmed: true,
      }),
    ).toThrow();
    d = cmd(d, 'invitation', {
      id: 'invite-expired',
      operation: 'resend',
    }).data;
    expect(d.invitations.find((i) => i.id === 'invite-expired').status).toBe(
      'pending',
    );
  });
  it('resending does not duplicate active memberships', () => {
    let d = seed();
    for (let i = 0; i < 3; i++)
      d = cmd(d, 'invitation', {
        id: 'invite-sample',
        operation: 'resend',
      }).data;
    expect(d.memberships).toHaveLength(4);
  });
  it('owner changes role and cannot remove or demote owner', () => {
    const d = cmd(seed(), 'member', {
      id: 'member-sam-demo',
      role: 'viewer',
    }).data;
    expect(settingsView(d, 'sam-demo', 'personal').role).toBe('viewer');
    for (const p of [
      { role: 'viewer' },
      { operation: 'remove', confirmed: true },
    ])
      expect(() => cmd(d, 'member', { id: 'member-personal', ...p })).toThrow(
        /Owner/,
      );
  });
  it('removal needs confirmation, revokes reads and writes, preserves financial history', () => {
    const d = seed();
    expect(() =>
      cmd(d, 'member', { id: 'member-sam-demo', operation: 'remove' }),
    ).toThrow(/Confirm/);
    const out = cmd(d, 'member', {
      id: 'member-sam-demo',
      operation: 'remove',
      confirmed: true,
    }).data;
    expect(settingsView(out, 'sam-demo', 'personal').role).toBeNull();
    expect(
      scopedFinancialData(out, 'sam-demo', 'personal').transactions,
    ).toEqual([]);
    expect(() =>
      applyIncomeCommand(out, ctx('sam-demo'), 'saveInvoice', {}),
    ).toThrow(/Permission/);
    expect(out.transactions).toEqual(d.transactions);
    expect(out.invoiceItems).toEqual(d.invoiceItems);
  });
  it('rejects unrelated workspace invitation access', () =>
    expect(() =>
      cmd(
        seed(),
        'invitation',
        { id: 'invite-sample', operation: 'revoke' },
        { ...owner, workspaceId: 'empty' },
      ),
    ).toThrow(/not found/));
});
describe('Automation and notification integrity', () => {
  it.each([
    { frequency: 'hourly' },
    { timeZone: 'Mars' },
    { nextDate: 'bad' },
    { type: 'email' },
    { name: '' },
    { type: 'draft', templateId: 'bad', clientId: 'bad' },
  ])('validates configuration %j', (more) =>
    expect(() => automation(seed(), more)).toThrow(),
  );
  it('clamps monthly dates and supports weekly/fortnightly calendar schedules', () => {
    expect(nextOccurrence('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextOccurrence('2026-10-31', 'fortnightly')).toBe('2026-11-14');
    expect(nextOccurrence('2026-10-31', 'weekly')).toBe('2026-11-07');
  });
  it('explicit runs are idempotent and notifications never change finances', () => {
    const { data, id } = automation();
    const out = cmd(data, 'run', { id }).data;
    expect(out.automationRuns).toHaveLength(1);
    expect(out.notifications).toHaveLength(1);
    const again = cmd(out, 'run', { id, occurrence: data.asOf }).data;
    expect(again.automationRuns).toHaveLength(1);
    expect(again.notifications).toHaveLength(1);
    expect(again.transactions).toEqual(data.transactions);
    expect(again.investmentValuations).toEqual(data.investmentValuations);
  });
  it('paused and deleted configurations cannot run; deletion preserves history', () => {
    let { data, id } = automation();
    data = cmd(data, 'toggleAutomation', { id }).data;
    expect(() => cmd(data, 'run', { id })).toThrow(/Paused/);
    data = cmd(data, 'toggleAutomation', { id }).data;
    data = cmd(data, 'run', { id }).data;
    expect(() => cmd(data, 'deleteAutomation', { id })).toThrow(/Confirm/);
    data = cmd(data, 'deleteAutomation', { id, confirmed: true }).data;
    expect(() => cmd(data, 'run', { id })).toThrow(/not found/);
    expect(data.automationRuns).toHaveLength(1);
  });
  it('future schedules do not run early', () => {
    const { data, id } = automation(seed(), { nextDate: '2026-11-01' });
    expect(() => cmd(data, 'run', { id })).toThrow(/future/);
  });
  it('uses existing template math to create one draft and never records income or payment', () => {
    const t = template(seed());
    const rule = t.data.recurringRules.find((r) => r.id === t.result);
    const { data, id } = automation(t.data, {
      type: 'draft',
      templateId: rule.id,
      clientId: rule.clientId,
    });
    const out = cmd(data, 'run', { id }).data;
    const run = out.automationRuns[0],
      invoice = out.invoices.find((i) => i.id === run.invoiceId);
    expect(run.status).toBe('pending-review');
    expect(invoice.lifecycle).toBe('draft');
    expect(invoice.total).toBe(12500);
    expect(out.payments).toEqual(data.payments);
    expect(summarize(out, DEFAULT_FILTERS)).toEqual(
      summarize(data, DEFAULT_FILTERS),
    );
    expect(
      cmd(out, 'run', { id, occurrence: data.asOf }).data.invoices,
    ).toHaveLength(out.invoices.length);
  });
  it('same template occurrence cannot generate a second draft through another automation', () => {
    const t = template(seed()),
      rule = t.data.recurringRules[0];
    let { data, id } = automation(t.data, {
      type: 'draft',
      templateId: rule.id,
      clientId: rule.clientId,
    });
    data = cmd(data, 'run', { id }).data;
    const second = automation(data, {
      type: 'draft',
      templateId: rule.id,
      clientId: rule.clientId,
    });
    const out = cmd(second.data, 'run', { id: second.id }).data;
    expect(out.automationRuns.at(-1).status).toBe('failed');
    expect(out.invoices).toHaveLength(data.invoices.length);
  });
  it('reminder timing failures are recorded without fabricated delivery', () => {
    const d = seed(),
      inv = d.invoices.find((i) => i.status === 'overdue');
    const { data, id } = automation(d, {
      type: 'reminder',
      invoiceId: inv.id,
      timing: 'before',
    });
    const out = cmd(data, 'run', { id }).data;
    expect(out.automationRuns[0].status).toBe('failed');
    expect(out.notifications).toEqual([]);
    expect(out.payments).toEqual(d.payments);
  });
  it('valid overdue reminder emits only internal event', () => {
    const d = seed(),
      inv = d.invoices.find((i) => i.status === 'overdue');
    const { data, id } = automation(d, {
      type: 'reminder',
      invoiceId: inv.id,
      timing: 'after',
    });
    const out = cmd(data, 'run', { id }).data;
    expect(out.notifications[0].type).toBe('Invoice overdue');
    expect(out.invoices).toEqual(d.invoices);
  });
  it.each(['daily', 'weekly', 'disabled'])(
    'notification setting %s suppresses immediate events',
    (mode) => {
      let d = seed();
      const prefs = notificationPrefs(d, user.id, 'personal');
      d = cmd(d, 'preferences', {
        ...prefs,
        frequency: mode === 'disabled' ? 'immediate' : mode,
        enabled: { ...prefs.enabled, 'Financial alerts': mode !== 'disabled' },
      }).data;
      const a = automation(d);
      expect(cmd(a.data, 'run', { id: a.id }).data.notifications).toHaveLength(
        0,
      );
    },
  );
  it('preferences and notifications remain recipient and workspace isolated', () => {
    let { data, id } = automation();
    data = cmd(data, 'run', { id }).data;
    expect(settingsView(data, 'sam-demo', 'personal').notifications).toEqual(
      [],
    );
    expect(settingsView(data, user.id, 'empty').notifications).toEqual([]);
    data = cmd(data, 'read', {}, ctx('sam-demo')).data;
    expect(data.notifications[0].read).toBe(false);
    data = cmd(data, 'read').data;
    expect(data.notifications[0].read).toBe(true);
  });
  it('store guards mutations and generates notifications only for actual financial events', () => {
    const store = createFinancialStore(seed());
    expect(() =>
      store.command(ctx('viewer-demo'), 'investment:valuation', {}),
    ).toThrow(/Permission/);
    expect(store.getSnapshot().notifications).toHaveLength(0);
    store.command(owner, 'investment:valuation', {
      id: 'etf',
      form: {
        valuedAt: '2026-10-31',
        currency: 'AUD',
        estimatedValue: '5000',
        notes: '',
      },
    });
    expect(store.getSnapshot().notifications).toHaveLength(1);
  });
});

describe('Final permission and automation label regressions', () => {
  it('distinguishes read-only, missing access and Owner-only restrictions', () => {
    expect(() =>
      applyIncomeCommand(seed(), ctx('viewer-demo'), 'saveInvoice', {}),
    ).toThrow(/read-only/);
    expect(() =>
      applyIncomeCommand(seed(), ctx('missing-user'), 'saveInvoice', {}),
    ).toThrow(/access is unavailable/);
    expect(() => cmd(seed(), 'invite', {}, ctx('sam-demo'))).toThrow(
      /Owner access/,
    );
  });
  it.each(['draft', 'reminder', 'alert'])(
    'labels %s by the correct related entity',
    (type) => {
      const data = seed(),
        client = data.clients[0],
        invoice = data.invoices[0];
      const rule = {
        workspaceId: 'personal',
        type,
        clientId: client.id,
        invoiceId: invoice.id,
      };
      expect(automationEntityLabel(data, rule)).toBe(
        type === 'draft'
          ? client.name
          : type === 'reminder'
            ? invoice.number
            : 'Workspace review',
      );
    },
  );
  it('uses explicit missing-entity fallbacks without cross-workspace lookup', () => {
    const data = seed();
    expect(
      automationEntityLabel(data, {
        workspaceId: 'empty',
        type: 'draft',
        clientId: data.clients[0].id,
      }),
    ).toBe('Client unavailable');
    expect(
      automationEntityLabel(data, {
        workspaceId: 'empty',
        type: 'reminder',
        invoiceId: data.invoices[0].id,
      }),
    ).toBe('Invoice unavailable');
  });
});
