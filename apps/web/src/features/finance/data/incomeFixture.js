import { refreshInvoices } from './invoiceMath.js';
export function extendIncomeFixture(base) {
  const clients = [
    {
      id: 'acme',
      name: 'Acme Studio',
      businessName: 'Acme Studio Pty Ltd',
      email: 'billing@acme.example',
      type: 'business',
    },
    {
      id: 'north',
      name: 'North Design',
      businessName: 'North Design Studio',
      email: 'accounts@north.example',
      type: 'business',
    },
    {
      id: 'employer',
      name: 'Alex’s employer',
      businessName: 'Sample Employment Ltd',
      email: 'payroll@employer.example',
      type: 'business',
    },
    {
      id: 'euro-client',
      name: 'Euro freelance client',
      businessName: '',
      email: 'client@euro.example',
      type: 'individual',
      defaultCurrency: 'EUR',
    },
  ].map((c) => ({
    workspaceId: 'personal',
    defaultCurrency: 'AUD',
    paymentTerms: '14',
    phone: '',
    address: 'Sample billing address',
    taxId: '',
    notes: 'Fictional client',
    archived: false,
    ...c,
  }));
  const extra = [
    ['inv4', 'acme', 'draft', '950.00'],
    ['inv5', 'north', 'cancelled', '800.00'],
    ['inv6', 'north', 'draft', '250.00'],
    ['inv7', 'acme', 'draft', '150.00'],
  ].map(([id, clientId, lifecycle, price]) => ({
    id,
    clientId,
    lifecycle,
    price,
    workspaceId: 'personal',
    accountId: 'reserve',
    participantId: 'alex',
    currency: 'AUD',
    issuedDate: '2026-10-24',
    dueDate: '2026-11-07',
  }));
  const invoices = [
    ...base.invoices.map((i) => ({
      ...i,
      lifecycle: 'issued',
      historicalDelivery: true,
      price: (i.total / 100).toFixed(2),
    })),
    ...extra,
  ].map((i, index) => ({
    ...i,
    number: `INV-2026-${String(index + 1).padStart(3, '0')}`,
    discount: '0',
    notes: 'Thank you for your business.',
    paymentInstructions:
      'Use the invoice number as the payment reference. Demo only.',
    paymentTerms: '14',
    clientSnapshot: { ...clients.find((c) => c.id === i.clientId) },
  }));
  const invoiceItems = invoices.map((i) => ({
    id: `item-${i.id}`,
    invoiceId: i.id,
    description:
      i.id === 'inv1'
        ? 'Monthly design retainer'
        : i.id === 'inv2'
          ? 'Brand identity project'
          : 'Design services',
    quantity: '1',
    unit: 'project',
    unitPrice: i.price,
    taxRate: '0',
  }));
  const source = {
    s1: 'employer',
    s2: 'acme',
    o1: 'employer',
    o2: 'acme',
    o3: 'north',
    e1: 'euro-client',
  };
  const transactions = base.transactions.map((t) => ({
    ...t,
    ...(source[t.id] ? { clientId: source[t.id] } : {}),
  }));
  const payments = transactions
    .filter((t) => t.type === 'income')
    .map((t) => ({
      id: `pay-${t.id}`,
      workspaceId: t.workspaceId,
      transactionId: t.id,
      amount: t.amount,
      currency: t.currency,
      date: t.date,
      accountId: t.accountId,
      clientId: t.clientId,
      method: 'bank',
      reference: t.description,
      status: 'confirmed',
    }));
  const allocations = [
    {
      id: 'allocation-1',
      paymentId: 'pay-o2',
      invoiceId: 'inv1',
      amount: 185000,
    },
    {
      id: 'allocation-2',
      paymentId: 'pay-o3',
      invoiceId: 'inv3',
      amount: 50000,
    },
  ];
  const deliveries = invoices
    .filter((i) => i.historicalDelivery)
    .map((i) => ({
      id: `delivery-${i.id}`,
      invoiceId: i.id,
      recipient: clients.find((c) => c.id === i.clientId).email,
      status: 'historical-mock',
      date: i.issuedDate,
    }));
  const events = invoices.flatMap((i) => [
    {
      id: `created-${i.id}`,
      invoiceId: i.id,
      date: i.issuedDate,
      text: 'Invoice created (sample history)',
    },
    ...(i.historicalDelivery
      ? [
          {
            id: `sent-${i.id}`,
            invoiceId: i.id,
            date: i.issuedDate,
            text: 'Historical mock delivery — no real email',
          },
        ]
      : []),
  ]);
  for (const a of allocations) {
    const p = payments.find((p) => p.id === a.paymentId);
    events.push({
      id: `event-${a.id}`,
      invoiceId: a.invoiceId,
      date: p.date,
      text: 'Payment allocated (sample history)',
    });
  }
  return refreshInvoices({
    ...base,
    asOf: '2026-10-31',
    clients,
    invoices,
    invoiceItems,
    transactions,
    payments,
    allocations,
    deliveries,
    events,
    recurringRules: [],
    bankMatches: [
      {
        id: 'match-1',
        workspaceId: 'personal',
        invoiceId: 'inv2',
        transactionId: 's2',
        amount: 200000,
        status: 'pending',
        reason:
          'Same sample client and currency. Earlier receipt; review date and reference before allocating.',
      },
    ],
  });
}
