import * as v from '../validation/contracts.js';
import { identityService } from '../services/identity.js';
const token = (value) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    throw new v.ApiError(
      400,
      'INVALID_LINK',
      'This link is invalid or expired. Request a new link.',
    );
  return value;
};
export function identityControllers(db, config, transport) {
  const service = identityService(db, config, transport);
  const send = (fn) => async (req, res) => res.json({ data: await fn(req) });
  return {
    recovery: send((req) => {
      v.shape(req.body, ['email']);
      return service.requestReset(v.email(req.body.email));
    }),
    reset: send((req) => {
      v.shape(req.body, ['token', 'password']);
      return service.reset(
        token(req.body.token),
        v.password(req.body.password),
      );
    }),
    verify: send((req) => {
      v.shape(req.body, ['token']);
      return service.verify(token(req.body.token));
    }),
    resend: send((req) => {
      v.shape(req.body, []);
      return service.requestVerification(req.auth);
    }),
    change: send((req) => {
      v.shape(req.body, ['email', 'currentPassword']);
      return service.requestVerification(req.auth, {
        email: v.email(req.body.email),
        currentPassword: v.password(req.body.currentPassword),
      });
    }),
    status: send((req) => service.status(req.auth)),
    events: send((req) => service.events(req.auth)),
  };
}
