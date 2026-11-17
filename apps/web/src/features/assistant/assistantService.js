import { portfolio } from '../investments/investmentMath.js';
import { displayMoney } from '../investments/format.js';
import { summarize, money, dateLabel } from '../finance/data/calculations.js';
export const suggestedQuestions = [
  'How much did I spend this month?',
  'How much money did I earn?',
  'What is my current balance?',
  'What are my biggest expense categories?',
  'Do I have any unpaid invoices?',
  'How much did I save this month?',
];
export function answerQuestion(question, data, filters) {
  const summary = summarize(data, filters);
  const format = (n) => money(n, filters.currency);
  const q = question.toLowerCase().trim();
  if (/invest|portfolio|holding|allocation|contribution/.test(q)) {
    const end = [summary.period.end, data.coverageEnd].sort()[0];
    const p = portfolio(data, filters, { start: summary.period.start, end });
    const largest = [...p.holdings]
      .filter((i) => i.position.currentValue !== null)
      .sort((a, b) => b.position.currentValue - a.position.currentValue)[0];
    const latest = p.activity.find((m) =>
      ['buy', 'contribution'].includes(m.type),
    );
    const text = /largest|allocation/.test(q)
      ? p.missing
        ? 'Largest allocation is unavailable until all selected holdings have comparable valuations.'
        : largest
          ? `${largest.name} is the largest holding at ${format(largest.position.currentValue)}.`
          : 'No investment holdings for this selection.'
      : /latest.*contribution/.test(q)
        ? latest
          ? `Latest recorded capital addition in this period: ${format(latest.amount)} to ${latest.investment.name} on ${dateLabel(latest.date)}.`
          : 'No capital additions in this period.'
        : `Your manually recorded portfolio value is ${displayMoney(p.currentValue, filters.currency)} with ${format(p.basis)} remaining cost basis. Unrealized gains are not received income.`;
    return {
      text,
      summary,
      currency: filters.currency,
      portfolio: p,
      context: `As of ${dateLabel(end)} · ${filters.currency} · all investment accounts in this workspace; cash-account and participant filters do not allocate holdings`,
      source: 'Shared manual investment records; no live prices',
      partial: !summary.complete,
    };
  }
  let text;
  if (/spend|spent/.test(q) && !/categor/.test(q))
    text = `You spent ${format(summary.expenses)} across ${summary.rows.filter((t) => t.type === 'expense').length} expense transactions.`;
  else if (/earn|income/.test(q))
    text = `Your recorded income is ${format(summary.income)}. Invoice issuance is not counted as income.`;
  else if (/balance/.test(q))
    text =
      summary.balance === null
        ? 'Account balance is unavailable for participant-specific or incomplete data.'
        : `Your closing account balance is ${format(summary.balance)}, including the explicit opening balance and all valid account movements. Net cash flow for this period is ${format(summary.net)}.`;
  else if (/categor/.test(q))
    text = summary.categories.length
      ? `Your largest expense category is ${summary.categories[0].name}: ${format(summary.categories[0].amount)}.`
      : 'There are no expense categories for this selection.';
  else if (/invoice|unpaid/.test(q))
    text = `${summary.invoices.length} invoices issued in this period have ${format(summary.outstanding)} outstanding as of 31 October 2026. These are not additional income transactions.`;
  else if (/sav/.test(q))
    text = `Your net cash flow is ${format(summary.net)}. ${summary.savingsRate === null ? 'Savings rate is unavailable because income is zero.' : `Savings rate: ${summary.savingsRate.toFixed(1)}%.`}`;
  else
    text =
      'This question isn’t supported in the current demo. Try asking about spending, income, balance, categories, unpaid invoices or savings.';
  return {
    text,
    summary,
    currency: filters.currency,
    context: `${dateLabel(summary.period.start)} – ${dateLabel(summary.period.end)} · ${filters.currency} · ${filters.accountId} · participant: ${filters.participantId}`,
    source: summary.source,
    partial: !summary.complete,
  };
}
export async function askAssistant(
  question,
  data,
  filters,
  { retry = false } = {},
) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (question.trim().toLowerCase() === '/demo-error' && !retry)
    throw new Error('Simulated assistant interruption. Retry this message.');
  return answerQuestion(
    question === '/demo-error' ? 'How much did I spend this month?' : question,
    data,
    filters,
  );
}
export function initialConversations(data, filters) {
  return [
    {
      id: 'spending',
      title: 'Monthly spending analysis',
      messages: [
        { id: 'seed-u', role: 'user', text: suggestedQuestions[0] },
        {
          id: 'seed-a',
          role: 'assistant',
          response: answerQuestion(suggestedQuestions[0], data, filters),
        },
      ],
    },
    {
      id: 'invoices',
      title: 'Unpaid invoices',
      messages: [
        { id: 'invoice-u', role: 'user', text: suggestedQuestions[4] },
        {
          id: 'invoice-a',
          role: 'assistant',
          response: answerQuestion(suggestedQuestions[4], data, filters),
        },
      ],
    },
  ];
}
