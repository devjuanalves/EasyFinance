import { investments } from '../services/investments.js';
import { investmentInput } from '../validation/investments.js';
import { id } from '../validation/contracts.js';
export function investmentControllers(db) {
  const s = investments(db);
  const wrap = (fn) => async (req, res, next) => {
    try {
      res.json({ data: await fn(req) });
    } catch (e) {
      next(e);
    }
  };
  return {
    list: wrap((r) => s.list(r.auth, id(r.params.wid))),
    command: wrap((r) =>
      s.command(r.auth, id(r.params.wid), investmentInput(r.body)),
    ),
  };
}
