import { shape, id, text, integer, fail } from './contracts.js';
export const investmentActions = [
  'createAccount',
  'create',
  'update',
  'recordMovement',
  'editMovement',
  'deleteMovement',
  'valuation',
  'deleteValuation',
];
const fields = {
  createAccount: ['name', 'institution', 'currency'],
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
export function investmentInput(b) {
  shape(
    b,
    ['key', 'action', 'payload', 'version'],
    ['key', 'action', 'payload'],
  );
  id(b.key);
  if (!investmentActions.includes(b.action))
    fail('Unsupported investment operation.');
  const a = b.action,
    p = b.payload;
  if (a === 'createAccount') shape(p, fields[a]);
  else {
    const keys =
      a === 'create'
        ? ['form']
        : a === 'update' || a === 'recordMovement' || a === 'valuation'
          ? ['id', 'form']
          : a === 'editMovement'
            ? ['id', 'movementId', 'form', 'confirmed']
            : a === 'deleteMovement'
              ? ['id', 'movementId', 'confirmed']
              : ['id', 'valuationId', 'confirmed'];
    shape(p, keys);
    if (a !== 'create') {
      id(p.id);
      integer(b.version, 1, 2147483646);
    }
    if (p.movementId) id(p.movementId);
    if (p.valuationId) id(p.valuationId);
    if (keys.includes('confirmed') && p.confirmed !== true)
      fail('Confirm the correction.');
    if (p.form)
      shape(
        p.form,
        fields[a],
        a === 'update'
          ? ['name', 'assetType', 'investmentAccountId', 'currency']
          : [],
      );
  }
  const form = a === 'createAccount' ? p : p.form;
  if (form)
    for (const [key, value] of Object.entries(form)) {
      if (
        typeof value !== 'string' ||
        value.length > (['notes', 'interestInfo'].includes(key) ? 2000 : 200) ||
        [...value].some(
          (c) => c.charCodeAt(0) < 32 && !['\n', '\r', '\t'].includes(c),
        )
      )
        fail('Invalid investment field.');
      if (key === 'investmentAccountId') id(value);
      if (
        ['quantity', 'unitPrice'].includes(key) &&
        value !== '' &&
        !/^\d{1,10}(\.\d{1,8})?$/.test(value)
      )
        fail('Use up to ten integer and eight fractional digits.');
    }
  if (form?.name !== undefined) text(form.name);
  return b;
}
