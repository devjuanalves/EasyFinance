export function extendExpenseFixture(data) {
  return {
    ...data,
    categories: data.categories.map((c, i) => ({
      ...c,
      workspaceId: 'personal',
      kind:
        c.id === 'income'
          ? 'income'
          : c.id === 'transfer'
            ? 'transfer'
            : 'expense',
      icon: ['home', 'expenses', 'attach'][i % 3],
      color: ['#E43900', '#08864E', '#6A6A6A'][i % 3],
      archived: false,
    })),
    transactions: data.transactions.map((t) => ({
      ...t,
      originalDescription: t.description,
      originalAmount: t.amount,
      originalSource: 'fixture',
      source: 'fixture',
      reviewStatus:
        !t.categoryId || t.possibleDuplicate ? 'pending' : 'reviewed',
      manualCategory: false,
      excluded: false,
    })),
    transactionSplits: [],
    transactionTransfers: [
      {
        id: 'transfer-fixture',
        workspaceId: 'personal',
        outgoingId: 't1',
        incomingId: 't2',
      },
    ],
    importBatches: [],
    attachments: [],
    transactionEvents: [],
    categoryRules: [
      {
        id: 'category-rule-1',
        workspaceId: 'personal',
        name: 'Woolworths groceries',
        field: 'description',
        operator: 'contains',
        value: 'woolworths',
        categoryId: 'groceries',
        priority: 10,
        enabled: true,
      },
    ],
    expenseRecurrence: [
      {
        id: 'recurrence-1',
        workspaceId: 'personal',
        transactionIds: ['o10'],
        frequency: 'Monthly',
        nextDate: '2026-11-15',
        confirmed: false,
      },
    ],
  };
}
