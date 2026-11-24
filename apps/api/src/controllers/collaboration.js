import { collaboration } from '../services/collaboration.js';
import {
  notificationInput,
  profileInput,
  workspaceInput,
  automationInput,
} from '../validation/collaboration.js';
import { id, shape, email, choice, fail } from '../validation/contracts.js';
export function collaborationControllers(db) {
  const s = collaboration(db),
    wrap = (fn) => async (req, res, next) => {
      try {
        res.json({ data: await fn(req) });
      } catch (e) {
        next(e);
      }
    };
  return {
    preferences: wrap((r) =>
      s.preferences(r.auth, id(r.params.wid), notificationInput(r.body)),
    ),
    read: wrap((r) => s.read(r.auth, id(r.params.wid))),
    profile: wrap((r) =>
      s.profile(r.auth, id(r.params.wid), profileInput(r.body)),
    ),
    workspace: wrap((r) =>
      s.workspace(r.auth, id(r.params.wid), workspaceInput(r.body)),
    ),
    invite: wrap((r) => {
      shape(r.body, ['email', 'role']);
      return s.invite(r.auth, id(r.params.wid), {
        email: email(r.body.email),
        role: choice(r.body.role, ['editor', 'viewer']),
      });
    }),
    revoke: wrap((r) => {
      shape(r.body, []);
      return s.revoke(r.auth, id(r.params.wid), id(r.params.id));
    }),
    accept: wrap((r) => {
      shape(r.body, ['token']);
      if (
        typeof r.body.token !== 'string' ||
        !/^[0-9a-f]{64}$/.test(r.body.token)
      )
        fail('Invalid invitation token.');
      return s.accept(r.auth, r.body.token);
    }),
    create: wrap((r) =>
      s.automation(
        r.auth,
        id(r.params.wid),
        null,
        automationInput(r.body, false),
      ),
    ),
    edit: wrap((r) =>
      s.automation(
        r.auth,
        id(r.params.wid),
        id(r.params.id),
        automationInput(r.body, true),
      ),
    ),
  };
}
