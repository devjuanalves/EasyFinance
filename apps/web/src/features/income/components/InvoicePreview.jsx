import { money, dateLabel } from '../../finance/data/calculations.js';
import { invoiceTotals } from '../../finance/data/invoiceMath.js';
import logo from '../../../assets/brand/color.svg';
export function InvoiceTotals({ totals, currency, paid, cancelled = false }) {
  return (
    <dl className="invoice-totals">
      <div>
        <dt>Subtotal</dt>
        <dd>{money(totals.subtotal, currency)}</dd>
      </div>
      <div>
        <dt>Discount</dt>
        <dd>−{money(totals.discount, currency)}</dd>
      </div>
      {totals.tax > 0 && (
        <div>
          <dt>Configured tax</dt>
          <dd>{money(totals.tax, currency)}</dd>
        </div>
      )}
      <div className="invoice-total">
        <dt>Total</dt>
        <dd>{money(totals.total, currency)}</dd>
      </div>
      {paid !== undefined && (
        <>
          <div>
            <dt>Received</dt>
            <dd>{money(paid, currency)}</dd>
          </div>
          <div>
            <dt>Outstanding</dt>
            <dd>{money(cancelled ? 0 : totals.total - paid, currency)}</dd>
          </div>
        </>
      )}
    </dl>
  );
}
export default function InvoicePreview({ invoice, client, items }) {
  let totals;
  try {
    totals = invoiceTotals(items, invoice.discount);
  } catch {
    return (
      <div className="finance-card" role="status">
        Complete valid amounts to preview this invoice.
      </div>
    );
  }
  return (
    <article className="invoice-preview">
      {invoice.lifecycle === 'cancelled' && (
        <p className="partial-banner">
          Cancelled — no amount is due under this document.
        </p>
      )}
      <header>
        <img src={logo} alt="EasyFinance" />
        <div>
          <span>INVOICE · DEMO</span>
          <h2>{invoice.number || 'Unnumbered draft'}</h2>
          <p>
            Issue: {dateLabel(invoice.issuedDate)}
            <br />
            Due: {dateLabel(invoice.dueDate)}
          </p>
        </div>
      </header>
      <div className="invoice-billto">
        <p>
          <small>BILLED TO</small>
          <strong>
            {client?.businessName || client?.name || 'Select a client'}
          </strong>
          {client?.name}
          <br />
          {client?.email}
          <br />
          {client?.address}
          {client?.taxId && (
            <>
              <br />
              Tax identifier: {client.taxId} (supplied, not verified)
            </>
          )}
        </p>
        <p>
          <small>PAYMENT TERMS</small>Net {invoice.paymentTerms || '0'} days
          <br />
          {invoice.currency} · no currency conversion
        </p>
      </div>
      <table>
        <caption className="sr-only">Invoice line items</caption>
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty / Unit</th>
            <th>Unit price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {totals.lines.map((item, index) => (
            <tr key={index}>
              <td data-label="Description">
                {item.description || 'Item description'}
                {Number(item.taxRate) > 0 && (
                  <small>Tax: {item.taxRate}%</small>
                )}
              </td>
              <td data-label="Quantity / unit">
                {item.quantity} {item.unit}
              </td>
              <td data-label="Unit price">
                {invoice.currency} {item.unitPrice}
              </td>
              <td data-label="Amount">{money(item.base, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="invoice-preview-bottom">
        <div>
          <h3>Notes & payment instructions</h3>
          <p>{invoice.notes}</p>
          <p>{invoice.paymentInstructions}</p>
        </div>
        <InvoiceTotals
          totals={totals}
          currency={invoice.currency}
          paid={invoice.paid}
          cancelled={invoice.lifecycle === 'cancelled'}
        />
      </div>
      <footer>
        Fictional demonstration document · Not proof of payment or email
        delivery
      </footer>
    </article>
  );
}
