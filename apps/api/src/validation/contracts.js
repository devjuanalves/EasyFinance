export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const fail = (message = 'Invalid request.') => {
  throw new ApiError(400, 'VALIDATION', message);
};
export function shape(value, keys, required = keys) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k)) ||
    required.some((k) => value[k] === undefined)
  )
    fail();
  return value;
}
export function text(value, max = 200) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    [...value].some((c) => c.charCodeAt(0) < 32)
  )
    fail();
  return value.trim();
}
export function id(value) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    fail('Invalid identifier.');
  return value;
}
export function email(value) {
  const v = text(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail('Enter a valid email.');
  return v;
}
export function password(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128)
    fail('Use a password of 12–128 characters.');
  return value;
}
export function choice(value, allowed) {
  if (!allowed.includes(value)) fail();
  return value;
}
export function currency(value) {
  return choice(value, ['AUD', 'EUR', 'USD']);
}
export function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail('Invalid date.');
  const d = new Date(value + 'T00:00:00Z');
  if (
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== value ||
    value < '1900-01-01' ||
    value > '9999-12-31'
  )
    fail('Invalid date.');
  return d;
}
export function integer(value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) fail();
  return value;
}
export function amount(value, type) {
  if (typeof value !== 'string' || !/^-?(0|[1-9]\d{0,15})$/.test(value))
    fail('Use integer minor units as a decimal string.');
  const n = BigInt(value);
  if (
    n === 0n ||
    n > 9007199254740991n ||
    n < -9007199254740991n ||
    (type === 'expense' && n >= 0n) ||
    (type === 'income' && n <= 0n)
  )
    fail('Invalid signed amount.');
  return n;
}
export function transactionInput(body, create) {
  const keys = [
    'date',
    'description',
    'type',
    'amountMinor',
    'categoryId',
    ...(create ? ['id', 'accountId', 'currency'] : ['version']),
  ];
  shape(
    body,
    keys,
    keys.filter((k) => k !== 'categoryId'),
  );
  const type = choice(body.type, ['income', 'expense']);
  return {
    bookingDate: date(body.date),
    description: text(body.description, 500),
    type,
    amountMinor: amount(body.amountMinor, type),
    categoryId:
      body.categoryId == null || body.categoryId === ''
        ? null
        : id(body.categoryId),
    ...(create
      ? {
          id: id(body.id),
          accountId: id(body.accountId),
          currency: currency(body.currency),
        }
      : { version: integer(body.version, 1, 2147483646) }),
  };
}
export function filters(query, summary = false) {
  shape(
    query,
    [
      'currency',
      'accountId',
      'start',
      'end',
      'search',
      ...(!summary ? ['page', 'limit', 'sort'] : []),
    ],
    ['currency'],
  );
  const result = { currency: currency(query.currency) };
  if (query.accountId) result.accountId = id(query.accountId);
  if (query.start || query.end)
    result.bookingDate = {
      ...(query.start ? { gte: date(query.start) } : {}),
      ...(query.end ? { lte: date(query.end) } : {}),
    };
  if (query.start && query.end && query.start > query.end)
    fail('Invalid date range.');
  if (query.search)
    result.description = {
      contains: text(query.search, 100),
      mode: 'insensitive',
    };
  const number = (v, d, max) =>
    v === undefined
      ? d
      : typeof v === 'string' && /^[1-9]\d*$/.test(v)
        ? integer(Number(v), 1, max)
        : fail();
  return {
    where: result,
    page: number(query.page, 1, 100000),
    limit: number(query.limit, 25, 100),
    sort:
      query.sort === undefined
        ? 'desc'
        : choice(query.sort, ['date_asc', 'date_desc']) === 'date_asc'
          ? 'asc'
          : 'desc',
  };
}
