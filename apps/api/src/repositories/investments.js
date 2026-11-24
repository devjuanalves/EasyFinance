import {
  positionAt,
  portfolio,
} from '../../../../packages/shared/src/investmentMath.js';
import { ApiError } from '../validation/contracts.js';
const day = (d) => d.toISOString().slice(0, 10);
export async function investmentRecords(tx, workspaceId) {
  const models = [
    'investmentAccount',
    'investment',
    'investmentMovement',
    'investmentValuation',
    'activityLog',
  ];
  const rows = await Promise.all(
    models.map((model) =>
      tx[model].findMany({
        where: {
          workspaceId,
          ...(model === 'activityLog'
            ? { entityType: 'investment-command' }
            : {}),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 10001,
      }),
    ),
  );
  if (rows.some((a) => a.length > 10000))
    throw new ApiError(
      409,
      'HISTORY_LIMIT',
      'Investment history exceeds the supported limit.',
    );
  const [accounts, holdings, movements, valuations, logs] = rows;
  const safe = (n) => {
    const v = Number(n);
    if (!Number.isSafeInteger(v) || v < 0 || v > 10000000000000)
      throw new ApiError(
        409,
        'UNSUPPORTED_VALUE',
        'Investment amount exceeds the supported range.',
      );
    return v;
  };
  const asOf = day(new Date());
  const data = {
    asOf,
    coverageStart: '1900-01-01',
    coverageEnd: asOf,
    workspaces: [{ id: workspaceId }],
    nextId: Math.max(1000, ...movements.map((m) => m.sequence)),
    investmentAccounts: accounts.map((a) => ({
      ...a,
      archived: !!a.archivedAt,
    })),
    investments: holdings.map((i) => ({
      ...i,
      openedAt: day(i.openedAt),
      archived: !!i.archivedAt,
      customType: i.customCategory || '',
      symbol: i.symbol || '',
      notes: i.notes || '',
      tags: Array.isArray(i.tags) ? i.tags.join(', ') : '',
      interestInfo:
        logs.filter((l) => l.entityId === i.id).at(-1)?.metadataJson
          .interestInfo || '',
    })),
    investmentMovements: movements.map((m) => ({
      id: m.id,
      workspaceId,
      currency: m.currency,
      investmentId: m.investmentId,
      date: day(m.date),
      type: m.type,
      quantity: m.quantity?.toFixed() || null,
      unitPrice: m.unitPrice?.toFixed() || null,
      amount: safe(m.amountMinor),
      fee: safe(m.feeMinor),
      notes: m.notes || '',
      order: m.sequence,
      revision: m.updatedAt.getTime(),
      deleted: !!m.deletedAt,
    })),
    investmentValuations: valuations.map((v, index) => ({
      id: v.id,
      workspaceId,
      currency: v.currency,
      investmentId: v.investmentId,
      valuedAt: day(v.valuedAt),
      estimatedValue: safe(v.estimatedValueMinor),
      capitalSignature: v.positionSignature,
      source: v.source,
      createdBy: v.createdById,
      notes: v.notes || '',
      order: index,
      deleted: !!v.deletedAt,
    })),
    investmentEvents: logs.flatMap((l) => l.metadataJson.events || []),
  };
  try {
    data.positions = Object.fromEntries(
      data.investments.map((i) => [i.id, positionAt(data, i)]),
    );
    data.summaries = Object.fromEntries(
      ['AUD', 'EUR', 'USD'].map((currency) => {
        const p = portfolio(data, { workspaceId, currency });
        return [
          currency,
          {
            basis: p.basis,
            currentValue: p.currentValue,
            unrealized: p.unrealized,
            contributions: p.contributions,
            allocation: p.allocation,
          },
        ];
      }),
    );
  } catch {
    throw new ApiError(
      409,
      'INVALID_HISTORY',
      'Investment history requires review before it can be calculated.',
    );
  }
  return data;
}
export async function persistInvestmentChanges(tx, before, after, actor) {
  const changed = (key) =>
    after[key].filter(
      (row) =>
        JSON.stringify(row) !==
        JSON.stringify(before[key].find((x) => x.id === row.id)),
    );
  for (const a of changed('investmentAccounts'))
    await tx.investmentAccount.create({
      data: {
        id: a.id,
        workspaceId: a.workspaceId,
        name: a.name,
        institution: a.institution,
        currency: a.currency,
      },
    });
  for (const i of changed('investments')) {
    const data = {
      name: i.name,
      investmentAccountId: i.investmentAccountId,
      symbol: i.symbol || null,
      customCategory: i.customType || null,
      notes: i.notes || '',
      tags: i.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    if (before.investments.some((x) => x.id === i.id))
      await tx.investment.update({ where: { id: i.id }, data });
    else
      await tx.investment.create({
        data: {
          ...data,
          id: i.id,
          workspaceId: i.workspaceId,
          currency: i.currency,
          assetType: i.assetType,
          openedAt: new Date(i.openedAt),
        },
      });
  }
  for (const m of changed('investmentMovements')) {
    const data = {
      date: new Date(m.date),
      type: m.type,
      quantity: m.quantity,
      unitPrice: m.unitPrice,
      amountMinor: BigInt(m.amount),
      feeMinor: BigInt(m.fee),
      notes: m.notes,
      deletedAt: m.deleted ? new Date() : null,
      updatedAt: new Date(m.revision),
    };
    if (before.investmentMovements.some((x) => x.id === m.id))
      await tx.investmentMovement.update({
        where: { id: m.id },
        data: {
          ...data,
          correctionReason: 'User-confirmed historical correction',
        },
      });
    else
      await tx.investmentMovement.create({
        data: {
          ...data,
          id: m.id,
          investmentId: m.investmentId,
          workspaceId: m.workspaceId,
          currency: m.currency,
          sequence: m.order,
          createdById: actor,
        },
      });
  }
  for (const v of changed('investmentValuations')) {
    if (before.investmentValuations.some((x) => x.id === v.id))
      await tx.investmentValuation.update({
        where: { id: v.id },
        data: { deletedAt: new Date() },
      });
    else
      await tx.investmentValuation.create({
        data: {
          id: v.id,
          workspaceId: v.workspaceId,
          investmentId: v.investmentId,
          currency: v.currency,
          valuedAt: new Date(v.valuedAt),
          estimatedValueMinor: BigInt(v.estimatedValue),
          positionSignature: v.capitalSignature,
          source: 'manual',
          notes: v.notes,
          createdById: actor,
        },
      });
  }
}
