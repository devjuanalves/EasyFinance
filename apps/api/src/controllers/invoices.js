import * as v from '../validation/contracts.js';
import {
  clientInput,
  draftInput,
  paymentInput,
  invoiceFilters,
} from '../validation/invoices.js';
import { invoices } from '../services/invoices.js';
export function invoiceControllers(db) {
  const s = invoices(db),
    send = (fn) => async (req, res) => res.json({ data: await fn(req) }),
    w = (r) => v.id(r.params.wid),
    id = (r) => v.id(r.params.id);
  return {
    clients: send((r) => {
      v.shape(r.query, []);
      return s.clients(r.auth, w(r));
    }),
    clientCreate: send((r) =>
      s.saveClient(r.auth, w(r), clientInput(r.body, true)),
    ),
    clientEdit: send((r) =>
      s.saveClient(r.auth, w(r), clientInput(r.body), id(r)),
    ),
    archive: send((r) => {
      v.shape(r.body, ['archived']);
      if (typeof r.body.archived !== 'boolean') v.fail();
      return s.archive(r.auth, w(r), id(r), r.body.archived);
    }),
    list: send((r) => s.list(r.auth, w(r), invoiceFilters(r.query))),
    read: send((r) => s.read(r.auth, w(r), id(r))),
    create: send((r) => s.save(r.auth, w(r), draftInput(r.body))),
    edit: send((r) => s.save(r.auth, w(r), draftInput(r.body, false), id(r))),
    issue: send((r) => {
      v.shape(r.body, ['version']);
      return s.transition(
        r.auth,
        w(r),
        id(r),
        v.integer(r.body.version, 1, 2147483646),
        'issue',
      );
    }),
    cancel: send((r) => {
      v.shape(r.body, ['version']);
      return s.transition(
        r.auth,
        w(r),
        id(r),
        v.integer(r.body.version, 1, 2147483646),
        'cancel',
      );
    }),
    duplicate: send((r) => {
      v.shape(r.body, ['id', 'number']);
      return s.duplicate(r.auth, w(r), id(r), {
        id: v.id(r.body.id),
        number: v.text(r.body.number, 100),
      });
    }),
    payment: send((r) => s.payment(r.auth, w(r), id(r), paymentInput(r.body))),
    readPayment: send((r) => s.readPayment(r.auth, w(r), id(r))),
    summary: send((r) =>
      s.summary(r.auth, w(r), invoiceFilters(r.query, true)),
    ),
  };
}
