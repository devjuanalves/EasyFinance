import { investmentControllers } from '../controllers/investments.js';
import { importControllers } from '../controllers/imports.js';
import { invoiceControllers } from '../controllers/invoices.js';
import { Router } from 'express';
import { controllers } from '../controllers/v1.js';
import { authenticate } from '../middleware/authentication.js';
import { csrf, rateLimit } from '../security/http.js';
import { shape } from '../validation/contracts.js';
export function v1Router(db, config) {
  const r = Router(),
    c = controllers(db, config);
  r.use(csrf(config.webOrigin));
  r.use((req, _res, next) => {
    if (req.method !== 'GET') shape(req.query, []);
    next();
  });
  r.use((req, _res, next) => {
    if (
      ![
        '/transactions',
        '/accounts',
        '/expenses/summary',
        '/invoices',
        '/income/summary',
        '/clients',
      ].some((s) => req.path.endsWith(s))
    )
      shape(req.query, []);
    next();
  });
  const authRate = rateLimit(),
    emailRate = rateLimit({
      limit: 10,
      key: (req) =>
        String(req.body?.email || '')
          .trim()
          .toLowerCase(),
    });
  r.post('/auth/register', authRate, emailRate, c.register);
  r.post('/auth/login', authRate, emailRate, c.login);
  r.post('/auth/recovery', authRate, emailRate, c.recovery);
  r.use(authenticate(db));
  r.get('/auth/session', c.session);
  r.post('/auth/logout', c.logout);
  r.post('/auth/password', authRate, c.password);
  r.get('/workspaces', c.workspaces);
  r.post('/onboarding', c.onboarding);
  const p = '/workspaces/:wid';
  r.get(p + '/members', c.members);
  r.patch(p + '/members/:id', c.member);
  r.get(p + '/accounts', c.accounts);
  r.get(p + '/accounts/:id', c.account);
  r.get(p + '/categories', c.categories);
  r.get(p + '/transactions', c.transactions);
  r.post(p + '/transactions', c.create);
  r.get(p + '/transactions/:id', c.transaction);
  r.patch(p + '/transactions/:id', c.update);
  r.post(p + '/transactions/:id/exclusion', c.exclusion);
  r.get(p + '/expenses/summary', c.summary);
  const i = invoiceControllers(db);
  r.get(p + '/clients', i.clients);
  r.post(p + '/clients', i.clientCreate);
  r.patch(p + '/clients/:id', i.clientEdit);
  r.post(p + '/clients/:id/archive', i.archive);
  r.get(p + '/invoices', i.list);
  r.post(p + '/invoices', i.create);
  r.get(p + '/invoices/:id', i.read);
  r.patch(p + '/invoices/:id', i.edit);
  r.post(p + '/invoices/:id/issue', i.issue);
  r.post(p + '/invoices/:id/cancel', i.cancel);
  r.post(p + '/invoices/:id/duplicate', i.duplicate);
  r.post(p + '/invoices/:id/payments', i.payment);
  r.get(p + '/payments/:id', i.readPayment);
  r.get(p + '/income/summary', i.summary);
  const imp = importControllers(db);
  r.post(p + '/imports/preview', imp.preview);
  r.post(p + '/imports', imp.confirm);
  r.get(p + '/imports', imp.list);
  r.get(p + '/imports/:id', imp.read);
  r.patch(p + '/transactions/:id/category', c.categorize);
  const inv = investmentControllers(db);
  r.get(p + '/investments', inv.list);
  r.post(p + '/investments/commands', inv.command);
  return r;
}
