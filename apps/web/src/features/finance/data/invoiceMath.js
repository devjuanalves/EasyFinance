// Decimal strings are scaled with BigInt; monetary outputs are integer cents.
export function decimal(value, places = 4) {
  const text = String(value ?? '').trim();
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`).test(text))
    throw new Error(
      `Use a non-negative number with at most ${places} decimal places.`,
    );
  const [whole, fraction = ''] = text.split('.');
  const result =
    BigInt(whole) * 10n ** BigInt(places) +
    BigInt(fraction.padEnd(places, '0'));
  if (result > 100000000000000n)
    throw new Error('Value exceeds the demo limit.');
  return result;
}
const round = (n, d) => (n + d / 2n) / d;
export function minorUnits(value) {
  return Number(decimal(value, 2));
}
export function invoiceTotals(items, discount = '0') {
  if (!items.length) throw new Error('Add at least one invoice item.');
  const lines = items.map((item, index) => {
    const qty = decimal(item.quantity),
      price = decimal(item.unitPrice),
      rate = decimal(item.taxRate || '0');
    if (qty === 0n)
      throw new Error(`Item ${index + 1}: quantity must be greater than zero.`);
    if (rate > 1000000n)
      throw new Error(`Item ${index + 1}: tax must be between 0 and 100%.`);
    return { ...item, base: round(qty * price, 1000000n), rate };
  });
  const subtotal = lines.reduce((sum, l) => sum + l.base, 0n),
    reduction = decimal(discount, 2);
  if (reduction > subtotal) throw new Error('Discount cannot exceed subtotal.');
  // Floor proportional shares, then assign residual cents from the final
  // line backwards, capped by each line's remaining base. Free/small lines
  // must never receive a discount exceeding their price.
  const cuts = lines.map((line) =>
    subtotal ? (reduction * line.base) / subtotal : 0n,
  );
  let residual = reduction - cuts.reduce((sum, cut) => sum + cut, 0n);
  for (let index = lines.length - 1; index >= 0 && residual > 0n; index--) {
    const capacity = lines[index].base - cuts[index];
    const extra = residual < capacity ? residual : capacity;
    cuts[index] += extra;
    residual -= extra;
  }
  const calculated = lines.map((line, index) => {
    const cut = cuts[index];
    const tax = round((line.base - cut) * line.rate, 1000000n);
    return {
      ...line,
      base: Number(line.base),
      rate: undefined,
      discount: Number(cut),
      tax: Number(tax),
      total: Number(line.base - cut + tax),
    };
  });
  const tax = calculated.reduce((sum, l) => sum + l.tax, 0),
    total = Number(subtotal - reduction) + tax;
  if (!Number.isSafeInteger(total) || total > 100000000000)
    throw new Error('Invoice exceeds the demo limit.');
  return {
    lines: calculated,
    subtotal: Number(subtotal),
    discount: Number(reduction),
    tax,
    total,
  };
}
export function invoicePaid(data, id) {
  return (data.allocations || [])
    .filter((a) => a.invoiceId === id)
    .reduce((sum, a) => sum + a.amount, 0);
}
export function invoiceStatus(invoice, asOf = '2026-10-31') {
  if (invoice.lifecycle === 'cancelled') return 'cancelled';
  if (invoice.lifecycle === 'draft') return 'draft';
  if (invoice.total === invoice.paid) return 'paid';
  if (invoice.dueDate < asOf) return 'overdue';
  if (invoice.paid > 0) return 'partial';
  return invoice.historicalDelivery ? 'sent' : 'prepared';
}
export const billable = (i) =>
  i.lifecycle
    ? i.lifecycle === 'issued'
    : !['draft', 'cancelled'].includes(i.status);
export function refreshInvoices(data) {
  return {
    ...data,
    invoices: data.invoices.map((i) => {
      const totals = invoiceTotals(
        data.invoiceItems.filter((item) => item.invoiceId === i.id),
        i.discount || '0',
      );
      const invoice = {
        ...i,
        ...totals,
        discount: i.discount || '0',
        discountAmount: totals.discount,
        paid: invoicePaid(data, i.id),
      };
      return { ...invoice, status: invoiceStatus(invoice, data.asOf) };
    }),
  };
}
