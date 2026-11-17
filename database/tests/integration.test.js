import 'dotenv/config';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { disposableClient } from '../scripts/client.js';
import { seedDemo, seedId } from '../prisma/seed.js';
// Fail explicitly without a designated database; never report skipped DB tests as passing.
const db = disposableClient();
const wid = seedId(2),
  uid = seedId(1),
  currency = 'AUD';
const date = new Date('2026-10-01T00:00:00Z');
const rollback = new Error('Intentional test transaction rollback');
before(async () => {
  await seedDemo(db);
});
after(async () => {
  await db.$disconnect();
});
async function trial(fn) {
  try {
    await db.$transaction(async (tx) => {
      await fn(tx);
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}
async function otherWorkspace(tx) {
  const w = await tx.workspace.create({
    data: {
      name: 'Isolated test workspace',
      ownerUserId: uid,
      baseCurrency: currency,
    },
  });
  await tx.workspaceMember.create({
    data: { workspaceId: w.id, userId: uid, role: 'owner' },
  });
  return w.id;
}
async function receipt(tx, amount = 1000n, extra = {}) {
  return tx.transaction.create({
    data: {
      workspaceId: wid,
      currency,
      accountId: seedId(4),
      createdById: uid,
      bookingDate: date,
      originalDate: date,
      amountMinor: amount,
      originalAmountMinor: amount,
      description: 'Integration receipt',
      originalDescription: 'Original text',
      type: amount > 0n ? 'income' : 'expense',
      ...extra,
    },
  });
}
async function invoice(
  tx,
  workspaceId = wid,
  accountId = seedId(4),
  clientId = seedId(6),
) {
  const i = await tx.invoice.create({
    data: {
      workspaceId,
      currency,
      accountId,
      clientId,
      createdById: uid,
      invoiceNumber: randomUUID(),
      issueDate: date,
      dueDate: date,
      clientSnapshot: {},
      subtotalMinor: 1000n,
      totalMinor: 1000n,
      lifecycle: 'issued',
      issuedAt: date,
    },
  });
  await tx.invoiceItem.create({
    data: {
      workspaceId,
      invoiceId: i.id,
      position: 0,
      description: 'Fractional service',
      quantity: '1.2500',
      unitPrice: '8.0000',
      baseMinor: 1000n,
      lineTotalMinor: 1000n,
    },
  });
  return i;
}
async function payment(tx, amount = 1000n) {
  const t = await receipt(tx, amount);
  return tx.payment.create({
    data: {
      workspaceId: wid,
      currency,
      transactionId: t.id,
      createdById: uid,
      paidAt: date,
      amountMinor: amount,
      method: 'bank',
      idempotencyKey: randomUUID(),
    },
  });
}
test('seed reruns without duplicate records or credentials', async () => {
  const beforeCount = await db.invoice.count();
  await seedDemo(db);
  assert.equal(await db.invoice.count(), beforeCount);
  const user = await db.user.findUniqueOrThrow({ where: { id: uid } });
  assert.equal(user.passwordHash, null);
  assert.equal(user.status, 'disabled');
});
test('migration creates 34 domain tables, checks, indexes and deferred triggers', async () => {
  const tables =
    await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  assert.equal(tables.length, 34);
  const constraints =
    await db.$queryRaw`SELECT count(*)::int AS count FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='c'`;
  assert.ok(constraints[0].count >= 35);
  const triggers =
    await db.$queryRaw`SELECT count(*)::int AS count FROM pg_trigger WHERE tgname LIKE '%financial_check' AND tgdeferrable AND tginitdeferred`;
  assert.equal(triggers[0].count, 9);
});
test('duplicate membership is rejected', () =>
  assert.rejects(
    trial((tx) =>
      tx.workspaceMember.create({
        data: { workspaceId: wid, userId: uid, role: 'viewer' },
      }),
    ),
  ));
test('owner membership cannot be revoked', () =>
  assert.rejects(
    trial((tx) =>
      tx.workspaceMember.update({
        where: { id: seedId(3) },
        data: { status: 'revoked', revokedAt: new Date() },
      }),
    ),
  ));
test('invitation has hashed token and cannot grant owner', () =>
  assert.rejects(
    trial((tx) =>
      tx.workspaceInvitation.create({
        data: {
          workspaceId: wid,
          invitedById: uid,
          invitedEmail: 'guest@example.test',
          role: 'owner',
          tokenHash: 'a'.repeat(64),
          expiresAt: new Date(Date.now() + 86400000),
        },
      }),
    ),
  ));
test('pending invitation preserves explicit state without membership', () =>
  trial(async (tx) => {
    const invite = await tx.workspaceInvitation.create({
      data: {
        workspaceId: wid,
        invitedById: uid,
        invitedEmail: 'guest@example.test',
        role: 'viewer',
        tokenHash: 'b'.repeat(64),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    assert.equal(invite.status, 'pending');
  }));
test('invoice cannot reference foreign-workspace client', () =>
  assert.rejects(
    trial(async (tx) => {
      const other = await otherWorkspace(tx);
      const c = await tx.client.create({
        data: {
          workspaceId: other,
          type: 'individual',
          name: 'Other client',
          defaultCurrency: currency,
        },
      });
      await invoice(tx, wid, seedId(4), c.id);
    }),
  ));
test('transaction rejects invalid account and mismatched currency', async () => {
  await assert.rejects(
    trial((tx) => receipt(tx, 100n, { accountId: randomUUID() })),
  );
  await assert.rejects(trial((tx) => receipt(tx, 100n, { currency: 'EUR' })));
});
test('expense splits persist exact magnitudes and original source', () =>
  trial(async (tx) => {
    const t = await receipt(tx, -1000n, { excludedAt: new Date() });
    await tx.transactionSplit.createMany({
      data: [400n, 600n].map((amountMinor) => ({
        workspaceId: wid,
        transactionId: t.id,
        categoryId: seedId(5),
        amountMinor,
      })),
    });
    assert.equal(t.originalDescription, 'Original text');
    assert.ok(t.excludedAt);
  }));
test('unbalanced splits are rejected at transaction end', () =>
  assert.rejects(
    trial(async (tx) => {
      const t = await receipt(tx, -1000n);
      await tx.transactionSplit.createMany({
        data: [400n, 500n].map((amountMinor) => ({
          workspaceId: wid,
          transactionId: t.id,
          categoryId: seedId(5),
          amountMinor,
        })),
      });
    }),
  ));
test('internal transfer pair has opposite amounts and separate accounts', () =>
  trial(async (tx) => {
    const account = await tx.financialAccount.create({
      data: {
        workspaceId: wid,
        currency,
        name: 'Transfer target',
        openingDate: date,
      },
    });
    const o = await receipt(tx, -1000n, { type: 'transfer' });
    const i = await receipt(tx, 1000n, {
      type: 'transfer',
      accountId: account.id,
    });
    await tx.transactionTransfer.create({
      data: {
        workspaceId: wid,
        currency,
        outgoingTransactionId: o.id,
        incomingTransactionId: i.id,
      },
    });
  }));
test('partial allocation and fractional invoice items reconcile', () =>
  trial(async (tx) => {
    const i = await invoice(tx);
    const p = await payment(tx, 400n);
    await tx.paymentAllocation.create({
      data: {
        workspaceId: wid,
        currency,
        paymentId: p.id,
        invoiceId: i.id,
        amountMinor: 400n,
      },
    });
    const item = await tx.invoiceItem.findFirstOrThrow({
      where: { invoiceId: i.id },
    });
    assert.equal(item.quantity.toFixed(4), '1.2500');
  }));
test('over-allocation and duplicate allocation rejected', async () => {
  await assert.rejects(
    trial(async (tx) => {
      const i = await invoice(tx);
      const p = await payment(tx, 2000n);
      await tx.paymentAllocation.create({
        data: {
          workspaceId: wid,
          currency,
          paymentId: p.id,
          invoiceId: i.id,
          amountMinor: 1001n,
        },
      });
    }),
  );
  await assert.rejects(
    trial((tx) =>
      tx.paymentAllocation.create({
        data: {
          workspaceId: wid,
          currency,
          paymentId: seedId(11),
          invoiceId: seedId(8),
          amountMinor: 1n,
        },
      }),
    ),
  );
});
test('receipt cannot be linked to a second payment or excluded after allocation', async () => {
  await assert.rejects(
    trial((tx) =>
      tx.payment.create({
        data: {
          workspaceId: wid,
          currency,
          transactionId: seedId(10),
          createdById: uid,
          paidAt: date,
          amountMinor: 2500n,
          method: 'bank',
          idempotencyKey: randomUUID(),
        },
      }),
    ),
  );
  await assert.rejects(
    trial((tx) =>
      tx.transaction.update({
        where: { id: seedId(10) },
        data: { excludedAt: new Date() },
      }),
    ),
  );
});
test('invoice number is unique per workspace', () =>
  assert.rejects(
    trial((tx) =>
      tx.invoice.create({
        data: {
          workspaceId: wid,
          currency,
          accountId: seedId(4),
          clientId: seedId(6),
          createdById: uid,
          invoiceNumber: 'SEED-001',
          issueDate: date,
          dueDate: date,
          clientSnapshot: {},
        },
      }),
    ),
  ));
test('import operation idempotency and Keep Both source decisions', () =>
  trial(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        workspaceId: wid,
        currency,
        financialAccountId: seedId(4),
        createdById: uid,
        idempotencyKey: randomUUID(),
        status: 'review',
        rowCount: 2,
        sourceRows: [{ amount: '-1.00' }, { amount: '-1.00' }],
        reviewDecisions: [
          { row: 1, decision: 'keep_both' },
          { row: 2, decision: 'keep_both' },
        ],
      },
    });
    for (const sourceRow of [1, 2])
      await receipt(tx, -100n, {
        importBatchId: batch.id,
        sourceRow,
        duplicateDecision: 'keep_both',
        source: 'import',
      });
  }));
test('repeated import idempotency key rejected', () =>
  assert.rejects(
    trial(async (tx) => {
      const data = {
        workspaceId: wid,
        currency,
        financialAccountId: seedId(4),
        createdById: uid,
        idempotencyKey: randomUUID(),
      };
      await tx.importBatch.create({ data });
      await tx.importBatch.create({ data });
    }),
  ));
test('investment precision survives storage and valuation currency cannot drift', async () => {
  const m = await db.investmentMovement.findUniqueOrThrow({
    where: { id: seedId(15) },
  });
  assert.equal(m.quantity.toFixed(8), '1.12345678');
  await assert.rejects(
    trial((tx) =>
      tx.investmentValuation.create({
        data: {
          workspaceId: wid,
          currency: 'EUR',
          investmentId: seedId(14),
          createdById: uid,
          valuedAt: date,
          estimatedValueMinor: 10n,
          positionSignature: 'test',
        },
      }),
    ),
  );
});
test('automation occurrence uniqueness prevents duplicate preparation', () =>
  assert.rejects(
    trial(async (tx) => {
      const data = {
        workspaceId: wid,
        automationRuleId: seedId(17),
        scheduledFor: date,
        idempotencyKey: randomUUID(),
      };
      await tx.automationRun.create({ data });
      await tx.automationRun.create({
        data: { ...data, idempotencyKey: randomUUID() },
      });
    }),
  ));
test('global notification preferences are unique with null workspace', () =>
  assert.rejects(
    trial(async (tx) => {
      const data = { userId: uid, eventType: randomUUID(), channel: 'in_app' };
      await tx.notificationPreference.create({ data });
      await tx.notificationPreference.create({ data });
    }),
  ));
test('archiving preserves client invoices; hard delete is restricted', async () => {
  await trial(async (tx) => {
    const count = await tx.invoice.count({ where: { clientId: seedId(6) } });
    await tx.client.update({
      where: { id: seedId(6) },
      data: { archivedAt: new Date() },
    });
    assert.equal(
      await tx.invoice.count({ where: { clientId: seedId(6) } }),
      count,
    );
  });
  await assert.rejects(
    trial((tx) => tx.client.delete({ where: { id: seedId(6) } })),
  );
});

test('allocation cannot point into a different workspace', () =>
  assert.rejects(
    trial(async (tx) => {
      const other = await otherWorkspace(tx);
      const account = await tx.financialAccount.create({
        data: {
          workspaceId: other,
          currency,
          name: 'Other account',
          openingDate: date,
        },
      });
      const client = await tx.client.create({
        data: {
          workspaceId: other,
          type: 'individual',
          name: 'Other client',
          defaultCurrency: currency,
        },
      });
      const i = await invoice(tx, other, account.id, client.id);
      await tx.paymentAllocation.create({
        data: {
          workspaceId: wid,
          currency,
          paymentId: seedId(11),
          invoiceId: i.id,
          amountMinor: 1n,
        },
      });
    }),
  ));

for (const isolationLevel of ['ReadCommitted', 'Serializable']) {
  test(`concurrent allocations on separate connections: ${isolationLevel}`, async () => {
    const setup = await db.$transaction(async (tx) => {
      const i = await invoice(tx);
      const p1 = await payment(tx, 600n),
        p2 = await payment(tx, 600n);
      return { invoiceId: i.id, paymentIds: [p1.id, p2.id] };
    });
    const pids = [];
    let release;
    const ready = new Promise((resolve) => {
      release = resolve;
    });
    const results = await Promise.allSettled(
      setup.paymentIds.map((paymentId) =>
        db.$transaction(
          async (tx) => {
            const [connection] =
              await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            pids.push(connection.pid);
            if (pids.length === 2) release();
            await ready;
            return tx.paymentAllocation.create({
              data: {
                workspaceId: wid,
                currency,
                invoiceId: setup.invoiceId,
                paymentId,
                amountMinor: 600n,
              },
            });
          },
          { isolationLevel, timeout: 10000 },
        ),
      ),
    );
    assert.equal(new Set(pids).size, 2);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const totals = await db.paymentAllocation.aggregate({
      where: { invoiceId: setup.invoiceId },
      _sum: { amountMinor: true },
    });
    assert.equal(totals._sum.amountMinor, 600n);
  });
}

test('normalized user email uniqueness and case policy', async () => {
  await assert.rejects(
    trial((tx) =>
      tx.user.create({
        data: {
          fullName: 'Duplicate',
          email: 'database-demo@example.test',
          status: 'disabled',
        },
      }),
    ),
  );
  await assert.rejects(
    trial((tx) =>
      tx.user.create({
        data: {
          fullName: 'Unnormalized',
          email: 'Upper@Example.Test',
          status: 'disabled',
        },
      }),
    ),
  );
});

test('invalid final invoice totals fail at actual transaction commit', async () => {
  await assert.rejects(
    db.$transaction(async (tx) => {
      const i = await invoice(tx);
      await tx.invoice.update({
        where: { id: i.id },
        data: { subtotalMinor: 999n, totalMinor: 999n },
      });
    }),
  );
});

test('notification recipient must reference an existing individual', () =>
  assert.rejects(
    trial((tx) =>
      tx.notification.create({
        data: {
          workspaceId: wid,
          recipientUserId: randomUUID(),
          type: 'test',
          title: 'Test',
          body: 'Fictional',
        },
      }),
    ),
  ));

test('cross-currency payment allocation is rejected by the composite foreign key', () =>
  assert.rejects(
    trial(async (tx) => {
      const account = await tx.financialAccount.create({
        data: {
          workspaceId: wid,
          currency: 'EUR',
          name: 'EUR test',
          openingDate: date,
        },
      });
      const t = await receipt(tx, 100n, {
        currency: 'EUR',
        accountId: account.id,
      });
      const p = await tx.payment.create({
        data: {
          workspaceId: wid,
          currency: 'EUR',
          transactionId: t.id,
          createdById: uid,
          paidAt: date,
          amountMinor: 100n,
          method: 'bank',
          idempotencyKey: randomUUID(),
        },
      });
      await tx.paymentAllocation.create({
        data: {
          workspaceId: wid,
          currency: 'AUD',
          paymentId: p.id,
          invoiceId: seedId(8),
          amountMinor: 100n,
        },
      });
    }),
    (error) => error.code === 'P2003',
  ));

test('discount and tax reconcile after a valid multi-step invoice update', () =>
  trial(async (tx) => {
    const i = await invoice(tx);
    const item = await tx.invoiceItem.findFirstOrThrow({
      where: { invoiceId: i.id },
    });
    await tx.invoiceItem.update({
      where: { id: item.id },
      data: {
        discountMinor: 100n,
        taxRate: '10',
        taxMinor: 90n,
        lineTotalMinor: 990n,
      },
    });
    await tx.invoice.update({
      where: { id: i.id },
      data: { discountMinor: 100n, taxMinor: 90n, totalMinor: 990n },
    });
  }));

test('a line discount cannot exceed its base', () =>
  assert.rejects(
    trial(async (tx) => {
      const i = await invoice(tx);
      const item = await tx.invoiceItem.findFirstOrThrow({
        where: { invoiceId: i.id },
      });
      await tx.invoiceItem.update({
        where: { id: item.id },
        data: { discountMinor: 1001n, lineTotalMinor: -1n },
      });
    }),
  ));

test('unequal internal transfer amounts fail at final-state validation', () =>
  assert.rejects(
    trial(async (tx) => {
      const account = await tx.financialAccount.create({
        data: {
          workspaceId: wid,
          currency,
          name: 'Unequal transfer test',
          openingDate: date,
        },
      });
      const o = await receipt(tx, -500n, { type: 'transfer' });
      const i = await receipt(tx, 400n, {
        type: 'transfer',
        accountId: account.id,
      });
      await tx.transactionTransfer.create({
        data: {
          workspaceId: wid,
          currency,
          outgoingTransactionId: o.id,
          incomingTransactionId: i.id,
        },
      });
    }),
  ));
