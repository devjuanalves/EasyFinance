import * as v from './contracts.js';
import { invoiceTotals } from '../../../../packages/shared/src/invoiceMath.js';
const terms = (value) => {
  if (typeof value !== 'string' || !/^\d{1,4}$/.test(value))
    v.fail('Use whole payment-term days.');
  return v.integer(Number(value), 0, 3650);
};
const optional = (x, max = 2000) =>
  x === '' || x == null ? '' : v.text(x, max);
const decimal = (x) => {
  if (typeof x !== 'string' || !/^\d{1,10}(\.\d{1,4})?$/.test(x))
    v.fail('Use a decimal string with up to four places.');
  return x;
};
export function clientInput(b, create = false) {
  const keys = [
    'type',
    'name',
    'businessName',
    'email',
    'phone',
    'address',
    'taxId',
    'defaultCurrency',
    'paymentTerms',
    'notes',
  ];
  v.shape(
    b,
    [...keys, ...(create ? ['id'] : [])],
    [
      'type',
      'name',
      'defaultCurrency',
      'paymentTerms',
      ...(create ? ['id'] : []),
    ],
  );
  const type = v.choice(b.type, ['individual', 'business']);
  return {
    ...(create ? { id: v.id(b.id) } : {}),
    type,
    name: v.text(b.name, 200),
    businessName:
      type === 'business'
        ? v.text(b.businessName, 200)
        : optional(b.businessName, 200),
    email: b.email ? v.email(b.email) : '',
    phone: optional(b.phone, 100),
    addressJson: { text: optional(b.address) },
    taxId: optional(b.taxId, 100),
    defaultCurrency: v.currency(b.defaultCurrency),
    paymentTermsDays: terms(b.paymentTerms),
    notes: optional(b.notes),
  };
}
export function draftInput(b, create = true) {
  const keys = [
    'number',
    'clientId',
    'accountId',
    'currency',
    'issuedDate',
    'dueDate',
    'paymentTerms',
    'items',
    'discount',
    'notes',
    'paymentInstructions',
  ];
  v.shape(
    b,
    [...keys, create ? 'id' : 'version'],
    [
      ...keys.filter((k) => !['notes', 'paymentInstructions'].includes(k)),
      create ? 'id' : 'version',
    ],
  );
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 100)
    v.fail('Use 1–100 invoice items.');
  const items = b.items.map((i) => {
    v.shape(
      i,
      ['description', 'quantity', 'unit', 'unitPrice', 'taxRate'],
      ['description', 'quantity', 'unitPrice', 'taxRate'],
    );
    return {
      description: v.text(i.description, 500),
      quantity: decimal(i.quantity),
      unit: optional(i.unit, 50),
      unitPrice: decimal(i.unitPrice),
      taxRate: decimal(i.taxRate),
    };
  });
  if (
    typeof b.discount !== 'string' ||
    !/^\d{1,10}(\.\d{1,2})?$/.test(b.discount)
  )
    v.fail('Invalid discount.');
  let totals;
  try {
    totals = invoiceTotals(items, b.discount);
  } catch (e) {
    v.fail(e.message);
  }
  const issueDate = v.date(b.issuedDate),
    dueDate = v.date(b.dueDate);
  if (dueDate < issueDate) v.fail('Due date precedes issue date.');
  return {
    ...(create
      ? { id: v.id(b.id) }
      : { version: v.integer(b.version, 1, 2147483646) }),
    invoiceNumber: v.text(b.number, 100),
    clientId: v.id(b.clientId),
    accountId: v.id(b.accountId),
    currency: v.currency(b.currency),
    issueDate,
    dueDate,
    paymentTermsDays: terms(b.paymentTerms),
    notes: optional(b.notes),
    paymentInstructions: optional(b.paymentInstructions),
    items,
    totals,
  };
}
export function paymentInput(b) {
  v.shape(
    b,
    [
      'idempotencyKey',
      'amountMinor',
      'date',
      'method',
      'reference',
      'transactionId',
    ],
    ['idempotencyKey', 'amountMinor', 'date', 'method'],
  );
  return {
    idempotencyKey: v.id(b.idempotencyKey),
    amountMinor: v.amount(b.amountMinor, 'income'),
    paidAt: v.date(b.date),
    method: v.text(b.method, 100),
    reference: optional(b.reference, 200),
    transactionId: b.transactionId ? v.id(b.transactionId) : null,
  };
}
export function invoiceFilters(q, summary = false) {
  v.shape(
    q,
    [
      'currency',
      'accountId',
      'clientId',
      'start',
      'end',
      ...(!summary ? ['search', 'status', 'page', 'limit'] : []),
    ],
    ['currency'],
  );
  const where = { currency: v.currency(q.currency) };
  for (const k of ['accountId', 'clientId']) if (q[k]) where[k] = v.id(q[k]);
  if (q.start || q.end)
    where.issueDate = {
      ...(q.start ? { gte: v.date(q.start) } : {}),
      ...(q.end ? { lte: v.date(q.end) } : {}),
    };
  if (q.start && q.end && q.start > q.end) v.fail('Invalid date range.');
  if (q.search)
    where.OR = [
      {
        invoiceNumber: { contains: v.text(q.search, 100), mode: 'insensitive' },
      },
      {
        client: {
          name: { contains: v.text(q.search, 100), mode: 'insensitive' },
        },
      },
    ];
  return {
    where,
    status: q.status
      ? v.choice(q.status, [
          'draft',
          'issued',
          'partial',
          'paid',
          'overdue',
          'cancelled',
        ])
      : null,
    page: q.page ? v.integer(Number(q.page), 1, 100000) : 1,
    limit: q.limit ? v.integer(Number(q.limit), 1, 100) : 10,
  };
}
