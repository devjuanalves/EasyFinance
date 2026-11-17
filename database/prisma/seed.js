import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { disposableClient } from '../scripts/client.js';
export const seedId = (n) =>
  `eaf10000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export async function seedDemo(db) {
  const date = new Date('2026-10-01T00:00:00Z');
  const workspaceId = seedId(2),
    userId = seedId(1),
    currency = 'AUD';
  await db.$transaction(async (tx) => {
    const put = (model, n, data) =>
      tx[model].upsert({
        where: { id: seedId(n) },
        create: { id: seedId(n), ...data },
        update: {},
      });
    await put('user', 1, {
      fullName: 'Database Demo User',
      email: 'database-demo@example.test',
      status: 'disabled',
    });
    await put('workspace', 2, {
      ownerUserId: userId,
      name: 'Disposable database demonstration',
      baseCurrency: currency,
    });
    await put('workspaceMember', 3, { workspaceId, userId, role: 'owner' });
    await put('financialAccount', 4, {
      workspaceId,
      currency,
      name: 'Demo Checking',
      openingDate: date,
      openingBalanceMinor: 100000n,
    });
    await put('category', 5, {
      workspaceId,
      name: 'Demo Groceries',
      kind: 'expense',
    });
    await put('client', 6, {
      workspaceId,
      type: 'business',
      name: 'Demo Client',
      businessName: 'Fictional Studio',
      email: 'client@example.test',
      defaultCurrency: currency,
    });
    await put('invoiceTemplate', 7, {
      workspaceId,
      currency,
      clientId: seedId(6),
      title: 'Demo services',
      defaultItemsJson: [
        {
          description: 'Service',
          quantity: '1',
          unitPrice: '100',
          taxRate: '0',
        },
      ],
    });
    await put('invoice', 8, {
      workspaceId,
      currency,
      accountId: seedId(4),
      clientId: seedId(6),
      createdById: userId,
      invoiceNumber: 'SEED-001',
      issueDate: date,
      dueDate: new Date('2026-10-15T00:00:00Z'),
      lifecycle: 'issued',
      issuedAt: date,
      subtotalMinor: 10000n,
      totalMinor: 10000n,
      clientSnapshot: { name: 'Demo Client', email: 'client@example.test' },
    });
    await put('invoiceItem', 9, {
      workspaceId,
      invoiceId: seedId(8),
      position: 0,
      description: 'Fictional service',
      quantity: '1.0000',
      unitPrice: '100.0000',
      baseMinor: 10000n,
      lineTotalMinor: 10000n,
    });
    await put('transaction', 10, {
      workspaceId,
      currency,
      accountId: seedId(4),
      createdById: userId,
      bookingDate: date,
      originalDate: date,
      description: 'Demo partial receipt',
      originalDescription: 'Demo partial receipt',
      amountMinor: 2500n,
      originalAmountMinor: 2500n,
      type: 'income',
      source: 'payment',
      reviewStatus: 'reviewed',
    });
    await put('payment', 11, {
      workspaceId,
      currency,
      transactionId: seedId(10),
      createdById: userId,
      paidAt: date,
      amountMinor: 2500n,
      method: 'bank',
      idempotencyKey: 'seed-payment-001',
    });
    await put('paymentAllocation', 12, {
      workspaceId,
      currency,
      paymentId: seedId(11),
      invoiceId: seedId(8),
      amountMinor: 2500n,
    });
    await put('investmentAccount', 13, {
      workspaceId,
      currency,
      name: 'Manual Demo Portfolio',
    });
    await put('investment', 14, {
      workspaceId,
      currency,
      investmentAccountId: seedId(13),
      name: 'Fictional ETF',
      assetType: 'ETFs',
      openedAt: date,
    });
    await put('investmentMovement', 15, {
      workspaceId,
      currency,
      investmentId: seedId(14),
      createdById: userId,
      date,
      type: 'buy',
      sequence: 1,
      quantity: '1.12345678',
      unitPrice: '100.00000000',
      amountMinor: 11235n,
    });
    await put('investmentValuation', 16, {
      workspaceId,
      currency,
      investmentId: seedId(14),
      createdById: userId,
      valuedAt: date,
      estimatedValueMinor: 12000n,
      positionSignature: 'seed-movement-15-v1',
    });
    await put('automationRule', 17, {
      workspaceId,
      createdById: userId,
      type: 'financial-review',
      name: 'Manual demo review',
      configJson: {},
      timezone: 'Australia/Sydney',
      status: 'paused',
    });
    await put('notification', 18, {
      workspaceId,
      recipientUserId: userId,
      type: 'demo',
      title: 'Fictional database seed',
      body: 'No email or external operation was performed.',
    });
    await put('notificationPreference', 19, {
      workspaceId,
      userId,
      eventType: 'demo',
      channel: 'in_app',
    });
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const db = disposableClient();
  try {
    await seedDemo(db);
    console.log('Fictional seed completed. No login credentials were created.');
  } finally {
    await db.$disconnect();
  }
}
