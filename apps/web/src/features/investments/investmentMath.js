import { validDate } from '../finance/data/dates.js';
export const ASSET_TYPES = [
  'Stocks',
  'ETFs',
  'Fixed Income',
  'Cryptocurrency',
  'Other',
  'Custom',
];
export const CURRENCIES = ['AUD', 'EUR', 'USD'];
export const SCALE = 100000000n;
const MAX = 10000000000000n;
export const requireValue = (ok, message) => {
  if (!ok) throw new Error(message);
};
export function decimal(value, digits = 8, label = 'Value') {
  const s = String(value ?? '').trim();
  requireValue(
    new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`).test(s),
    `${label} must be non-negative with at most ${digits} decimal places.`,
  );
  const [whole, fraction = ''] = s.split('.');
  const n =
    BigInt(whole) * 10n ** BigInt(digits) +
    BigInt(fraction.padEnd(digits, '0'));
  requireValue(
    n <= MAX * 10n ** BigInt(digits),
    `${label} exceeds the demo limit.`,
  );
  return n;
}
export function safeCents(n) {
  requireValue(n >= 0n && n <= MAX, 'Amount exceeds the demo limit.');
  return Number(n);
}
export const roundRatio = (n, d) => (n + d / 2n) / d;
export const cents = (value, label = 'Amount') =>
  safeCents(decimal(value, 2, label));
export function decimalText(n, digits = 8) {
  const scale = 10n ** BigInt(digits);
  return (
    `${n / scale}.${(n % scale).toString().padStart(digits, '0')}`.replace(
      /\.?0+$/,
      '',
    ) || '0'
  );
}
export const quantityBased = (asset) =>
  ['Stocks', 'ETFs', 'Cryptocurrency'].includes(asset.assetType);
export const capitalMovement = (m) =>
  ['buy', 'sell', 'contribution', 'withdrawal'].includes(m.type);
export const movementsFor = (data, id, date = data.asOf) =>
  (data.investmentMovements || [])
    .filter((m) => m.investmentId === id && !m.deleted && m.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
export const capitalSignature = (data, id, date) =>
  movementsFor(data, id, date)
    .filter(capitalMovement)
    .map((m) => `${m.id}:${m.revision}`)
    .join('|');
export function initialAmounts(form) {
  const fee = cents(form.fee, 'Fee');
  let amount;
  if (quantityBased(form)) {
    const quantity = decimal(form.quantity, 8, 'Quantity'),
      price = decimal(form.unitPrice, 8, 'Unit price');
    requireValue(quantity > 0n, 'Quantity must be greater than zero.');
    amount = safeCents(roundRatio(quantity * price, 100000000000000n));
  } else amount = cents(form.amount, 'Principal amount');
  requireValue(
    quantityBased(form) || amount > 0,
    'Principal must be greater than zero.',
  );
  return { amount, fee, costBasis: safeCents(BigInt(amount) + BigInt(fee)) };
}
export function positionAt(data, investment, date = data.asOf) {
  let quantity = 0n,
    basis = 0,
    realized = 0,
    distributions = 0,
    standaloneFees = 0,
    contributions = 0;
  const history = [];
  for (const m of movementsFor(data, investment.id, date)) {
    if (m.type === 'buy' || m.type === 'contribution') {
      if (quantityBased(investment)) quantity += decimal(m.quantity);
      basis = safeCents(BigInt(basis) + BigInt(m.amount) + BigInt(m.fee));
      contributions += m.amount;
    } else if (m.type === 'sell' || m.type === 'withdrawal') {
      let disposed;
      if (quantityBased(investment)) {
        const units = decimal(m.quantity);
        requireValue(
          units > 0n && units <= quantity,
          'Movement exceeds the available quantity on its date.',
        );
        disposed =
          units === quantity
            ? basis
            : Number(roundRatio(BigInt(basis) * units, quantity));
        quantity -= units;
      } else {
        requireValue(
          m.amount <= basis,
          'Withdrawal exceeds the available principal on its date.',
        );
        disposed = m.amount;
      }
      basis -= disposed;
      if (m.type === 'sell') realized += m.amount - m.fee - disposed;
      else standaloneFees += m.fee;
    } else if (m.type === 'dividend' || m.type === 'interest') {
      distributions += m.amount - m.fee;
    } else if (m.type === 'fee') standaloneFees += m.amount;
    history.push({
      ...m,
      remainingBasis: basis,
      remainingQuantity: decimalText(quantity),
      realizedToDate: realized,
    });
  }
  const valuations = (data.investmentValuations || [])
    .filter(
      (v) =>
        v.investmentId === investment.id && !v.deleted && v.valuedAt <= date,
    )
    .sort((a, b) => a.valuedAt.localeCompare(b.valuedAt) || a.order - b.order);
  const valuation = valuations.at(-1);
  const closed =
    history.some(capitalMovement) &&
    (quantityBased(investment) ? quantity === 0n : basis === 0);
  const comparable =
    valuation &&
    valuation.capitalSignature === capitalSignature(data, investment.id, date);
  const currentValue = closed
    ? 0
    : comparable
      ? valuation.estimatedValue
      : null;
  const unrealized = currentValue === null ? null : currentValue - basis;
  return {
    quantity: decimalText(quantity),
    basis,
    realized,
    distributions,
    standaloneFees,
    contributions,
    history,
    valuation,
    currentValue,
    unrealized,
    closed,
    valuationStale: !!valuation && !comparable && !closed,
    averageCost: quantity
      ? decimalText(roundRatio(BigInt(basis) * SCALE * SCALE, quantity * 100n))
      : null,
    percent:
      unrealized !== null && basis > 0 ? (unrealized / basis) * 100 : null,
    totalReturn:
      unrealized === null
        ? null
        : unrealized + realized + distributions - standaloneFees,
  };
}
export function portfolio(data, filters, options = {}) {
  const end = options.end || data.asOf,
    start = options.start || data.coverageStart;
  const holdings = (data.investments || [])
    .filter(
      (i) =>
        i.workspaceId === filters.workspaceId &&
        !i.archived &&
        i.openedAt <= end &&
        (filters.currency === 'all' || i.currency === filters.currency) &&
        (!options.accountId ||
          options.accountId === 'all' ||
          i.investmentAccountId === options.accountId) &&
        (!options.assetType ||
          options.assetType === 'all' ||
          i.assetType === options.assetType),
    )
    .map((i) => ({
      ...i,
      position: positionAt(data, i, end),
      account: data.investmentAccounts.find(
        (a) => a.id === i.investmentAccountId,
      ),
    }));
  const mixed =
    filters.currency === 'all' ||
    new Set(holdings.map((i) => i.currency)).size > 1;
  const sum = (key) => holdings.reduce((n, i) => n + i.position[key], 0);
  const currentValue =
    mixed || holdings.some((i) => i.position.currentValue === null)
      ? null
      : sum('currentValue');
  const basis = mixed ? null : sum('basis');
  const activity = holdings
    .flatMap((i) => [
      ...i.position.history.map((m) => ({
        ...m,
        investment: i,
        activityDate: m.date,
      })),
      ...(data.investmentValuations || [])
        .filter(
          (v) => v.investmentId === i.id && !v.deleted && v.valuedAt <= end,
        )
        .map((v) => ({
          ...v,
          investment: i,
          type: 'valuation',
          amount: v.estimatedValue,
          activityDate: v.valuedAt,
        })),
    ])
    .filter((m) => m.activityDate >= start)
    .sort(
      (a, b) =>
        b.activityDate.localeCompare(a.activityDate) || b.order - a.order,
    );
  const allocation =
    currentValue > 0
      ? ASSET_TYPES.map((type) => ({
          type,
          value: holdings
            .filter((i) => i.assetType === type)
            .reduce((n, i) => n + i.position.currentValue, 0),
        })).filter((a) => a.value > 0)
      : [];
  return {
    holdings,
    mixed,
    currentValue,
    basis,
    unrealized: currentValue === null ? null : currentValue - basis,
    allocation,
    activity,
    contributions: mixed
      ? null
      : activity
          .filter((m) => ['buy', 'contribution'].includes(m.type))
          .reduce((n, m) => n + m.amount, 0),
    valuationDates: [
      ...new Set(
        holdings.map((i) => i.position.valuation?.valuedAt).filter(Boolean),
      ),
    ].sort(),
    missing: holdings.filter((i) => i.position.currentValue === null).length,
    stale: holdings.filter(
      (i) =>
        !i.position.closed &&
        (!i.position.valuation ||
          Date.parse(end) - Date.parse(i.position.valuation.valuedAt) >
            30 * 86400000),
    ).length,
  };
}
export function portfolioHistory(data, filters, options = {}) {
  const selection = portfolio(data, filters, options);
  const dates = [
    ...new Set(selection.activity.map((a) => a.activityDate)),
  ].sort();
  return dates.map((date) => {
    const p = portfolio(data, filters, { ...options, end: date });
    return { date, value: p.currentValue, basis: p.basis };
  });
}
export function investmentDate(value, data, openedAt = data.coverageStart) {
  requireValue(
    validDate(value) && value >= openedAt && value <= data.asOf,
    `Date must be between ${openedAt} and ${data.asOf} (sample accounting date).`,
  );
  return value;
}
