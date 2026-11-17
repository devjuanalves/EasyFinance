// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspaceContext } from '../../finance/WorkspaceContext.js';
import {
  financialData,
  DEFAULT_FILTERS,
} from '../../finance/data/financialData.js';
import InvoiceItems from '../components/InvoiceItems.jsx';
import InvoicePreview from '../components/InvoicePreview.jsx';
import ClientForm from '../components/ClientForm.jsx';
import { applyIncomeCommand } from '../incomeService.js';
afterEach(cleanup);
function ItemHarness() {
  const [items, setItems] = useState([
    {
      description: 'Service',
      quantity: '1',
      unit: 'hours',
      unitPrice: '10',
      taxRate: '0',
    },
  ]);
  return <InvoiceItems items={items} onChange={setItems} currency="AUD" />;
}
it('updates fractional item amounts and adds/removes accessible item fields', async () => {
  const user = userEvent.setup();
  render(<ItemHarness />);
  await user.clear(screen.getByLabelText('Quantity 1'));
  await user.type(screen.getByLabelText('Quantity 1'), '2.5');
  expect(screen.getByText(/AUD.*25.00/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: '＋ Add Item' }));
  expect(screen.getByLabelText('Description 2')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Remove item 2' }));
  expect(screen.queryByLabelText('Description 2')).toBeNull();
});
it('previews actual invoice items, captured client and payment totals', () => {
  const invoice = financialData.invoices[0];
  render(
    <InvoicePreview
      invoice={invoice}
      client={invoice.clientSnapshot}
      items={financialData.invoiceItems.filter(
        (i) => i.invoiceId === invoice.id,
      )}
    />,
  );
  expect(screen.getByRole('heading', { name: 'INV-2026-001' })).toBeVisible();
  expect(screen.getByText('Monthly design retainer')).toBeVisible();
  expect(screen.getByText('Acme Studio Pty Ltd')).toBeVisible();
  expect(screen.getByText('Outstanding').nextSibling).toHaveTextContent('0.00');
  expect(screen.queryByText('Configured tax')).toBeNull();
});
it('announces client validation and saves a valid contact without requiring a tax identifier', async () => {
  const user = userEvent.setup(),
    saved = vi.fn();
  render(
    <WorkspaceContext.Provider
      value={{
        canEdit: true,
        command: (action, payload) =>
          applyIncomeCommand(financialData, DEFAULT_FILTERS, action, payload)
            .result,
      }}
    >
      <ClientForm onSaved={saved} />
    </WorkspaceContext.Provider>,
  );
  await user.click(screen.getByRole('button', { name: 'Save client' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a client name');
  await user.type(screen.getByLabelText('Client name'), 'Example');
  await user.type(screen.getByLabelText('Business name'), 'Example Co');
  await user.type(screen.getByLabelText('Email'), 'invalid');
  await user.click(screen.getByRole('button', { name: 'Save client' }));
  expect(screen.getByRole('alert')).toHaveTextContent('valid email');
  await user.clear(screen.getByLabelText('Email'));
  await user.type(screen.getByLabelText('Email'), 'demo@example.com');
  await user.click(screen.getByRole('button', { name: 'Save client' }));
  expect(saved).toHaveBeenCalledOnce();
});

it('prints a cancelled document with no collectible balance', () => {
  const invoice = financialData.invoices.find(
    (i) => i.lifecycle === 'cancelled',
  );
  render(
    <InvoicePreview
      invoice={invoice}
      client={invoice.clientSnapshot}
      items={financialData.invoiceItems.filter(
        (i) => i.invoiceId === invoice.id,
      )}
    />,
  );
  expect(screen.getByText(/Cancelled — no amount is due/)).toBeVisible();
  expect(screen.getByText('Outstanding').nextSibling).toHaveTextContent('0.00');
});

it('exports cancelled invoices with zero outstanding and neutralizes formula cells', async () => {
  const { exportInvoices } = await import('../documentActions.js');
  let file;
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((blob) => {
      file = blob;
      return 'blob:invoice-export';
    }),
    revokeObjectURL: vi.fn(),
  });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  const timer = vi
    .spyOn(globalThis, 'setTimeout')
    .mockImplementation((callback) => {
      callback();
      return 0;
    });
  try {
    exportInvoices(
      [
        {
          number: '=UNSAFE',
          clientId: 'client',
          issuedDate: '2026-10-01',
          dueDate: '2026-10-31',
          currency: 'AUD',
          total: 80000,
          paid: 0,
          lifecycle: 'cancelled',
          status: 'cancelled',
        },
      ],
      [{ id: 'client', name: 'Client' }],
    );
    const csv = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(file);
    });
    expect(csv).toContain('"\'=UNSAFE"');
    expect(csv).toContain('"800.00","0.00","cancelled"');
    expect(click).toHaveBeenCalledOnce();
  } finally {
    timer.mockRestore();
    click.mockRestore();
    vi.unstubAllGlobals();
  }
});
