import { csvText } from '../../services/csvExport.js';
export function printInvoice(element) {
  if (!element) return;
  const printRoot = document.createElement('section');
  printRoot.className = 'invoice-print-root';
  printRoot.append(element.cloneNode(true));
  document.body.append(printRoot);
  document.body.classList.add('printing-invoice');
  // Native modal dialogs remain in the top layer, even when a print clone is used.
  const dialogs = [...document.querySelectorAll('dialog[open]')];
  dialogs.forEach((dialog) => dialog.classList.add('invoice-print-hidden'));
  try {
    window.print();
  } finally {
    printRoot.remove();
    document.body.classList.remove('printing-invoice');
    dialogs.forEach((dialog) =>
      dialog.classList.remove('invoice-print-hidden'),
    );
  }
}
export function exportInvoices(invoices, clients) {
  const rows = [
    [
      'Invoice',
      'Client',
      'Issue date',
      'Due date',
      'Currency',
      'Total',
      'Outstanding',
      'Status',
    ],
    ...invoices.map((i) => [
      i.number,
      clients.find((c) => c.id === i.clientId)?.name,
      i.issuedDate,
      i.dueDate,
      i.currency,
      (i.total / 100).toFixed(2),
      ((i.lifecycle === 'cancelled' ? 0 : i.total - i.paid) / 100).toFixed(2),
      i.status,
    ]),
  ];
  const blob = new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = 'easyfinance-invoices.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
