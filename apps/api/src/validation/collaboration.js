import { EVENTS } from '../../../../packages/shared/src/notificationEvents.js';
import {
  shape,
  text,
  choice,
  currency,
  integer,
  date,
  id,
  fail,
} from './contracts.js';
export function zone(v) {
  const value = text(v, 80);
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
  } catch {
    fail('Invalid time zone.');
  }
  return value;
}
export function profileInput(b) {
  shape(b, ['fullName', 'preferences']);
  const p = b.preferences;
  shape(p, [
    'language',
    'currency',
    'dateFormat',
    'numberFormat',
    'timeZone',
    'monthStart',
  ]);
  return {
    fullName: text(b.fullName, 120),
    preferences: {
      language: choice(p.language, ['en', 'en-AU', 'en-US', 'pt-BR']),
      currency: choice(p.currency, [
        'AUD',
        'USD',
        'EUR',
        'GBP',
        'BRL',
        'NZD',
        'CAD',
      ]),
      dateFormat: choice(p.dateFormat, [
        'DD/MM/YYYY',
        'MM/DD/YYYY',
        'YYYY-MM-DD',
      ]),
      numberFormat: choice(p.numberFormat, ['1,234.56', '1.234,56']),
      timeZone: zone(p.timeZone),
      monthStart: integer(p.monthStart, 1, 28),
    },
  };
}
export function workspaceInput(b) {
  shape(b, ['name', 'type', 'baseCurrency', 'timeZone']);
  return {
    name: text(b.name, 120),
    kind: choice(b.type, ['personal', 'shared', 'business']),
    baseCurrency: currency(b.baseCurrency),
    timezone: zone(b.timeZone),
  };
}
export function automationInput(b, edit) {
  shape(
    b,
    [
      'name',
      'type',
      'frequency',
      'nextDate',
      'timeZone',
      'status',
      'invoiceId',
      'timing',
      edit ? 'updatedAt' : 'id',
    ],
    [
      'name',
      'type',
      'frequency',
      'nextDate',
      'timeZone',
      'status',
      edit ? 'updatedAt' : 'id',
    ],
  );
  const type = choice(b.type, ['alert', 'reminder']);
  if (type === 'alert' && (b.invoiceId || b.timing))
    fail('Financial alerts cannot target invoices.');
  const configJson = {
    nextDate: date(b.nextDate).toISOString().slice(0, 10),
    ...(type === 'reminder'
      ? {
          invoiceId: id(b.invoiceId),
          timing: choice(b.timing, ['before', 'on', 'after']),
        }
      : {}),
  };
  if (
    edit &&
    (typeof b.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(b.updatedAt)))
  )
    fail('Invalid version.');
  return {
    name: text(b.name, 120),
    type,
    frequency: choice(b.frequency, ['weekly', 'fortnightly', 'monthly']),
    timezone: zone(b.timeZone),
    status: choice(b.status, [
      'active',
      'paused',
      ...(edit ? ['archived'] : []),
    ]),
    configJson,
    ...(edit ? { updatedAt: b.updatedAt } : { id: id(b.id) }),
  };
}

export function notificationInput(b) {
  shape(b, ['enabled', 'frequency', 'time', 'timeZone']);
  shape(b.enabled, Object.values(EVENTS).flat());
  if (Object.values(b.enabled).some((v) => typeof v !== 'boolean')) fail();
  if (typeof b.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time))
    fail('Invalid notification time.');
  return {
    enabled: b.enabled,
    frequency: choice(b.frequency, ['immediate', 'daily', 'weekly']),
    time: b.time,
    timeZone: zone(b.timeZone),
  };
}
