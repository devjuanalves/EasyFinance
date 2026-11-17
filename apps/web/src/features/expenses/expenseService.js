import { requirePermission } from '../settings/permissions.js';
import {
  validDate,
  selectTransactions,
  previousPeriod,
  groupExpensesByCategory,
  calculateExpenses,
} from '../finance/data/calculations.js';
import { periods } from '../finance/data/financialData.js';
import { parseAmount } from './csv.js';
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
export const normalize = (value) =>
  String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
export const fingerprint = (t) =>
  JSON.stringify([
    t.workspaceId,
    t.accountId,
    t.currency,
    t.originalDate || t.date,
    t.originalAmount ?? t.amount,
    normalize(t.originalDescription || t.description),
  ]);
export function duplicateCandidates(data, t, extra = []) {
  return [...data.transactions, ...extra].filter(
    (x) =>
      x.id !== t.id &&
      x.workspaceId === t.workspaceId &&
      x.accountId === t.accountId &&
      x.currency === t.currency &&
      (fingerprint(x) === fingerprint(t) ||
        (t.reference && x.reference === t.reference)),
  );
}
export function matchRules(data, t) {
  return (data.categoryRules || [])
    .filter(
      (r) =>
        r.workspaceId === t.workspaceId &&
        r.enabled &&
        data.categories.some(
          (c) => c.id === r.categoryId && !c.archived && c.kind === t.type,
        ) &&
        {
          contains: (a, b) => a.includes(b),
          equals: (a, b) => a === b,
          startsWith: (a, b) => a.startsWith(b),
        }[r.operator]?.(normalize(t[r.field]), normalize(r.value)),
    )
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}
export function rulePreview(data, context, ruleId) {
  return data.transactions
    .filter(
      (t) =>
        t.workspaceId === context.workspaceId &&
        t.currency === context.currency &&
        !t.excluded,
    )
    .flatMap((t) => {
      const matches = matchRules(data, t);
      if (!matches.some((r) => r.id === ruleId)) return [];
      return [
        {
          transaction: t,
          proposed: matches[0],
          conflict: new Set(matches.map((r) => r.categoryId)).size > 1,
          eligible:
            !t.manualCategory &&
            t.reviewStatus !== 'reviewed' &&
            !(data.transactionSplits || []).some(
              (s) => s.transactionId === t.id,
            ),
          matches,
        },
      ];
    });
}
export function transactionRows(data, filters, query = {}) {
  const period = periods.find((p) => p.id === filters.periodId) || periods[0];
  return data.transactions
    .filter(
      (t) =>
        t.workspaceId === filters.workspaceId &&
        t.currency === filters.currency &&
        (filters.accountId === 'all' || t.accountId === filters.accountId) &&
        (filters.participantId === 'all' ||
          t.participantId === filters.participantId) &&
        t.date >= (query.start || period.start) &&
        t.date <= (query.end || period.end) &&
        (!query.search ||
          normalize(
            `${t.description} ${t.originalDescription} ${t.amount / 100}`,
          ).includes(normalize(query.search))) &&
        (!query.type || query.type === 'all' || t.type === query.type) &&
        (!query.source ||
          query.source === 'all' ||
          (t.source || 'manual') === query.source) &&
        (!query.categoryId ||
          query.categoryId === 'all' ||
          t.categoryId === query.categoryId ||
          (!t.categoryId && query.categoryId === 'uncategorized') ||
          (data.transactionSplits || []).some(
            (s) =>
              s.transactionId === t.id && s.categoryId === query.categoryId,
          )) &&
        (!query.status ||
          query.status === 'all' ||
          (query.status === 'excluded'
            ? t.excluded
            : !t.excluded &&
              (query.status === 'duplicate'
                ? t.possibleDuplicate ||
                  (!t.duplicateDecision && duplicateCandidates(data, t).length)
                : query.status === 'uncategorized'
                  ? !t.categoryId || t.categoryId === 'uncategorized'
                  : t.reviewStatus === query.status))),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
export function expenseSummary(data, filters, categoryId = 'all') {
  const period = periods.find((p) => p.id === filters.periodId) || periods[0];
  const project = (rows) =>
    rows
      .filter((t) => t.type === 'expense')
      .flatMap((t) => {
        const splits = (data.transactionSplits || []).filter(
          (s) => s.transactionId === t.id,
        );
        if (categoryId === 'all') return [t];
        const amount = splits.length
          ? splits
              .filter((s) => s.categoryId === categoryId)
              .reduce((n, s) => n + s.amount, 0)
          : (t.categoryId || 'uncategorized') === categoryId
            ? -t.amount
            : 0;
        return amount ? [{ ...t, amount: -amount }] : [];
      });
  const rows = project(selectTransactions(data, filters, period));
  const previous = previousPeriod(period);
  const prior = project(selectTransactions(data, filters, previous));
  const categories =
    categoryId === 'all'
      ? groupExpensesByCategory(rows, data)
      : [
          {
            id: categoryId,
            name:
              data.categories.find((c) => c.id === categoryId)?.name ||
              'Uncategorized',
            amount: calculateExpenses(rows),
          },
        ].filter((c) => c.amount);
  const recurring = (data.expenseRecurrence || [])
    .filter((r) => r.workspaceId === filters.workspaceId)
    .flatMap((r) =>
      rows
        .filter((t) => r.transactionIds.includes(t.id))
        .map((t) => ({ ...r, transaction: t })),
    );
  return {
    period,
    rows,
    total: calculateExpenses(rows),
    previous:
      previous.start >= data.coverageStart && period.end <= data.coverageEnd
        ? calculateExpenses(prior)
        : null,
    previousPeriod: previous,
    categories,
    recurring,
    recurringTotal: recurring.reduce((n, r) => n - r.transaction.amount, 0),
    days: Array.from(
      {
        length:
          Math.round(
            (Date.parse(period.end) - Date.parse(period.start)) / 86400000,
          ) + 1,
      },
      (_, i) => {
        const date = new Date(Date.parse(period.start) + i * 86400000)
          .toISOString()
          .slice(0, 10);
        return {
          date,
          expenses: calculateExpenses(rows.filter((t) => t.date === date)),
        };
      },
    ),
  };
}
export function applyExpenseCommand(original, context, action, payload = {}) {
  requirePermission(original, context);
  assert(
    ['owner', 'editor'].includes(context.role || 'owner'),
    'This workspace is read-only.',
  );
  assert(
    !context.scenario || context.scenario === 'normal',
    'Switch to normal sample data before editing.',
  );
  const data = structuredClone(original),
    workspaceId = context.workspaceId;
  assert(
    data.workspaces.some((w) => w.id === workspaceId),
    'Workspace not found.',
  );
  const id = (p) => `${p}-${(data.nextId = (data.nextId || 100) + 1)}`;
  const getTx = (key) => {
    const t = data.transactions.find(
      (t) =>
        t.id === key &&
        t.workspaceId === workspaceId &&
        t.currency === context.currency,
    );
    assert(t, 'Transaction not found in this workspace and currency.');
    return t;
  };
  const audit = (t, text) =>
    data.transactionEvents.push({
      id: id('audit'),
      workspaceId,
      transactionId: t.id,
      date: data.asOf,
      text,
    });
  const allocated = (t) =>
    data.payments.some(
      (p) =>
        p.transactionId === t.id &&
        data.allocations.some((a) => a.paymentId === p.id),
    );
  const financialLock = (t) => {
    assert(
      !allocated(t),
      'This receipt has invoice allocations. Use a future corrective workflow before changing financial fields.',
    );
    assert(
      !data.transactionTransfers.some(
        (x) => x.outgoingId === t.id || x.incomingId === t.id,
      ),
      'Unlink the paired transfer before changing financial fields.',
    );
  };
  const category = (key, type, previous) => {
    if (!key || key === 'uncategorized') return key || null;
    const c = data.categories.find(
      (c) => c.id === key && c.workspaceId === workspaceId && c.kind === type,
    );
    assert(
      c && (!c.archived || key === previous),
      'Choose an active category matching the transaction type.',
    );
    return c.id;
  };
  const validate = (t) => {
    assert(
      validDate(t.date) && t.date >= data.coverageStart && t.date <= data.asOf,
      'Use a valid date within sample coverage (1 August–31 October 2026).',
    );
    assert(t.description?.trim(), 'Description is required.');
    assert(
      data.accounts.some(
        (a) =>
          a.id === t.accountId &&
          a.workspaceId === workspaceId &&
          a.currency === t.currency,
      ) && t.currency === context.currency,
      'Choose a workspace account in the selected currency.',
    );
    assert(
      Number.isSafeInteger(t.amount) &&
        t.amount !== 0 &&
        Math.abs(t.amount) <= 100000000000,
      'Amount must be a nonzero value within the demo limit.',
    );
    assert(
      ['income', 'expense', 'transfer'].includes(t.type) &&
        (t.type === 'transfer' ||
          (t.type === 'expense' ? t.amount < 0 : t.amount > 0)),
      'The signed amount must match the transaction type.',
    );
  };
  const syncPayment = (t) => {
    const p = data.payments.find((p) => p.transactionId === t.id);
    if (p && !allocated(t))
      Object.assign(p, {
        amount: Math.max(0, t.amount),
        date: t.date,
        accountId: t.accountId,
        currency: t.currency,
        status: t.excluded || t.type !== 'income' ? 'inactive' : 'confirmed',
      });
  };
  const exclude = (t, value) => {
    financialLock(t);
    t.excluded = value;
    syncPayment(t);
    audit(t, value ? 'Excluded after confirmation' : 'Restored');
  };
  let result;
  if (action === 'saveTransaction') {
    const previous = payload.id ? getTx(payload.id) : null,
      form = payload.transaction;
    const amount =
      typeof form.amount === 'number' ? form.amount : parseAmount(form.amount);
    const next = {
      date: form.date,
      description: form.description?.trim(),
      amount,
      type: form.type,
      accountId: form.accountId,
      currency: form.currency || context.currency,
      notes: form.notes || '',
    };
    validate(next);
    if (
      previous &&
      ['date', 'amount', 'type', 'accountId', 'currency'].some(
        (k) => next[k] !== previous[k],
      )
    ) {
      financialLock(previous);
      assert(
        !data.transactionSplits.some((s) => s.transactionId === previous.id),
        'Remove splits before changing financial fields.',
      );
    }
    next.categoryId =
      next.type === 'transfer'
        ? null
        : category(form.categoryId, next.type, previous?.categoryId);
    if (previous) {
      Object.assign(previous, next, {
        manualCategory: true,
        reviewStatus: 'reviewed',
      });
      syncPayment(previous);
      audit(previous, 'Transaction edited; original source retained');
      result = previous.id;
    } else {
      const t = {
        ...next,
        id: id('transaction'),
        workspaceId,
        participantId:
          context.participantId === 'all' || !context.participantId
            ? 'alex'
            : context.participantId,
        source: 'manual',
        originalSource: 'manual',
        originalDescription: next.description,
        originalAmount: amount,
        manualCategory: true,
        reviewStatus: 'reviewed',
        excluded: false,
      };
      t.possibleDuplicate = duplicateCandidates(data, t).length > 0;
      data.transactions.push(t);
      audit(t, 'Manual transaction added');
      result = t.id;
    }
  } else if (action === 'split') {
    const t = getTx(payload.id);
    assert(
      t.type === 'expense' && !t.excluded,
      'Only active expenses can be split.',
    );
    const parts = payload.parts.map((s) => ({
      id: id('split'),
      transactionId: t.id,
      categoryId: category(s.categoryId, 'expense'),
      amount: typeof s.amount === 'number' ? s.amount : parseAmount(s.amount),
    }));
    assert(
      parts.length === 0 ||
        (parts.length >= 2 &&
          parts.every((s) => s.categoryId && s.amount > 0) &&
          parts.reduce((n, s) => n + s.amount, 0) === -t.amount),
      'Use at least two positive categorized splits that sum exactly to the parent amount.',
    );
    data.transactionSplits = [
      ...data.transactionSplits.filter((s) => s.transactionId !== t.id),
      ...parts,
    ];
    t.manualCategory = true;
    t.reviewStatus = 'reviewed';
    audit(
      t,
      parts.length
        ? 'Expense split confirmed'
        : 'Splits removed; original single category restored',
    );
  } else if (
    ['exclude', 'restore', 'bulkCategory', 'markReviewed'].includes(action)
  ) {
    assert(payload.ids?.length, 'Select transactions first.');
    for (const key of new Set(payload.ids)) {
      const t = getTx(key);
      if (action === 'exclude' || action === 'restore')
        exclude(t, action === 'exclude');
      else if (action === 'bulkCategory') {
        assert(
          !t.excluded &&
            !data.transactionSplits.some((s) => s.transactionId === t.id),
          'Excluded or split transactions need individual review.',
        );
        t.categoryId = category(payload.categoryId, t.type);
        t.manualCategory = true;
        t.reviewStatus = 'reviewed';
        audit(t, 'Category manually assigned');
      } else {
        t.reviewStatus = 'reviewed';
        audit(t, 'Marked reviewed');
      }
    }
  } else if (action === 'duplicateDecision') {
    const t = getTx(payload.id);
    assert(
      ['both', 'original', 'exclude'].includes(payload.decision),
      'Choose a duplicate decision.',
    );
    if (payload.decision === 'original') {
      const candidates = duplicateCandidates(data, t);
      assert(
        candidates.some((c) => c.id === payload.originalId && !c.excluded),
        'Choose an active original candidate.',
      );
      exclude(t, true);
      t.duplicateOfId = payload.originalId;
    }
    if (payload.decision === 'exclude') exclude(t, true);
    t.possibleDuplicate = false;
    t.duplicateDecision = payload.decision;
    t.reviewStatus = 'reviewed';
    audit(t, `Duplicate reviewed: ${payload.decision}`);
  } else if (action === 'linkTransfer') {
    const first = getTx(payload.id),
      second = getTx(payload.otherId);
    financialLock(first);
    financialLock(second);
    assert(
      first.id !== second.id &&
        !first.excluded &&
        !second.excluded &&
        first.accountId !== second.accountId &&
        first.amount === -second.amount &&
        first.currency === second.currency,
      'Choose two active opposite equal amounts in different accounts of the same currency.',
    );
    assert(
      ![first, second].some((t) =>
        data.transactionSplits.some((s) => s.transactionId === t.id),
      ),
      'Remove splits before linking a transfer.',
    );
    for (const t of [first, second]) {
      t.type = 'transfer';
      t.categoryId = null;
      t.reviewStatus = 'reviewed';
      syncPayment(t);
      audit(t, 'Internal transfer pair explicitly linked');
    }
    data.transactionTransfers.push({
      id: id('transfer'),
      workspaceId,
      outgoingId: first.amount < 0 ? first.id : second.id,
      incomingId: first.amount > 0 ? first.id : second.id,
    });
  } else if (action === 'unlinkTransfer') {
    const t = getTx(payload.id);
    data.transactionTransfers = data.transactionTransfers.filter(
      (x) => x.outgoingId !== t.id && x.incomingId !== t.id,
    );
    audit(
      t,
      'Transfer pair unlinked; both entries remain transfers until edited',
    );
  } else if (action === 'confirmImport') {
    assert(
      payload.token &&
        !data.importBatches.some(
          (b) => b.token === payload.token && b.workspaceId === workspaceId,
        ),
      'This import has already been confirmed.',
    );
    assert(
      payload.rows?.length && payload.rows.length <= 500,
      'Review 1–500 rows.',
    );
    assert(
      payload.rows.every((r) => ['keep', 'exclude'].includes(r.decision)),
      'Review every row: explicitly Keep or Exclude.',
    );
    const batchId = id('batch'),
      accepted = [],
      decisions = [];
    let duplicates = 0;
    for (const r of payload.rows) {
      const t = {
        ...r,
        id: id('transaction'),
        workspaceId,
        currency: payload.currency,
        accountId: payload.accountId,
        participantId:
          context.participantId === 'all' || !context.participantId
            ? 'alex'
            : context.participantId,
      };
      validate(t);
      assert(
        validDate(payload.start) &&
          validDate(payload.end) &&
          t.date >= payload.start &&
          t.date <= payload.end,
        'Transaction lies outside the statement period.',
      );
      const candidates = duplicateCandidates(data, t, accepted);
      if (candidates.length) duplicates++;
      if (r.decision === 'keep') {
        assert(
          !candidates.length || r.duplicateDecision === 'both',
          'Resolve duplicate candidates with Keep Both or Exclude.',
        );
        t.categoryId =
          t.type === 'transfer' ? null : category(t.categoryId, t.type);
        Object.assign(t, {
          source: 'import',
          originalSource: 'import',
          importBatchId: batchId,
          excluded: false,
          manualCategory: Boolean(r.manualCategory),
          reviewStatus:
            t.categoryId || t.type === 'transfer' ? 'reviewed' : 'pending',
          possibleDuplicate: false,
          duplicateDecision: candidates.length ? 'both' : null,
        });
        accepted.push(t);
      }
      decisions.push({
        ...t,
        decision: r.decision,
        duplicateCandidateIds: candidates.map((c) => c.id),
      });
    }
    const attachmentId = id('attachment');
    data.attachments.push({
      id: attachmentId,
      workspaceId,
      name: payload.fileName,
      mime: payload.mime,
      size: payload.size,
      checksum: payload.checksum,
    });
    const batch = {
      id: batchId,
      token: payload.token,
      workspaceId,
      accountId: payload.accountId,
      currency: payload.currency,
      start: payload.start,
      end: payload.end,
      fileName: payload.fileName,
      attachmentId,
      rows: decisions,
      transactionIds: accepted.map((t) => t.id),
      imported: accepted.length,
      excluded: decisions.length - accepted.length,
      duplicates,
      unclassified: accepted.filter(
        (t) => t.type !== 'transfer' && !t.categoryId,
      ).length,
      status: 'complete',
    };
    data.importBatches.push(batch);
    data.transactions.push(...accepted);
    accepted.forEach((t) => audit(t, 'Reviewed statement row confirmed'));
    result = batchId;
  } else if (action === 'undoBatch') {
    const batch = data.importBatches.find(
      (b) =>
        b.id === payload.id &&
        b.workspaceId === workspaceId &&
        b.currency === context.currency,
    );
    assert(
      batch && batch.status === 'complete',
      'Batch unavailable or already excluded.',
    );
    for (const key of batch.transactionIds) exclude(getTx(key), true);
    batch.status = 'excluded';
  } else if (action === 'saveCategory') {
    const c = payload.category,
      previous = payload.id
        ? data.categories.find(
            (c) => c.id === payload.id && c.workspaceId === workspaceId,
          )
        : null;
    assert(!payload.id || previous, 'Category not found.');
    assert(c.name?.trim(), 'Category name is required.');
    assert(['income', 'expense'].includes(c.kind), 'Choose Income or Expense.');
    assert(
      !data.categories.some(
        (x) =>
          x.workspaceId === workspaceId &&
          x.kind === c.kind &&
          normalize(x.name) === normalize(c.name) &&
          x.id !== payload.id,
      ),
      'Category name must be unique within workspace and kind.',
    );
    assert(
      ['home', 'expenses', 'income', 'attach', 'settings', 'chat'].includes(
        c.icon,
      ) && /^#[\da-f]{6}$/i.test(c.color),
      'Choose a supported icon and six-digit color.',
    );
    assert(
      !previous || previous.kind === c.kind,
      'Category kind cannot be changed; create another category.',
    );
    const saved = {
      name: c.name.trim(),
      kind: c.kind,
      icon: c.icon,
      color: c.color,
      id: previous?.id || id('category'),
      workspaceId,
      archived: previous?.archived || false,
    };
    if (previous) Object.assign(previous, saved);
    else data.categories.push(saved);
    result = saved.id;
  } else if (action === 'archiveCategory') {
    const c = data.categories.find(
      (c) => c.id === payload.id && c.workspaceId === workspaceId,
    );
    assert(
      c && !['uncategorized', 'transfer'].includes(c.id),
      'This category cannot be archived.',
    );
    c.archived = true;
  } else if (action === 'saveRule') {
    const r = payload.rule,
      previous = payload.id
        ? data.categoryRules.find(
            (r) => r.id === payload.id && r.workspaceId === workspaceId,
          )
        : null;
    assert(!payload.id || previous, 'Rule not found.');
    assert(
      r.name?.trim() && r.value?.trim(),
      'Rule name and match value are required.',
    );
    assert(
      ['description', 'merchant', 'reference'].includes(r.field) &&
        ['contains', 'equals', 'startsWith'].includes(r.operator),
      'Choose a supported field and operator.',
    );
    assert(
      Number.isInteger(Number(r.priority)) &&
        Number(r.priority) >= 0 &&
        Number(r.priority) <= 9999,
      'Priority must be an integer from 0 to 9999.',
    );
    assert(
      data.categories.some(
        (c) =>
          c.id === r.categoryId &&
          c.workspaceId === workspaceId &&
          !c.archived &&
          ['income', 'expense'].includes(c.kind),
      ),
      'Choose an active income or expense category.',
    );
    const saved = {
      ...r,
      name: r.name.trim(),
      value: r.value.trim(),
      priority: Number(r.priority),
      enabled: Boolean(r.enabled),
      id: previous?.id || id('category-rule'),
      workspaceId,
    };
    if (previous) Object.assign(previous, saved);
    else data.categoryRules.push(saved);
    result = saved.id;
  } else if (action === 'toggleRule' || action === 'deleteRule') {
    const r = data.categoryRules.find(
      (r) => r.id === payload.id && r.workspaceId === workspaceId,
    );
    assert(r, 'Rule not found.');
    if (action === 'toggleRule') r.enabled = !r.enabled;
    else data.categoryRules = data.categoryRules.filter((x) => x.id !== r.id);
  } else if (action === 'applyRule') {
    const preview = rulePreview(data, context, payload.id);
    assert(payload.ids?.length, 'Select eligible suggestions.');
    for (const key of new Set(payload.ids)) {
      const row = preview.find((r) => r.transaction.id === key);
      assert(
        row?.eligible && row.proposed.id === payload.id,
        'Suggestion changed or transaction has a manual/reviewed classification. Preview again.',
      );
      const t = getTx(key);
      t.categoryId = row.proposed.categoryId;
      t.reviewStatus = 'reviewed';
      t.manualCategory = true;
      audit(t, 'Rule suggestion explicitly confirmed');
    }
  } else throw new Error('Unsupported expense operation.');
  return { data, result };
}
