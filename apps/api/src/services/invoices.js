import { createHash } from 'node:crypto';
import { withActor, workspaceAccess, missing } from '../repositories/access.js';
import {
  invoiceInclude,
  invoiceById,
  invoiceDto,
  clientDto,
  event,
} from '../repositories/invoices.js';
import { ApiError, fail } from '../validation/contracts.js';
import { draftInput } from '../validation/invoices.js';
const conflict = (m) => {
  throw new ApiError(409, 'CONFLICT', m);
};
const fingerprint = (x) =>
  createHash('sha256')
    .update(
      JSON.stringify(x, (_, v) => (typeof v === 'bigint' ? String(v) : v)),
    )
    .digest('hex');
const version = (r, v) => {
  if (r.version !== v) conflict('Invoice changed. Reload before continuing.');
};
async function writeDraft(tx, a, w, input, id) {
  const { items, totals, version: ignored, ...header } = input;
  void ignored;
  const client = await tx.client.findFirst({
    where: { workspaceId: w, id: header.clientId, archivedAt: null },
  });
  const account = await tx.financialAccount.findFirst({
    where: {
      workspaceId: w,
      id: header.accountId,
      currency: header.currency,
      archivedAt: null,
    },
  });
  if (!client || client.defaultCurrency !== header.currency || !account)
    fail('Choose an active client and account in the invoice currency.');
  const data = {
    ...header,
    subtotalMinor: BigInt(totals.subtotal),
    discountMinor: BigInt(totals.discount),
    taxMinor: BigInt(totals.tax),
    totalMinor: BigInt(totals.total),
    clientSnapshot: clientDto(client),
  };
  const row = id
    ? await tx.invoice.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      })
    : await tx.invoice.create({
        data: { ...data, workspaceId: w, createdById: a.userId },
      });
  if (id)
    await tx.invoiceItem.deleteMany({
      where: { workspaceId: w, invoiceId: id },
    });
  await tx.invoiceItem.createMany({
    data: items.map((item, position) => ({
      ...item,
      workspaceId: w,
      invoiceId: row.id,
      position,
      baseMinor: BigInt(totals.lines[position].base),
      discountMinor: BigInt(totals.lines[position].discount),
      taxMinor: BigInt(totals.lines[position].tax),
      lineTotalMinor: BigInt(totals.lines[position].total),
    })),
  });
  return invoiceDto(await invoiceById(tx, w, row.id));
}
export function invoices(db) {
  const run = (a, w, write, fn) =>
    withActor(db, a, async (tx) => {
      await workspaceAccess(tx, a.userId, w, write);
      return fn(tx);
    });
  return {
    clients: (a, w) =>
      run(a, w, false, async (tx) =>
        (
          await tx.client.findMany({
            where: { workspaceId: w },
            orderBy: { name: 'asc' },
          })
        ).map(clientDto),
      ),
    saveClient: (a, w, input, id) =>
      run(a, w, true, async (tx) => {
        if (id) {
          if (!(await tx.client.findFirst({ where: { id, workspaceId: w } })))
            throw missing();
          return clientDto(
            await tx.client.update({ where: { id }, data: input }),
          );
        }
        const existing = await tx.client.findFirst({
          where: { id: input.id, workspaceId: w },
        });
        if (existing) {
          const dto = clientDto(existing),
            candidate = clientDto({ ...input, archivedAt: null });
          if (JSON.stringify(dto) !== JSON.stringify(candidate))
            conflict('Client identifier already used.');
          return dto;
        }
        return clientDto(
          await tx.client.create({ data: { ...input, workspaceId: w } }),
        );
      }),
    archive: (a, w, id, archived) =>
      run(a, w, true, async (tx) => {
        if (!(await tx.client.findFirst({ where: { id, workspaceId: w } })))
          throw missing();
        return clientDto(
          await tx.client.update({
            where: { id },
            data: { archivedAt: archived ? new Date() : null },
          }),
        );
      }),
    list: (a, w, f) =>
      run(a, w, false, async (tx) => {
        const all = (
          await tx.invoice.findMany({
            where: { ...f.where, workspaceId: w },
            include: invoiceInclude,
            orderBy: [{ issueDate: 'desc' }, { id: 'asc' }],
          })
        ).map(invoiceDto);
        const rows = f.status
          ? all.filter((r) =>
              f.status === 'issued'
                ? r.lifecycle === 'issued'
                : r.status === f.status,
            )
          : all;
        const sum = (k) =>
          all
            .filter((r) => r.lifecycle === 'issued')
            .reduce((n, r) => n + BigInt(r[k]), 0n)
            .toString();
        return {
          rows: rows.slice((f.page - 1) * f.limit, f.page * f.limit),
          count: rows.length,
          page: f.page,
          limit: f.limit,
          summary: {
            invoicedMinor: sum('totalMinor'),
            paidMinor: sum('paidMinor'),
            outstandingMinor: sum('outstandingMinor'),
            overdueMinor: all
              .filter((r) => r.status === 'overdue')
              .reduce((n, r) => n + BigInt(r.outstandingMinor), 0n)
              .toString(),
          },
        };
      }),
    read: (a, w, id) =>
      run(a, w, false, async (tx) => ({
        ...invoiceDto(await invoiceById(tx, w, id)),
        activity: await tx.activityLog.findMany({
          where: { workspaceId: w, entityType: 'invoice', entityId: id },
          select: { id: true, action: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
      })),
    save: (a, w, input, id) =>
      run(a, w, true, async (tx) => {
        if (id) {
          const row = await invoiceById(tx, w, id);
          version(row, input.version);
          if (row.lifecycle !== 'draft')
            conflict('Only draft invoices can be edited.');
        } else {
          const old = await tx.invoice.findFirst({
            where: { id: input.id, workspaceId: w },
          });
          if (old) {
            const e = await tx.activityLog.findFirst({
              where: {
                workspaceId: w,
                entityId: input.id,
                action: 'created',
                actorUserId: a.userId,
              },
            });
            if (e?.metadataJson.fingerprint !== fingerprint(input))
              conflict('Invoice identifier already used.');
            return invoiceDto(await invoiceById(tx, w, input.id));
          }
        }
        const row = await writeDraft(tx, a, w, input, id);
        await event(tx, a, w, row.id, id ? 'updated' : 'created', {
          fingerprint: fingerprint(input),
        });
        return row;
      }),
    transition: (a, w, id, v, action) =>
      run(a, w, true, async (tx) => {
        const row = await invoiceById(tx, w, id);
        version(row, v);
        if (action === 'issue') {
          if (row.lifecycle !== 'draft' || row.totalMinor <= 0n)
            conflict('Only a positive draft can be issued.');
          if (
            !(await tx.client.findFirst({
              where: { id: row.clientId, workspaceId: w, archivedAt: null },
            }))
          )
            conflict('Archived clients cannot receive new invoices.');
        } else if (
          row.lifecycle === 'cancelled' ||
          row.PaymentAllocation_invoice.length
        )
          conflict(
            'Allocated or cancelled invoices require a corrective workflow.',
          );
        await tx.invoice.update({
          where: { id },
          data: {
            lifecycle: action === 'issue' ? 'issued' : 'cancelled',
            ...(action === 'issue'
              ? { issuedAt: new Date() }
              : { cancelledAt: new Date() }),
            version: { increment: 1 },
          },
        });
        await event(
          tx,
          a,
          w,
          id,
          action === 'issue' ? 'issued-not-sent' : 'cancelled',
        );
        return invoiceDto(await invoiceById(tx, w, id));
      }),
    duplicate: (a, w, id, body) =>
      run(a, w, true, async (tx) => {
        const row = invoiceDto(await invoiceById(tx, w, id));
        const prior = await tx.activityLog.findFirst({
          where: { workspaceId: w, entityId: body.id, action: 'duplicated' },
        });
        if (prior) {
          if (
            prior.actorUserId !== a.userId ||
            prior.metadataJson.fingerprint !==
              fingerprint({ sourceId: id, ...body })
          )
            conflict('Duplicate identifier already used.');
          return invoiceDto(await invoiceById(tx, w, body.id));
        }
        const {
          items,
          clientId,
          accountId,
          currency,
          issuedDate,
          dueDate,
          paymentTerms,
          notes,
          paymentInstructions,
        } = row;
        const discount =
          BigInt(row.discountMinor) / 100n +
          '.' +
          (BigInt(row.discountMinor) % 100n).toString().padStart(2, '0');
        const result = await writeDraft(
          tx,
          a,
          w,
          draftInput({
            ...body,
            items,
            clientId,
            accountId,
            currency,
            issuedDate,
            dueDate,
            paymentTerms,
            notes,
            paymentInstructions,
            discount,
          }),
        );
        await event(tx, a, w, result.id, 'duplicated', {
          fingerprint: fingerprint({ sourceId: id, ...body }),
        });
        return result;
      }),
    payment: (a, w, id, input) =>
      run(a, w, true, async (tx) => {
        const signature = fingerprint({
          invoiceId: id,
          actor: a.userId,
          ...input,
        });
        const prior = await tx.activityLog.findFirst({
          where: {
            workspaceId: w,
            action: 'payment-recorded',
            metadataJson: {
              path: ['operationKey'],
              equals: input.idempotencyKey,
            },
          },
        });
        if (prior) {
          if (prior.metadataJson.fingerprint !== signature)
            conflict(
              'Payment operation key already used with different input.',
            );
          return prior.metadataJson.result;
        }
        const row = await invoiceById(tx, w, id),
          dto = invoiceDto(row);
        if (
          row.lifecycle !== 'issued' ||
          input.amountMinor > BigInt(dto.outstandingMinor)
        )
          conflict(
            'Payment exceeds outstanding balance or invoice is not issued.',
          );
        let payment, receipt;
        if (input.transactionId) {
          receipt = await tx.transaction.findFirst({
            where: { id: input.transactionId, workspaceId: w },
          });
          if (!receipt) throw missing();
          if (
            receipt.type !== 'income' ||
            receipt.excludedAt ||
            receipt.currency !== row.currency ||
            receipt.accountId !== row.accountId ||
            receipt.bookingDate.getTime() !== input.paidAt.getTime()
          )
            fail(
              'Existing receipt must match account, currency and payment date and be confirmed income.',
            );
          payment = await tx.payment.findFirst({
            where: { transactionId: receipt.id, workspaceId: w },
            include: { PaymentAllocation_payment: true },
          });
          if (payment && payment.status !== 'confirmed')
            conflict('Receipt has a pending payment requiring review.');
          const allocated =
            payment?.PaymentAllocation_payment.reduce(
              (n, x) => n + x.amountMinor,
              0n,
            ) || 0n;
          if (input.amountMinor > receipt.amountMinor - allocated)
            conflict('Receipt has insufficient unallocated funds.');
        } else {
          const account = await tx.financialAccount.findFirst({
            where: {
              id: row.accountId,
              workspaceId: w,
              currency: row.currency,
              archivedAt: null,
            },
          });
          if (!account) fail('Receiving account is archived.');
          const description = `Invoice ${row.invoiceNumber} receipt`;
          receipt = await tx.transaction.create({
            data: {
              workspaceId: w,
              accountId: row.accountId,
              clientId: row.clientId,
              currency: row.currency,
              bookingDate: input.paidAt,
              originalDate: input.paidAt,
              description,
              originalDescription: description,
              amountMinor: input.amountMinor,
              originalAmountMinor: input.amountMinor,
              type: 'income',
              source: 'payment',
              createdById: a.userId,
            },
          });
        }
        if (!payment)
          payment = await tx.payment.create({
            data: {
              workspaceId: w,
              currency: row.currency,
              paidAt: receipt.bookingDate,
              amountMinor: receipt.amountMinor,
              method: input.method,
              reference: input.reference,
              transactionId: receipt.id,
              createdById: a.userId,
              idempotencyKey: input.idempotencyKey,
            },
          });
        const allocation = await tx.paymentAllocation.upsert({
          where: {
            paymentId_invoiceId: { paymentId: payment.id, invoiceId: id },
          },
          create: {
            workspaceId: w,
            currency: row.currency,
            paymentId: payment.id,
            invoiceId: id,
            amountMinor: input.amountMinor,
          },
          update: { amountMinor: { increment: input.amountMinor } },
        });
        await tx.invoice.update({
          where: { id },
          data: { version: { increment: 1 } },
        });
        const result = {
          paymentId: payment.id,
          transactionId: receipt.id,
          allocationId: allocation.id,
          allocatedMinor: String(input.amountMinor),
          invoice: invoiceDto(await invoiceById(tx, w, id)),
        };
        await event(tx, a, w, id, 'payment-recorded', {
          operationKey: input.idempotencyKey,
          fingerprint: signature,
          result,
        });
        return result;
      }),
    readPayment: (a, w, id) =>
      run(a, w, false, async (tx) => {
        const p = await tx.payment.findFirst({
          where: { workspaceId: w, id },
          include: { PaymentAllocation_payment: true },
        });
        if (!p) throw missing();
        return p;
      }),
    summary: (a, w, f) =>
      run(a, w, false, async (tx) => {
        const rows = (
          await tx.invoice.findMany({
            where: { ...f.where, workspaceId: w, lifecycle: 'issued' },
            include: invoiceInclude,
          })
        ).map(invoiceDto);
        const { issueDate, ...where } = f.where;
        const receipts = await tx.transaction.findMany({
          where: {
            ...where,
            workspaceId: w,
            type: 'income',
            excludedAt: null,
            ...(issueDate ? { bookingDate: issueDate } : {}),
          },
          select: { amountMinor: true },
        });
        const sum = (k) =>
          rows.reduce((n, r) => n + BigInt(r[k]), 0n).toString();
        return {
          receivedMinor: receipts
            .reduce((n, r) => n + r.amountMinor, 0n)
            .toString(),
          invoicedMinor: sum('totalMinor'),
          paidMinor: sum('paidMinor'),
          outstandingMinor: sum('outstandingMinor'),
          overdueMinor: rows
            .filter((r) => r.status === 'overdue')
            .reduce((n, r) => n + BigInt(r.outstandingMinor), 0n)
            .toString(),
        };
      }),
  };
}
