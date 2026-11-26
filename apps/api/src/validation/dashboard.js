import { shape, currency, date, id, text, choice, fail } from './contracts.js';
export function dashboardFilters(q) {
  shape(
    q,
    ['currency', 'start', 'end', 'accountId', 'categoryId'],
    ['currency', 'start', 'end'],
  );
  const start = date(q.start),
    end = date(q.end);
  if (end < start || (end - start) / 86400000 > 365)
    fail('Select a range of at most 366 days.');
  if (end.toISOString().slice(0, 10) > new Date().toISOString().slice(0, 10))
    fail('Future reporting dates are unavailable.');
  return {
    currency: currency(q.currency),
    start,
    end,
    accountId: q.accountId ? id(q.accountId) : null,
    categoryId: q.categoryId ? id(q.categoryId) : null,
  };
}
const icons = [
  'expenses',
  'income',
  'home',
  'dashboard',
  'investments',
  'settings',
];
export function categoryInput(b, create = false, archive = false) {
  shape(
    b,
    archive
      ? ['updatedAt']
      : ['name', 'icon', 'color', ...(create ? ['id', 'kind'] : ['updatedAt'])],
  );
  const result = archive
    ? {}
    : {
        name: text(b.name, 100),
        icon: choice(b.icon, icons),
        color: text(b.color, 7),
      };
  if (!archive && !/^#[a-fA-F0-9]{6}$/.test(result.color))
    fail('Choose a six-digit hex color.');
  if (create)
    return {
      ...result,
      id: id(b.id),
      kind: choice(b.kind, ['income', 'expense']),
    };
  if (
    typeof b.updatedAt !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(b.updatedAt) ||
    !Number.isFinite(Date.parse(b.updatedAt))
  )
    fail('Reload the category before editing.');
  return { ...result, updatedAt: b.updatedAt };
}
