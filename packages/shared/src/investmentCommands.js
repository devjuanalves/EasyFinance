import {
  ASSET_TYPES,
  CURRENCIES,
  requireValue as check,
  decimal,
  cents,
  initialAmounts,
  quantityBased,
  positionAt,
  capitalSignature,
  investmentDate,
} from './investmentMath.js';
export function applyInvestmentCommand(
  original,
  context,
  action,
  payload = {},
) {
  check(
    ['owner', 'editor'].includes(context.role || 'owner'),
    'This workspace is read-only.',
  );
  check(
    !context.scenario || context.scenario === 'normal',
    'Switch to normal sample data before editing.',
  );
  check(
    original.workspaces.some((w) => w.id === context.workspaceId),
    'Workspace not found.',
  );
  const data = structuredClone(original);
  const order = () => (data.nextId = (data.nextId || 1000) + 1);
  const next = (prefix) =>
    context.newId ? context.newId() : `${prefix}-${order()}`;
  const get = (id) => {
    const item = data.investments.find(
      (i) => i.id === id && i.workspaceId === context.workspaceId,
    );
    check(item, 'Investment not found in this workspace.');
    return item;
  };
  const audit = (investmentId, type, before, after) =>
    data.investmentEvents.push({
      id: next('investment-event'),
      investmentId,
      workspaceId: context.workspaceId,
      type,
      before: before ? structuredClone(before) : null,
      after: after ? structuredClone(after) : null,
      date: data.asOf,
    });
  const accountFor = (id, currency) => {
    const a = data.investmentAccounts.find(
      (a) =>
        a.id === id && a.workspaceId === context.workspaceId && !a.archived,
    );
    check(
      a && a.currency === currency,
      'Select an investment account with matching currency in this workspace.',
    );
    return a;
  };
  function movement(investment, form, previous) {
    const type = form.type;
    const allowed = quantityBased(investment)
      ? [
          'buy',
          'sell',
          'contribution',
          'withdrawal',
          'dividend',
          'interest',
          'fee',
        ]
      : ['contribution', 'withdrawal', 'dividend', 'interest', 'fee'];
    check(
      allowed.includes(type),
      'Movement type is not supported for this asset.',
    );
    check(
      form.currency === investment.currency,
      'Movement currency must match the investment.',
    );
    const date = investmentDate(form.date, data, investment.openedAt),
      fee = cents(form.fee, 'Fee');
    let amount,
      quantity = null,
      unitPrice = null;
    if (
      quantityBased(investment) &&
      ['buy', 'sell', 'contribution', 'withdrawal'].includes(type)
    ) {
      quantity = String(form.quantity).trim();
      check(
        decimal(quantity, 8, 'Quantity') > 0n,
        'Quantity must be greater than zero.',
      );
      if (type === 'withdrawal') amount = 0;
      else {
        unitPrice = String(form.unitPrice).trim();
        amount = initialAmounts({
          ...form,
          assetType: investment.assetType,
        }).amount;
      }
    } else {
      amount = cents(form.amount);
      check(amount > 0, 'Amount must be greater than zero.');
    }
    check(
      type !== 'fee' || fee === 0,
      'Enter a standalone fee as Amount; extra Fee must be zero.',
    );
    check(
      !['sell', 'dividend', 'interest'].includes(type) || fee <= amount,
      'Fee cannot exceed proceeds or distribution.',
    );
    return {
      id: previous?.id || next('movement'),
      investmentId: investment.id,
      workspaceId: investment.workspaceId,
      currency: investment.currency,
      date,
      type,
      quantity,
      unitPrice,
      amount,
      fee,
      notes: String(form.notes || '').trim(),
      order: previous?.order || order(),
      revision: context.revision
        ? context.revision(previous)
        : (previous?.revision || 0) + 1,
    };
  }
  function valuation(investment, form) {
    check(
      form.currency === investment.currency,
      'Valuation currency must match the investment.',
    );
    const valuedAt = investmentDate(form.valuedAt, data, investment.openedAt),
      estimatedValue = cents(form.estimatedValue, 'Estimated value');
    const p = positionAt(data, investment, valuedAt);
    check(
      !p.closed || estimatedValue === 0,
      'A closed position can only have a zero valuation.',
    );
    const v = {
      id: next('valuation'),
      investmentId: investment.id,
      workspaceId: investment.workspaceId,
      valuedAt,
      estimatedValue,
      currency: investment.currency,
      source: 'manual',
      createdBy:
        context.participantId === 'all' ? 'demo-user' : context.participantId,
      notes: String(form.notes || ''),
      order: order(),
      capitalSignature: capitalSignature(data, investment.id, valuedAt),
    };
    data.investmentValuations.push(v);
    audit(investment.id, 'Valuation recorded', null, v);
    return v.id;
  }
  let result;
  if (action === 'createAccount') {
    check(
      String(payload.name || '').trim() &&
        String(payload.institution || '').trim(),
      'Account name and institution are required.',
    );
    check(CURRENCIES.includes(payload.currency), 'Unsupported currency.');
    const a = {
      id: next('investment-account'),
      workspaceId: context.workspaceId,
      name: payload.name.trim(),
      institution: payload.institution.trim(),
      currency: payload.currency,
      archived: false,
    };
    data.investmentAccounts.push(a);
    result = a.id;
  } else if (action === 'create' || action === 'update') {
    const f = payload.form;
    check(f && String(f.name || '').trim(), 'Investment name is required.');
    check(ASSET_TYPES.includes(f.assetType), 'Select a valid asset type.');
    check(CURRENCIES.includes(f.currency), 'Unsupported currency.');
    accountFor(f.investmentAccountId, f.currency);
    check(
      f.assetType !== 'Custom' || String(f.customType || '').trim(),
      'Custom category name is required.',
    );
    if (action === 'create') {
      const investment = {
        id: next('investment'),
        workspaceId: context.workspaceId,
        name: f.name.trim(),
        assetType: f.assetType,
        customType: f.customType || '',
        symbol: f.symbol || '',
        currency: f.currency,
        investmentAccountId: f.investmentAccountId,
        openedAt: investmentDate(f.date, data),
        notes: f.notes || '',
        tags: f.tags || '',
        interestInfo: f.interestInfo || '',
        archived: false,
      };
      data.investments.push(investment);
      const m = movement(investment, {
        ...f,
        type: quantityBased(investment) ? 'buy' : 'contribution',
      });
      data.investmentMovements.push(m);
      positionAt(data, investment);
      audit(investment.id, 'Investment created', null, investment);
      audit(investment.id, 'Initial movement', null, m);
      if (String(f.estimatedValue ?? '').trim() !== '')
        valuation(investment, { ...f, valuedAt: f.valuedAt });
      result = investment.id;
    } else {
      const i = get(payload.id),
        before = structuredClone(i);
      check(
        i.currency === f.currency && i.assetType === f.assetType,
        'Currency and asset type cannot rewrite historical records.',
      );
      Object.assign(i, {
        name: f.name.trim(),
        investmentAccountId: f.investmentAccountId,
        symbol: f.symbol || '',
        customType: f.customType || '',
        notes: f.notes || '',
        tags: f.tags || '',
        interestInfo: f.interestInfo || '',
      });
      audit(i.id, 'Metadata updated', before, i);
      result = i.id;
    }
  } else if (
    action === 'recordMovement' ||
    action === 'editMovement' ||
    action === 'deleteMovement'
  ) {
    const i = get(payload.id);
    const previous = data.investmentMovements.find(
      (m) =>
        m.id === payload.movementId && m.investmentId === i.id && !m.deleted,
    );
    if (action !== 'recordMovement') {
      check(previous, 'Activity not found.');
      check(
        payload.confirmed === true,
        'Confirm this historical correction first.',
      );
    }
    const before = previous ? structuredClone(previous) : null;
    if (action === 'deleteMovement') previous.deleted = true;
    else {
      const m = movement(i, payload.form, previous);
      if (previous) Object.assign(previous, m);
      else data.investmentMovements.push(m);
      result = m.id;
    }
    positionAt(data, i); // Replay the complete dated history before publishing, including later sales.
    audit(
      i.id,
      action === 'deleteMovement'
        ? 'Activity deleted'
        : action === 'editMovement'
          ? 'Activity corrected'
          : 'Movement recorded',
      before,
      action === 'deleteMovement'
        ? previous
        : data.investmentMovements.find((m) => m.id === result),
    );
  } else if (action === 'deleteValuation') {
    const i = get(payload.id),
      v = data.investmentValuations.find(
        (v) =>
          v.id === payload.valuationId && v.investmentId === i.id && !v.deleted,
      );
    check(
      v && payload.confirmed === true,
      'Confirm deletion of a valid valuation.',
    );
    const before = structuredClone(v);
    v.deleted = true;
    audit(i.id, 'Valuation deleted', before, v);
  } else if (action === 'valuation')
    result = valuation(get(payload.id), payload.form);
  else throw new Error('Unsupported investment operation.');
  return { data, result };
}
export function blankInvestment(data, context) {
  const currency = ['AUD', 'EUR', 'USD'].includes(context.currency)
    ? context.currency
    : 'AUD';
  return {
    name: '',
    assetType: 'ETFs',
    customType: '',
    symbol: '',
    investmentAccountId:
      data.investmentAccounts.find(
        (a) =>
          a.workspaceId === context.workspaceId &&
          a.currency === currency &&
          !a.archived,
      )?.id || '',
    currency,
    date: data.asOf,
    quantity: '',
    unitPrice: '',
    fee: '0',
    amount: '',
    estimatedValue: '',
    valuedAt: data.asOf,
    notes: '',
    tags: '',
    interestInfo: '',
  };
}
