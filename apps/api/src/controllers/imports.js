import { imports } from '../services/imports.js';
import { importInput } from '../validation/imports.js';
import { id } from '../validation/contracts.js';
export function importControllers(db) {
  const s = imports(db);
  const wrap = (fn) => async (req, res, next) => {
    try {
      res.json({ data: await fn(req) });
    } catch (e) {
      next(e);
    }
  };
  return {
    preview: wrap((r) =>
      s.preview(r.auth, id(r.params.wid), importInput(r.body)),
    ),
    confirm: wrap((r) =>
      s.confirm(r.auth, id(r.params.wid), importInput(r.body, true)),
    ),
    list: wrap((r) => s.list(r.auth, id(r.params.wid))),
    read: wrap((r) => s.read(r.auth, id(r.params.wid), id(r.params.id))),
  };
}
