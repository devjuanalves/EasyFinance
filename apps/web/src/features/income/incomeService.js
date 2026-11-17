import {
  applySettingsCommand,
  notifyFinancialCommand,
} from '../settings/settingsService.js';
import { requirePermission } from '../settings/permissions.js';
import { applyInvestmentCommand } from '../investments/investmentService.js';
import { applyExpenseCommand } from '../expenses/expenseService.js';
import {
  invoiceTotals,
  minorUnits,
  refreshInvoices,
  billable,
} from '../finance/data/invoiceMath.js';
import { validDate, summarize } from '../finance/data/calculations.js';
import { periods } from '../finance/data/financialData.js';
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const emailValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export function blankInvoice(data, filters, clientId = '') {
  const client = data.clients.find(
    (c) =>
      c.id === clientId && c.workspaceId === filters.workspaceId && !c.archived,
  );
  const currency = client?.defaultCurrency || filters.currency;
  const account =
    data.accounts.find(
      (a) =>
        a.workspaceId === filters.workspaceId &&
        a.currency === currency &&
        (filters.accountId === 'all' || a.id === filters.accountId),
    ) ||
    data.accounts.find(
      (a) => a.workspaceId === filters.workspaceId && a.currency === currency,
    );
  const number = nextNumber(data, filters.workspaceId);
  const terms = client?.paymentTerms || '14';
  return {
    number,
    clientId: client?.id || '',
    issuedDate: data.asOf,
    dueDate: addDays(data.asOf, Number(terms)),
    currency,
    accountId: account?.id || '',
    participantId:
      filters.participantId === 'all' ? 'alex' : filters.participantId,
    paymentTerms: terms,
    discount: '0',
    notes: 'Thank you for your business.',
    paymentInstructions: 'Please use the invoice number as your reference.',
    items: [
      {
        description: '',
        quantity: '1',
        unit: 'hours',
        unitPrice: '0',
        taxRate: '0',
      },
    ],
  };
}
export function addDays(date, days) {
  return new Date(Date.parse(date) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
function nextNumber(data, workspaceId) {
  let n = 1;
  while (
    data.invoices.some(
      (i) =>
        i.workspaceId === workspaceId &&
        i.number === `INV-2026-${String(n).padStart(3, '0')}`,
    )
  )
    n++;
  return `INV-2026-${String(n).padStart(3, '0')}`;
}
export function editableInvoice(data, invoice) {
  return {
    ...invoice,
    items: data.invoiceItems
      .filter((i) => i.invoiceId === invoice.id)
      .map((i) => ({ ...i })),
  };
}
export function validateInvoice(data, workspaceId, draft, id) {
  assert(draft.number?.trim(), 'Enter an invoice number.');
  assert(
    !data.invoices.some(
      (i) =>
        i.workspaceId === workspaceId &&
        i.id !== id &&
        i.number.toLowerCase() === draft.number.trim().toLowerCase(),
    ),
    'Invoice number must be unique in this workspace.',
  );
  const client = data.clients.find(
    (c) => c.id === draft.clientId && c.workspaceId === workspaceId,
  );
  assert(client && !client.archived, 'Select an active client.');
  assert(
    validDate(draft.issuedDate) &&
      validDate(draft.dueDate) &&
      draft.dueDate >= draft.issuedDate,
    'Use valid dates with due date on or after issue date.',
  );
  assert(
    draft.issuedDate >= data.coverageStart && draft.issuedDate <= data.asOf,
    'Issue date must be within the sample reporting coverage.',
  );
  assert(
    data.accounts.some(
      (a) =>
        a.id === draft.accountId &&
        a.workspaceId === workspaceId &&
        a.currency === draft.currency,
    ),
    'Choose an account matching the invoice currency.',
  );
  assert(
    client.defaultCurrency === draft.currency,
    'Invoice currency must match the selected client default. Change the client or its default currency first.',
  );
  assert(
    draft.items?.every((i) => i.description?.trim()),
    'Every item needs a description.',
  );
  assert(
    /^\d{1,3}$/.test(String(draft.paymentTerms)),
    'Payment terms must be 0–999 days.',
  );
  return invoiceTotals(draft.items, draft.discount);
}
export function availablePaymentAmount(data, payment) {
  return (
    payment.amount -
    data.allocations
      .filter((a) => a.paymentId === payment.id)
      .reduce((n, a) => n + a.amount, 0)
  );
}
export function eligibleTransactions(data, invoice) {
  return data.transactions
    .filter(
      (t) =>
        t.workspaceId === invoice.workspaceId &&
        t.currency === invoice.currency &&
        t.type === 'income' &&
        !t.excluded &&
        t.amount > 0,
    )
    .filter((t) => {
      const p = data.payments.find((p) => p.transactionId === t.id);
      return (
        !p ||
        (!data.allocations.some(
          (a) => a.paymentId === p.id && a.invoiceId === invoice.id,
        ) &&
          availablePaymentAmount(data, p) > 0)
      );
    });
}
export function incomeSummary(
  data,
  filters,
  { clientId = 'all', search = '', status = 'all' } = {},
) {
  const financial = summarize(data, filters),
    period = periods.find((p) => p.id === filters.periodId) || periods[0];
  const scoped = data.invoices.filter(
    (i) =>
      i.workspaceId === filters.workspaceId &&
      i.currency === filters.currency &&
      (filters.accountId === 'all' || i.accountId === filters.accountId) &&
      (filters.participantId === 'all' ||
        i.participantId === filters.participantId) &&
      i.issuedDate >= period.start &&
      i.issuedDate <= period.end &&
      (clientId === 'all' || i.clientId === clientId),
  );
  const invoices = scoped.filter(
    (i) =>
      (status === 'all' || i.status === status) &&
      `${i.number} ${data.clients.find((c) => c.id === i.clientId)?.name} ${i.notes}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const billed = scoped.filter(billable),
    receivedRows = financial.rows.filter(
      (t) =>
        t.type === 'income' && (clientId === 'all' || t.clientId === clientId),
    );
  return {
    financial,
    invoices,
    scoped,
    receivedRows,
    received: receivedRows.reduce((n, t) => n + t.amount, 0),
    invoiced: billed.reduce((n, i) => n + i.total, 0),
    paid: billed.reduce((n, i) => n + i.paid, 0),
    outstanding: billed.reduce((n, i) => n + i.total - i.paid, 0),
    overdue: billed
      .filter((i) => i.status === 'overdue')
      .reduce((n, i) => n + i.total - i.paid, 0),
  };
}
export function applyIncomeCommand(original, context, action, payload = {}) {
  requirePermission(original, context);
  assert(
    ['owner', 'editor'].includes(context.role || 'owner'),
    'This workspace is read-only for viewers.',
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
  const id = (prefix) => {
    data.nextId = (data.nextId || 100) + 1;
    return `${prefix}-${data.nextId}`;
  };
  const event = (invoiceId, text) =>
    data.events.push({ id: id('event'), invoiceId, date: data.asOf, text });
  const getInvoice = (invoiceId) => {
    const invoice = data.invoices.find(
      (i) => i.id === invoiceId && i.workspaceId === workspaceId,
    );
    assert(invoice, 'Invoice not found in this workspace.');
    return invoice;
  };
  let result;
  if (action === 'saveInvoice') {
    const previous = payload.id ? getInvoice(payload.id) : null;
    assert(
      !previous || previous.lifecycle === 'draft',
      'Only draft invoices can be edited. A corrective workflow is required for finalized records.',
    );
    const draft = payload.draft;
    validateInvoice(data, workspaceId, draft, previous?.id);
    const invoiceId = previous?.id || id('invoice');
    const client = data.clients.find((c) => c.id === draft.clientId);
    const invoice = {
      id: invoiceId,
      workspaceId,
      number: draft.number.trim(),
      clientId: draft.clientId,
      clientSnapshot: { ...client },
      issuedDate: draft.issuedDate,
      dueDate: draft.dueDate,
      currency: draft.currency,
      accountId: draft.accountId,
      participantId: draft.participantId || 'alex',
      paymentTerms: draft.paymentTerms,
      discount: draft.discount,
      notes: draft.notes,
      paymentInstructions: draft.paymentInstructions,
      lifecycle: 'draft',
      paid: 0,
    };
    data.invoices = previous
      ? data.invoices.map((i) => (i.id === invoiceId ? invoice : i))
      : [...data.invoices, invoice];
    data.invoiceItems = [
      ...data.invoiceItems.filter((i) => i.invoiceId !== invoiceId),
      ...draft.items.map((i) => ({ ...i, id: id('item'), invoiceId })),
    ];
    event(invoiceId, previous ? 'Draft updated' : 'Invoice created');
    result = invoiceId;
  } else if (action === 'duplicateInvoice') {
    const originalInvoice = getInvoice(payload.id),
      invoiceId = id('invoice');
    const duplicate = {
      ...originalInvoice,
      id: invoiceId,
      number: nextNumber(data, workspaceId),
      lifecycle: 'draft',
      historicalDelivery: false,
      paid: 0,
      needsReconciliation: false,
      issuedDate: data.asOf,
      dueDate: addDays(data.asOf, Number(originalInvoice.paymentTerms || 14)),
    };
    delete duplicate.transactionId;
    data.invoices.push(duplicate);
    data.invoiceItems.push(
      ...data.invoiceItems
        .filter((i) => i.invoiceId === originalInvoice.id)
        .map((i) => ({ ...i, id: id('item'), invoiceId })),
    );
    event(
      invoiceId,
      `Draft duplicated from ${originalInvoice.number}; no payments copied`,
    );
    result = invoiceId;
  } else if (action === 'cancelInvoice') {
    const invoice = getInvoice(payload.id);
    assert(invoice.lifecycle !== 'cancelled', 'Invoice is already cancelled.');
    assert(
      invoice.paid === 0,
      'Invoices with payments require a corrective/refund workflow and cannot be cancelled here.',
    );
    invoice.lifecycle = 'cancelled';
    event(invoice.id, 'Invoice cancelled after confirmation');
    result = invoice.id;
  } else if (action === 'prepareSend') {
    const invoice = getInvoice(payload.id);
    assert(
      invoice.lifecycle !== 'cancelled',
      'Cancelled invoices cannot be prepared for sending.',
    );
    const client = data.clients.find((c) => c.id === invoice.clientId);
    assert(
      !client.archived,
      'Archived clients cannot receive new preparation requests.',
    );
    assert(emailValid(payload.recipient), 'Enter a valid recipient email.');
    assert(
      invoice.total > 0,
      'Invoice total must be greater than zero before finalizing.',
    );
    invoice.lifecycle = 'issued';
    data.deliveries.push({
      id: id('delivery'),
      invoiceId: invoice.id,
      recipient: payload.recipient,
      status: 'prepared-not-sent',
      date: data.asOf,
    });
    event(invoice.id, 'Prepared for sending — no email transmitted');
    result = invoice.id;
  } else if (action === 'recordPayment' || action === 'confirmMatch') {
    const match =
      action === 'confirmMatch'
        ? data.bankMatches.find(
            (m) => m.id === payload.matchId && m.workspaceId === workspaceId,
          )
        : null;
    if (action === 'confirmMatch')
      assert(match?.status === 'pending', 'This match is no longer available.');
    const invoice = getInvoice(match?.invoiceId || payload.id);
    assert(
      billable(invoice) && invoice.total > invoice.paid,
      'Payments require an unpaid finalized invoice.',
    );
    const amount = match ? match.amount : minorUnits(payload.amount);
    assert(
      amount > 0 && amount <= invoice.total - invoice.paid,
      'Payment must be greater than zero and cannot exceed the outstanding balance.',
    );
    const transactionId = match?.transactionId || payload.transactionId;
    let payment;
    if (transactionId) {
      const transaction = data.transactions.find(
        (t) => t.id === transactionId && t.workspaceId === workspaceId,
      );
      assert(
        transaction &&
          transaction.currency === invoice.currency &&
          transaction.type === 'income' &&
          !transaction.excluded,
        'Existing transaction must be income in the same workspace and currency.',
      );
      payment = data.payments.find((p) => p.transactionId === transaction.id);
      if (!payment) {
        payment = {
          id: id('payment'),
          workspaceId,
          transactionId,
          amount: transaction.amount,
          currency: transaction.currency,
          date: transaction.date,
          accountId: transaction.accountId,
          method: 'bank',
          reference: transaction.description,
          status: 'confirmed',
        };
        data.payments.push(payment);
      }
      assert(
        !data.allocations.some(
          (a) => a.paymentId === payment.id && a.invoiceId === invoice.id,
        ),
        'This payment is already allocated to this invoice.',
      );
      assert(
        amount <= availablePaymentAmount(data, payment),
        'Allocation exceeds the available transaction amount.',
      );
    } else {
      assert(
        validDate(payload.date) &&
          payload.date >= data.coverageStart &&
          payload.date <= data.asOf,
        'Payment date must be valid and within the sample coverage ending 31 October 2026.',
      );
      assert(
        ['bank', 'cash', 'card', 'other'].includes(payload.method),
        'Choose a payment method.',
      );
      const transaction = {
        id: id('receipt'),
        workspaceId,
        accountId: invoice.accountId,
        currency: invoice.currency,
        participantId: invoice.participantId,
        clientId: invoice.clientId,
        date: payload.date,
        description: `Payment · ${invoice.number}`,
        amount,
        type: 'income',
        categoryId: 'income',
      };
      data.transactions.push(transaction);
      payment = {
        id: id('payment'),
        workspaceId,
        transactionId: transaction.id,
        amount,
        currency: invoice.currency,
        date: payload.date,
        accountId: transaction.accountId,
        clientId: invoice.clientId,
        method: payload.method,
        reference: payload.reference || '',
        status: 'confirmed',
      };
      data.payments.push(payment);
    }
    data.allocations.push({
      id: id('allocation'),
      paymentId: payment.id,
      invoiceId: invoice.id,
      amount,
    });
    if (match) match.status = 'confirmed';
    invoice.needsReconciliation = false;
    event(
      invoice.id,
      match
        ? 'Bank match confirmed; existing income not counted again'
        : transactionId
          ? 'Existing payment allocated; no new income'
          : 'New confirmed payment recorded',
    );
    result = invoice.id;
  } else if (action === 'dismissMatch') {
    const match = data.bankMatches.find(
      (m) => m.id === payload.id && m.workspaceId === workspaceId,
    );
    assert(match?.status === 'pending', 'Match not available.');
    match.status = 'dismissed';
    event(match.invoiceId, 'Bank match suggestion dismissed');
  } else if (action === 'saveClient') {
    const c = payload.client;
    assert(
      ['business', 'individual'].includes(c.type),
      'Choose a client type.',
    );
    assert(c.name?.trim(), 'Enter a client name.');
    assert(
      c.type !== 'business' || c.businessName?.trim(),
      'Enter a business name.',
    );
    assert(
      !c.email || emailValid(c.email),
      'Enter a valid email or leave it blank.',
    );
    assert(
      ['AUD', 'EUR'].includes(c.defaultCurrency),
      'Choose a supported native currency.',
    );
    assert(
      /^\d{1,3}$/.test(String(c.paymentTerms)),
      'Payment terms must be 0–999 days.',
    );
    const previous = payload.id
      ? data.clients.find(
          (c) => c.id === payload.id && c.workspaceId === workspaceId,
        )
      : null;
    assert(!payload.id || previous, 'Client not found in this workspace.');
    const client = {
      ...c,
      name: c.name.trim(),
      id: previous?.id || id('client'),
      workspaceId,
      archived: previous?.archived || false,
    };
    data.clients = previous
      ? data.clients.map((c) => (c.id === previous.id ? client : c))
      : [...data.clients, client];
    result = client.id;
  } else if (action === 'archiveClient') {
    const client = data.clients.find(
      (c) => c.id === payload.id && c.workspaceId === workspaceId,
    );
    assert(client, 'Client not found in this workspace.');
    client.archived = true;
    result = client.id;
  } else if (action === 'saveTemplate') {
    const template = payload.template;
    assert(template.name?.trim(), 'Enter a template name.');
    assert(
      ['monthly', 'weekly', 'quarterly'].includes(template.frequency),
      'Choose a frequency.',
    );
    assert(
      validDate(template.nextDate) && template.nextDate >= data.asOf,
      'Next preparation date must be on or after the sample date.',
    );
    validateInvoice(data, workspaceId, {
      ...template,
      number: nextNumber(data, workspaceId),
      issuedDate: data.asOf,
      dueDate: addDays(data.asOf, Number(template.paymentTerms)),
    });
    result = id('rule');
    data.recurringRules.push({
      ...template,
      id: result,
      workspaceId,
      status: 'review-only',
      preparedDates: [],
    });
  } else if (action === 'prepareRecurring') {
    const rule = data.recurringRules.find(
      (r) => r.id === payload.id && r.workspaceId === workspaceId,
    );
    assert(rule, 'Template not found.');
    assert(
      rule.nextDate <= data.asOf,
      'This template is not due yet. No background job is running.',
    );
    assert(
      !rule.preparedDates.includes(rule.nextDate),
      'This cycle has already been prepared.',
    );
    const draft = {
      ...rule,
      number: nextNumber(data, workspaceId),
      issuedDate: rule.nextDate,
      dueDate: addDays(rule.nextDate, Number(rule.paymentTerms)),
    };
    const saved = applyIncomeCommand(data, context, 'saveInvoice', { draft });
    const next = saved.data.recurringRules.find((r) => r.id === rule.id);
    next.preparedDates.push(rule.nextDate);
    next.nextDate = addDays(
      rule.nextDate,
      rule.frequency === 'weekly' ? 7 : rule.frequency === 'monthly' ? 30 : 90,
    );
    return saved;
  } else throw new Error('Unsupported income operation.');
  return { data: refreshInvoices(data), result };
}
export function createFinancialStore(seed) {
  let snapshot = structuredClone(seed);
  const listeners = new Set();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    command(context, action, payload) {
      const changed = action.startsWith('settings:')
        ? applySettingsCommand(snapshot, context, action.slice(9), payload)
        : action.startsWith('investment:')
          ? applyInvestmentCommand(snapshot, context, action.slice(11), payload)
          : action.startsWith('expense:')
            ? applyExpenseCommand(snapshot, context, action.slice(8), payload)
            : applyIncomeCommand(snapshot, context, action, payload);
      notifyFinancialCommand(changed.data, context, action);
      snapshot = changed.data;
      listeners.forEach((fn) => fn());
      return changed.result;
    },
  };
}
