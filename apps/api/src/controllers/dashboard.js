import { dashboard } from '../services/dashboard.js';
import { categories } from '../services/categories.js';
import { dashboardFilters, categoryInput } from '../validation/dashboard.js';
import { id } from '../validation/contracts.js';
export function dashboardControllers(db) {
  const summary = dashboard(db),
    write = categories(db);
  const wrap = (fn) => async (req, res, next) => {
    try {
      res.json({ data: await fn(req) });
    } catch (e) {
      next(e);
    }
  };
  return {
    summary: wrap((r) =>
      summary(r.auth, id(r.params.wid), dashboardFilters(r.query)),
    ),
    create: wrap((r) =>
      write(r.auth, id(r.params.wid), categoryInput(r.body, true)),
    ),
    edit: wrap((r) =>
      write(r.auth, id(r.params.wid), categoryInput(r.body), id(r.params.id)),
    ),
    archive: wrap((r) =>
      write(
        r.auth,
        id(r.params.wid),
        categoryInput(r.body, false, true),
        id(r.params.id),
        true,
      ),
    ),
  };
}
