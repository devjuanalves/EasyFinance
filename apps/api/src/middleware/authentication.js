import { cookieToken, tokenHash } from '../security/http.js';
import { activeSession, unauthorized } from '../repositories/access.js';
export const authenticate = (db) => async (req, _res, next) => {
  try {
    const token = cookieToken(req);
    if (!token) throw unauthorized();
    const hash = tokenHash(token);
    const s = await activeSession(db, hash);
    req.auth = { userId: s.userId, hash };
    next();
  } catch (e) {
    next(e);
  }
};
