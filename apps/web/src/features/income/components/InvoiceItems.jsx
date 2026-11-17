import { Field } from './IncomeUI.jsx';
import { invoiceTotals } from '../../finance/data/invoiceMath.js';
import { money } from '../../finance/data/calculations.js';
export default function InvoiceItems({ items, onChange, currency }) {
  function change(index, name, value) {
    onChange(
      items.map((item, i) => (i === index ? { ...item, [name]: value } : item)),
    );
  }
  return (
    <section className="finance-card invoice-item-editor">
      <div className="section-heading">
        <h2>Line Items</h2>
        <span>{items.length} items</span>
      </div>
      {items.map((item, index) => {
        let total;
        try {
          total = invoiceTotals([item]).total;
        } catch {
          total = null;
        }
        return (
          <fieldset className="invoice-item" key={index}>
            <legend>Item {index + 1}</legend>
            <Field
              label={`Description ${index + 1}`}
              value={item.description}
              onChange={(e) => change(index, 'description', e.target.value)}
            />
            <Field
              label={`Quantity ${index + 1}`}
              inputMode="decimal"
              value={item.quantity}
              onChange={(e) => change(index, 'quantity', e.target.value)}
            />
            <Field
              label={`Unit ${index + 1}`}
              value={item.unit}
              onChange={(e) => change(index, 'unit', e.target.value)}
            />
            <Field
              label={`Unit price ${index + 1}`}
              inputMode="decimal"
              value={item.unitPrice}
              onChange={(e) => change(index, 'unitPrice', e.target.value)}
            />
            <Field
              label={`Tax rate ${index + 1} (%)`}
              inputMode="decimal"
              value={item.taxRate}
              onChange={(e) => change(index, 'taxRate', e.target.value)}
            />
            <div className="line-total">
              <span>Line total before discount</span>
              <strong>
                {total === null ? 'Invalid amount' : money(total, currency)}
              </strong>
            </div>
            <button
              type="button"
              className="text-button"
              aria-label={`Remove item ${index + 1}`}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </fieldset>
        );
      })}
      <button
        type="button"
        className="compact-button"
        onClick={() =>
          onChange([
            ...items,
            {
              description: '',
              quantity: '1',
              unit: 'hours',
              unitPrice: '0',
              taxRate: '0',
            },
          ])
        }
      >
        ＋ Add Item
      </button>
      <p className="muted">
        Up to 4 decimal places for quantities/prices and tax rates. Tax defaults
        to zero.
      </p>
    </section>
  );
}
