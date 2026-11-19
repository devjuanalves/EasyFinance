import { invoiceTotals } from '../../../../../../packages/shared/src/invoiceMath.js';
export {
  decimal,
  minorUnits,
  invoiceTotals,
} from '../../../../../../packages/shared/src/invoiceMath.js';
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
