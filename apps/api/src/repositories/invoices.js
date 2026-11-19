import { missing } from './access.js';
export const invoiceInclude = {
  InvoiceItem_invoice: { orderBy: { position: 'asc' } },
  PaymentAllocation_invoice: { include: { payment: true } },
};
export async function invoiceById(tx, workspaceId, id) {
  const r = await tx.invoice.findFirst({
    where: { workspaceId, id },
    include: invoiceInclude,
  });
  if (!r) throw missing();
  return r;
}
export const day = (d) => d.toISOString().slice(0, 10);
export function invoiceDto(r) {
  const paid = r.PaymentAllocation_invoice.reduce(
      (n, a) => n + a.amountMinor,
      0n,
    ),
    outstanding = r.lifecycle === 'issued' ? r.totalMinor - paid : 0n;
  const status =
    r.lifecycle !== 'issued'
      ? r.lifecycle
      : paid === r.totalMinor
        ? 'paid'
        : day(r.dueDate) < day(new Date())
          ? 'overdue'
          : paid > 0n
            ? 'partial'
            : 'issued';
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    number: r.invoiceNumber,
    clientId: r.clientId,
    accountId: r.accountId,
    currency: r.currency,
    issuedDate: day(r.issueDate),
    dueDate: day(r.dueDate),
    lifecycle: r.lifecycle,
    status,
    version: r.version,
    client: r.clientSnapshot,
    paymentTerms: String(r.paymentTermsDays),
    notes: r.notes || '',
    paymentInstructions: r.paymentInstructions || '',
    subtotalMinor: String(r.subtotalMinor),
    discountMinor: String(r.discountMinor),
    taxMinor: String(r.taxMinor),
    totalMinor: String(r.totalMinor),
    paidMinor: String(paid),
    outstandingMinor: String(outstanding),
    items: r.InvoiceItem_invoice.map((i) => ({
      description: i.description,
      quantity: String(i.quantity),
      unit: i.unit || '',
      unitPrice: String(i.unitPrice),
      taxRate: String(i.taxRate),
    })),
    payments: r.PaymentAllocation_invoice.map((a) => ({
      id: a.payment.id,
      allocationId: a.id,
      amountMinor: String(a.amountMinor),
      receiptMinor: String(a.payment.amountMinor),
      date: day(a.payment.paidAt),
      method: a.payment.method,
      reference: a.payment.reference,
      transactionId: a.payment.transactionId,
    })),
  };
}
export const clientDto = (c) => ({
  id: c.id,
  type: c.type,
  name: c.name,
  businessName: c.businessName || '',
  email: c.email || '',
  phone: c.phone || '',
  address: c.addressJson?.text || '',
  taxId: c.taxId || '',
  defaultCurrency: c.defaultCurrency,
  paymentTerms: String(c.paymentTermsDays),
  notes: c.notes || '',
  archived: !!c.archivedAt,
});
export function event(tx, a, w, id, action, metadataJson = {}) {
  return tx.activityLog.create({
    data: {
      workspaceId: w,
      actorUserId: a.userId,
      entityType: 'invoice',
      entityId: id,
      action,
      metadataJson,
    },
  });
}
