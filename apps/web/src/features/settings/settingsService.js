import { CURRENCIES } from '../auth/validation/authValidation.js';
import {
  requirePermission,
  authorizedWorkspaces,
  roleFor,
} from './permissions.js';
import {
  applyIncomeCommand,
  blankInvoice,
  addDays,
} from '../income/incomeService.js';
import { validDate } from '../finance/data/dates.js';
export const LANGUAGES = ['en-AU', 'pt-BR', 'en-US'];
export const ZONES = [
  'Australia/Sydney',
  'UTC',
  'Europe/London',
  'America/New_York',
];
export { EVENTS } from '../../../../../packages/shared/src/notificationEvents.js';
import { EVENTS } from '../../../../../packages/shared/src/notificationEvents.js';
export const defaults = {
  language: LANGUAGES[0],
  currency: 'AUD',
  dateFormat: 'DD/MM/YYYY',
  numberFormat: '1,234.56',
  timeZone: ZONES[0],
  monthStart: '1',
};
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
const email = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const id = (data) =>
  `settings-${(data.settingsSequence = (data.settingsSequence || 0) + 1)}`;
export function seedSettings(seed, user) {
  const data = structuredClone(seed);
  data.users = [
    {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      preferences: { ...defaults, ...user.preferences },
    },
    {
      id: 'sam-demo',
      fullName: 'Sam Taylor',
      email: 'sam@example.com',
      preferences: { ...defaults },
    },
    {
      id: 'viewer-demo',
      fullName: 'Casey Lee',
      email: 'casey@example.com',
      preferences: { ...defaults },
    },
  ];
  data.workspaces = data.workspaces.map((w) => ({
    ...w,
    name:
      w.id === 'personal' ? user.preferences?.workspaceName || w.name : w.name,
    type:
      w.id === 'personal'
        ? user.preferences?.workspaceType || 'personal'
        : 'personal',
    baseCurrency:
      w.id === 'personal' ? user.preferences?.currency || 'AUD' : 'AUD',
    timeZone:
      w.id === 'personal' ? user.preferences?.timeZone || ZONES[0] : ZONES[0],
    ownerId: user.id,
  }));
  data.memberships = data.workspaces.map((w) => ({
    id: `member-${w.id}`,
    workspaceId: w.id,
    userId: user.id,
    role: 'owner',
    status: 'active',
    joined: '2026-08-01',
  }));
  data.memberships.push(
    ...['sam-demo', 'viewer-demo'].map((userId, i) => ({
      id: `member-${userId}`,
      workspaceId: 'personal',
      userId,
      role: i ? 'viewer' : 'editor',
      status: 'active',
      joined: '2026-10-14',
    })),
  );
  data.invitations = [
    {
      id: 'invite-sample',
      workspaceId: 'personal',
      email: 'partner@example.com',
      role: 'editor',
      message: 'Fictional invitation; no email sent.',
      status: 'pending',
      expires: '2026-11-07',
      created: '2026-10-31',
    },
    {
      id: 'invite-expired',
      workspaceId: 'personal',
      email: 'expired@example.com',
      role: 'viewer',
      message: 'Historical fictional invitation.',
      status: 'expired',
      expires: '2026-10-20',
      created: '2026-10-13',
    },
  ];
  data.automations = [];
  data.automationRuns = [];
  data.notifications = [];
  data.notificationPreferences = [];
  data.settingsEvents = [];
  return data;
}
export function invitationStatus(inv, date) {
  return inv.status === 'pending' && inv.expires < date
    ? 'expired'
    : inv.status;
}
export function notificationPrefs(data, userId, workspaceId) {
  return (
    data.notificationPreferences.find(
      (p) => p.userId === userId && p.workspaceId === workspaceId,
    ) || {
      userId,
      workspaceId,
      enabled: Object.fromEntries(
        Object.values(EVENTS)
          .flat()
          .map((k) => [k, true]),
      ),
      frequency: 'immediate',
      time: '09:00',
      timeZone: ZONES[0],
    }
  );
}
export function settingsView(data, userId, workspaceId) {
  const role = roleFor(data, { userId, workspaceId });
  const members = role
    ? data.memberships.filter((m) => m.workspaceId === workspaceId)
    : [];
  return {
    user: data.users.find((u) => u.id === userId),
    role,
    workspaces: authorizedWorkspaces(data, userId),
    workspace: role ? data.workspaces.find((w) => w.id === workspaceId) : null,
    members: members.map((m) => ({
      ...m,
      fullName: data.users.find((u) => u.id === m.userId)?.fullName,
      email: data.users.find((u) => u.id === m.userId)?.email,
    })),
    invitations: role
      ? data.invitations
          .filter((i) => i.workspaceId === workspaceId)
          .map((i) => ({ ...i, status: invitationStatus(i, data.asOf) }))
      : [],
    automations: role
      ? data.automations.filter(
          (a) => a.workspaceId === workspaceId && !a.deleted,
        )
      : [],
    runs: role
      ? data.automationRuns.filter((a) => a.workspaceId === workspaceId)
      : [],
    notifications: role
      ? data.notifications.filter(
          (n) => n.workspaceId === workspaceId && n.recipientId === userId,
        )
      : [],
    preferences: notificationPrefs(data, userId, workspaceId),
    events: role
      ? data.settingsEvents.filter((e) => e.workspaceId === workspaceId)
      : [],
  };
}
export function formattedExample(
  preferences,
  amount = 123456,
  date = '2026-10-31',
) {
  const number = new Intl.NumberFormat(
    preferences.numberFormat === '1.234,56' ? 'de-DE' : 'en-AU',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  ).format(amount / 100);
  const [y, m, d] = date.split('-');
  return {
    number,
    date:
      preferences.dateFormat === 'MM/DD/YYYY'
        ? `${m}/${d}/${y}`
        : preferences.dateFormat === 'YYYY-MM-DD'
          ? date
          : `${d}/${m}/${y}`,
  };
}
function validZone(zone) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return typeof zone === 'string' && Boolean(zone);
  } catch {
    return false;
  }
}
export function nextOccurrence(date, frequency) {
  if (frequency !== 'monthly')
    return addDays(date, frequency === 'weekly' ? 7 : 14);
  const [y, m, d] = date.split('-').map(Number);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, last))).toISOString().slice(0, 10);
}
export function applySettingsCommand(original, context, action, payload = {}) {
  let data = structuredClone(original);
  const { userId, workspaceId } = context;
  const user = data.users.find((u) => u.id === userId);
  assert(user, 'Demo identity unavailable.');
  assert(
    !context.scenario || context.scenario === 'normal',
    'Switch to normal sample data before editing.',
  );
  const ownerActions = [
    'workspace',
    'invite',
    'invitation',
    'member',
    'automation',
    'toggleAutomation',
    'deleteAutomation',
    'run',
  ];
  if (ownerActions.includes(action)) requirePermission(data, context, 'owner');
  else if (!['profile'].includes(action))
    requirePermission(data, context, 'read');
  const event = (type, entityId) =>
    data.settingsEvents.push({
      id: id(data),
      workspaceId,
      actor: userId,
      type,
      entityId,
      timestamp: new Date().toISOString(),
    });
  const notify = (
    recipientId,
    type,
    title,
    target = '/settings/automations',
  ) => {
    const prefs = notificationPrefs(data, recipientId, workspaceId);
    if (prefs.enabled[type] && prefs.frequency === 'immediate')
      data.notifications.push({
        id: id(data),
        workspaceId,
        recipientId,
        type,
        title,
        target,
        read: false,
        timestamp: new Date().toISOString(),
      });
  };
  let result;
  if (action === 'profile') {
    const p = payload.preferences;
    assert(payload.fullName?.trim(), 'Name is required.');
    assert(LANGUAGES.includes(p.language), 'Choose a supported language.');
    assert(CURRENCIES.includes(p.currency), 'Choose a native currency.');
    assert(
      ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(p.dateFormat),
      'Choose a date format.',
    );
    assert(
      ['1,234.56', '1.234,56'].includes(p.numberFormat),
      'Choose a number format.',
    );
    assert(validZone(p.timeZone), 'Choose a supported time zone.');
    assert(
      /^(?:[1-9]|1\d|2[0-8])$/.test(String(p.monthStart)),
      'Month start must be 1–28.',
    );
    user.fullName = payload.fullName.trim();
    user.preferences = Object.fromEntries(
      Object.keys(defaults).map((k) => [k, p[k]]),
    );
    event('Profile Updated', userId);
  } else if (action === 'workspace') {
    assert(payload.name?.trim(), 'Workspace name is required.');
    assert(
      ['personal', 'shared', 'business'].includes(payload.type),
      'Select workspace type.',
    );
    assert(CURRENCIES.includes(payload.baseCurrency), 'Select a currency.');
    assert(validZone(payload.timeZone), 'Select a time zone.');
    Object.assign(
      data.workspaces.find((w) => w.id === workspaceId),
      {
        name: payload.name.trim(),
        type: payload.type,
        baseCurrency: payload.baseCurrency,
        timeZone: payload.timeZone,
      },
    );
    event('Workspace Updated', workspaceId);
  } else if (action === 'invite') {
    const address = payload.email?.trim().toLowerCase();
    assert(email(address || ''), 'Enter a valid email.');
    assert(
      ['editor', 'viewer'].includes(payload.role),
      'Invitations may grant Editor or Viewer only.',
    );
    assert(
      !data.memberships.some(
        (m) =>
          m.workspaceId === workspaceId &&
          m.status === 'active' &&
          data.users.find((u) => u.id === m.userId)?.email === address,
      ),
      'This person is already an active member.',
    );
    assert(
      !data.invitations.some(
        (i) =>
          i.workspaceId === workspaceId &&
          i.email === address &&
          invitationStatus(i, data.asOf) === 'pending',
      ),
      'An active invitation already exists.',
    );
    result = id(data);
    data.invitations.push({
      id: result,
      workspaceId,
      email: address,
      role: payload.role,
      message: (payload.message || '').slice(0, 500),
      status: 'pending',
      created: data.asOf,
      expires: addDays(data.asOf, 7),
    });
    event('Member Invited', result);
  } else if (action === 'invitation') {
    const inv = data.invitations.find(
      (i) => i.id === payload.id && i.workspaceId === workspaceId,
    );
    assert(inv, 'Invitation not found.');
    const status = invitationStatus(inv, data.asOf);
    if (payload.operation === 'accept') {
      assert(
        status === 'pending',
        'Only pending, unexpired invitations can be accepted.',
      );
      assert(payload.confirmed, 'Explicit demo acceptance required.');
      let recipient = data.users.find((u) => u.email === inv.email);
      if (!recipient) {
        recipient = {
          id: id(data),
          email: inv.email,
          fullName: inv.email.split('@')[0],
          preferences: { ...defaults },
        };
        data.users.push(recipient);
      }
      const member = data.memberships.find(
        (m) => m.workspaceId === workspaceId && m.userId === recipient.id,
      );
      assert(
        !member || member.status !== 'active',
        'Already an active member.',
      );
      if (member)
        Object.assign(member, {
          status: 'active',
          role: inv.role,
          joined: data.asOf,
        });
      else
        data.memberships.push({
          id: id(data),
          workspaceId,
          userId: recipient.id,
          status: 'active',
          role: inv.role,
          joined: data.asOf,
        });
      inv.status = 'accepted';
      notify(
        recipient.id,
        'Workspace invitations',
        'Demo invitation accepted.',
        '/settings/sharing',
      );
    } else if (payload.operation === 'revoke') {
      assert(status === 'pending', 'Only pending invitations can be revoked.');
      inv.status = 'revoked';
    } else if (payload.operation === 'resend') {
      assert(
        ['pending', 'expired'].includes(status),
        'This invitation cannot be prepared again.',
      );
      assert(
        !data.invitations.some(
          (i) =>
            i.id !== inv.id &&
            i.workspaceId === workspaceId &&
            i.email === inv.email &&
            invitationStatus(i, data.asOf) === 'pending',
        ),
        'Another active invitation exists.',
      );
      assert(
        !data.memberships.some(
          (m) =>
            m.workspaceId === workspaceId &&
            m.status === 'active' &&
            data.users.find((u) => u.id === m.userId)?.email === inv.email,
        ),
        'Already an active member.',
      );
      inv.status = 'pending';
      inv.expires = addDays(data.asOf, 7);
    } else throw new Error('Unsupported invitation action.');
    event(`Invitation ${payload.operation}`, inv.id);
  } else if (action === 'member') {
    const m = data.memberships.find(
      (m) => m.id === payload.id && m.workspaceId === workspaceId,
    );
    assert(m && m.status === 'active', 'Active member not found.');
    assert(m.role !== 'owner', 'The Owner cannot be removed or demoted.');
    if (payload.operation === 'remove') {
      assert(payload.confirmed, 'Confirm removal first.');
      m.status = 'revoked';
      event('Access Revoked', m.userId);
    } else {
      assert(
        ['editor', 'viewer'].includes(payload.role),
        'Choose Editor or Viewer.',
      );
      m.role = payload.role;
      event('Role Changed', m.userId);
      notify(
        m.userId,
        'Member role changes',
        'Your demo workspace role changed.',
        '/settings/sharing',
      );
    }
  } else if (action === 'preferences') {
    assert(
      ['immediate', 'daily', 'weekly'].includes(payload.frequency),
      'Choose notification frequency.',
    );
    assert(
      /^([01]\d|2[0-3]):[0-5]\d$/.test(payload.time),
      'Choose a valid time.',
    );
    assert(validZone(payload.timeZone), 'Choose time zone.');
    const value = {
      userId,
      workspaceId,
      frequency: payload.frequency,
      time: payload.time,
      timeZone: payload.timeZone,
      enabled: Object.fromEntries(
        Object.values(EVENTS)
          .flat()
          .map((k) => [k, Boolean(payload.enabled[k])]),
      ),
    };
    data.notificationPreferences = data.notificationPreferences.filter(
      (p) => p.userId !== userId || p.workspaceId !== workspaceId,
    );
    data.notificationPreferences.push(value);
    event('Notification Preference Updated', userId);
  } else if (action === 'read') {
    for (const n of data.notifications)
      if (
        n.recipientId === userId &&
        n.workspaceId === workspaceId &&
        (!payload.id || n.id === payload.id)
      )
        n.read = true;
  } else if (action === 'automation') {
    const a = payload.automation;
    assert(a.name?.trim(), 'Automation name is required.');
    assert(
      ['draft', 'reminder', 'alert'].includes(a.type),
      'Choose an automation type.',
    );
    assert(
      ['weekly', 'fortnightly', 'monthly'].includes(a.frequency),
      'Choose a valid frequency.',
    );
    assert(
      validDate(a.nextDate) && a.nextDate >= data.coverageStart,
      'Choose a valid next date within sample coverage or later.',
    );
    assert(ZONES.includes(a.timeZone), 'Choose a supported time zone.');
    if (a.type === 'draft')
      assert(
        data.recurringRules.some(
          (r) =>
            r.id === a.templateId &&
            r.workspaceId === workspaceId &&
            r.clientId === a.clientId,
        ),
        'Choose a template belonging to the selected client.',
      );
    if (a.type === 'reminder') {
      assert(
        data.invoices.some(
          (i) =>
            i.id === a.invoiceId &&
            i.workspaceId === workspaceId &&
            !['cancelled', 'draft', 'paid'].includes(i.status),
        ),
        'Choose an outstanding billed invoice.',
      );
      assert(
        ['before', 'on', 'after'].includes(a.timing),
        'Choose reminder timing.',
      );
    }
    const previous = payload.id
      ? data.automations.find(
          (r) =>
            r.id === payload.id && r.workspaceId === workspaceId && !r.deleted,
        )
      : null;
    assert(!payload.id || previous, 'Automation not found.');
    result = previous?.id || id(data);
    const value = {
      id: result,
      workspaceId,
      name: a.name.trim(),
      type: a.type,
      frequency: a.frequency,
      nextDate: a.nextDate,
      timeZone: a.timeZone,
      clientId: a.clientId,
      templateId: a.templateId,
      invoiceId: a.invoiceId,
      timing: a.timing,
      status: a.status === 'paused' ? 'paused' : 'active',
      mode: 'review',
      channel: 'in-app',
    };
    if (previous) Object.assign(previous, value);
    else data.automations.push(value);
    event(previous ? 'Automation Updated' : 'Automation Created', result);
  } else if (['toggleAutomation', 'deleteAutomation', 'run'].includes(action)) {
    const rule = data.automations.find(
      (a) => a.id === payload.id && a.workspaceId === workspaceId && !a.deleted,
    );
    assert(rule, 'Automation not found.');
    if (action === 'toggleAutomation') {
      rule.status = rule.status === 'active' ? 'paused' : 'active';
      event(`Automation ${rule.status}`, rule.id);
    } else if (action === 'deleteAutomation') {
      assert(payload.confirmed, 'Confirm deletion first.');
      rule.deleted = true;
      event('Automation Deleted', rule.id);
    } else {
      assert(rule.status === 'active', 'Paused automation cannot execute.');
      const occurrence = payload.occurrence || rule.nextDate;
      const existing = data.automationRuns.find(
        (r) =>
          r.automationId === rule.id &&
          r.scheduledDate === occurrence &&
          r.status !== 'failed',
      );
      if (existing) return { data: original, result: existing };
      assert(
        occurrence === rule.nextDate,
        'Only the configured next occurrence can execute.',
      );
      assert(
        occurrence <= data.asOf,
        'This action is scheduled for a future sample date. No background job runs.',
      );
      const run = {
        id: id(data),
        automationId: rule.id,
        workspaceId,
        name: rule.name,
        scheduledDate: occurrence,
        status: 'completed',
        actor: userId,
        timestamp: new Date().toISOString(),
      };
      try {
        if (rule.type === 'draft') {
          const template = data.recurringRules.find(
            (t) => t.id === rule.templateId && t.workspaceId === workspaceId,
          );
          assert(template, 'Template no longer available.');
          assert(
            !template.preparedDates.includes(occurrence),
            'This template occurrence was already prepared.',
          );
          const draft = {
            ...blankInvoice(
              data,
              { ...context, currency: template.currency, accountId: 'all' },
              template.clientId,
            ),
            ...template,
            number: blankInvoice(
              data,
              { ...context, currency: template.currency, accountId: 'all' },
              template.clientId,
            ).number,
            issuedDate: occurrence,
            dueDate: addDays(occurrence, Number(template.paymentTerms)),
          };
          const saved = applyIncomeCommand(data, context, 'saveInvoice', {
            draft,
          });
          data = saved.data;
          run.invoiceId = saved.result;
          run.status = 'pending-review';
          data.recurringRules
            .find((t) => t.id === template.id)
            .preparedDates.push(occurrence);
          const usedTemplate = data.recurringRules.find(
            (t) => t.id === template.id,
          );
          if (usedTemplate.nextDate === occurrence)
            usedTemplate.nextDate = nextOccurrence(occurrence, rule.frequency);
          notify(
            userId,
            'Invoice ready for review',
            'Invoice draft ready for your review.',
            `/income/invoices/${run.invoiceId}`,
          );
        } else if (rule.type === 'reminder') {
          const inv = data.invoices.find(
            (i) => i.id === rule.invoiceId && i.workspaceId === workspaceId,
          );
          assert(
            inv && !['paid', 'cancelled', 'draft'].includes(inv.status),
            'Invoice no longer needs a reminder.',
          );
          assert(
            rule.timing === 'before'
              ? occurrence < inv.dueDate
              : rule.timing === 'on'
                ? occurrence === inv.dueDate
                : occurrence > inv.dueDate,
            'Scheduled date does not match reminder timing.',
          );
          notify(
            userId,
            rule.timing === 'after' ? 'Invoice overdue' : 'Invoice due soon',
            'Invoice needs review.',
            `/income/invoices/${inv.id}`,
          );
        } else
          notify(
            userId,
            'Financial alerts',
            'Review your financial overview.',
            '/dashboard',
          );
        data.automations.find((a) => a.id === rule.id).nextDate =
          nextOccurrence(occurrence, rule.frequency);
      } catch (error) {
        run.status = 'failed';
        run.error = error.message;
      }
      data.automationRuns.push(run);
      event('Automation Simulation', rule.id);
      result = run;
    }
  } else throw new Error('Unsupported settings operation.');
  return { data, result };
}
// Notifications describe completed mock commands only and never mutate finances.
export function notifyFinancialCommand(data, context, action) {
  if (!data.memberships) return;
  const mapping = {
    recordPayment: [
      'Payment recorded',
      'Payment recorded in the demo.',
      '/income/invoices',
    ],
    confirmMatch: [
      'Payment recorded',
      'Bank match confirmed in the demo.',
      '/income/invoices',
    ],
    prepareRecurring: [
      'Invoice ready for review',
      'Invoice draft prepared for review.',
      '/income/invoices',
    ],
    'expense:confirmImport': [
      'Imported transactions',
      'Statement review confirmed.',
      '/expenses/transactions',
    ],
    'investment:recordMovement': [
      'Investment activity summary',
      'Investment activity recorded.',
      '/investments',
    ],
    'investment:valuation': [
      'Investment valuation reminder',
      'Manual valuation updated.',
      '/investments',
    ],
  };
  const event = mapping[action];
  if (!event) return;
  const pref = notificationPrefs(data, context.userId, context.workspaceId);
  if (pref.frequency === 'immediate' && pref.enabled[event[0]])
    data.notifications.push({
      id: id(data),
      workspaceId: context.workspaceId,
      recipientId: context.userId,
      type: event[0],
      title: event[1],
      target: event[2],
      read: false,
      timestamp: new Date().toISOString(),
    });
}

export function automationEntityLabel(data, automation) {
  if (automation.type === 'draft')
    return (
      data.clients.find(
        (c) =>
          c.id === automation.clientId &&
          c.workspaceId === automation.workspaceId,
      )?.name || 'Client unavailable'
    );
  if (automation.type === 'reminder')
    return (
      data.invoices.find(
        (i) =>
          i.id === automation.invoiceId &&
          i.workspaceId === automation.workspaceId,
      )?.number || 'Invoice unavailable'
    );
  return 'Workspace review';
}
