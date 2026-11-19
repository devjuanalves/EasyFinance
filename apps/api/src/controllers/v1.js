import * as v from '../validation/contracts.js';
import { authentication } from '../services/auth.js';
import { workspaces } from '../services/workspaces.js';
import { ledger } from '../services/ledger.js';
import { sessionCookie, clearSessionCookie } from '../security/http.js';
export function controllers(db, config) {
  const auth = authentication(db),
    ws = workspaces(db),
    finance = ledger(db),
    secure = config.nodeEnv === 'production';
  const send = (fn) => async (req, res) =>
    res.json({ data: await fn(req, res) });
  const wid = (req) => v.id(req.params.wid),
    rid = (req) => v.id(req.params.id);
  return {
    register: send((req) => {
      v.shape(req.body, ['fullName', 'email', 'password']);
      return auth.register({
        fullName: v.text(req.body.fullName, 100),
        email: v.email(req.body.email),
        password: v.password(req.body.password),
      });
    }),
    login: send(async (req, res) => {
      v.shape(
        req.body,
        ['email', 'password', 'rememberMe'],
        ['email', 'password'],
      );
      if (
        req.body.rememberMe !== undefined &&
        typeof req.body.rememberMe !== 'boolean'
      )
        v.fail();
      const result = await auth.login({
        email: v.email(req.body.email),
        password: v.password(req.body.password),
        rememberMe: req.body.rememberMe,
      });
      sessionCookie(res, result.token, secure, req.body.rememberMe);
      return result.user;
    }),
    session: send((req) => auth.session(req.auth)),
    logout: send(async (req, res) => {
      v.shape(req.body, []);
      const result = await auth.logout(req.auth);
      clearSessionCookie(res, secure);
      return result;
    }),
    password: send(async (req, res) => {
      v.shape(req.body, ['currentPassword', 'password']);
      const result = await auth.password(req.auth, {
        currentPassword: v.password(req.body.currentPassword),
        password: v.password(req.body.password),
      });
      clearSessionCookie(res, secure);
      return result;
    }),
    recovery: send((req) => {
      v.shape(req.body, ['email']);
      v.email(req.body.email);
      throw new v.ApiError(
        503,
        'RECOVERY_UNAVAILABLE',
        'Recovery email is not available. No message has been sent.',
      );
    }),
    workspaces: send((req) => ws.list(req.auth)),
    onboarding: send((req) => {
      v.shape(
        req.body,
        [
          'workspaceName',
          'currency',
          'timeZone',
          'workspaceType',
          'fullName',
          'language',
          'dateFormat',
        ],
        ['workspaceName', 'currency'],
      );
      const timeZone = v.text(
        req.body.timeZone === undefined
          ? 'Australia/Sydney'
          : req.body.timeZone,
        80,
      );
      try {
        new Intl.DateTimeFormat('en', { timeZone });
      } catch {
        v.fail('Invalid timezone.');
      }
      return ws.onboard(req.auth, {
        workspaceName: v.text(req.body.workspaceName, 100),
        currency: v.currency(req.body.currency),
        timeZone,
        ...(req.body.fullName !== undefined
          ? { fullName: v.text(req.body.fullName, 100) }
          : {}),
        ...(req.body.language !== undefined
          ? {
              language: v.choice(req.body.language, [
                'en-AU',
                'en-US',
                'pt-BR',
              ]),
            }
          : {}),
        ...(req.body.dateFormat !== undefined
          ? {
              dateFormat: v.choice(req.body.dateFormat, [
                'DD/MM/YYYY',
                'MM/DD/YYYY',
                'YYYY-MM-DD',
              ]),
            }
          : {}),
        workspaceType: v.choice(
          req.body.workspaceType === undefined
            ? 'personal'
            : req.body.workspaceType,
          ['personal', 'shared'],
        ),
      });
    }),
    members: send((req) => ws.members(req.auth, wid(req))),
    member: send((req) => {
      v.shape(req.body, ['role', 'status']);
      return ws.changeMember(req.auth, wid(req), rid(req), {
        role: v.choice(req.body.role, ['editor', 'viewer']),
        status: v.choice(req.body.status, ['active', 'revoked']),
      });
    }),
    accounts: send((req) => {
      v.shape(req.query, ['currency'], []);
      return finance.accounts(
        req.auth,
        wid(req),
        req.query.currency ? v.currency(req.query.currency) : null,
      );
    }),
    account: send((req) => finance.account(req.auth, wid(req), rid(req))),
    categories: send((req) => finance.categories(req.auth, wid(req))),
    transactions: send((req) =>
      finance.list(req.auth, wid(req), v.filters(req.query)),
    ),
    transaction: send((req) => finance.read(req.auth, wid(req), rid(req))),
    create: send((req) =>
      finance.create(req.auth, wid(req), v.transactionInput(req.body, true)),
    ),
    update: send((req) =>
      finance.update(
        req.auth,
        wid(req),
        rid(req),
        v.transactionInput(req.body, false),
      ),
    ),
    exclusion: send((req) => {
      v.shape(req.body, ['version', 'excluded']);
      if (typeof req.body.excluded !== 'boolean') v.fail();
      return finance.exclusion(req.auth, wid(req), rid(req), {
        version: v.integer(req.body.version, 1, 2147483646),
        excluded: req.body.excluded,
      });
    }),
    summary: send((req) =>
      finance.summary(req.auth, wid(req), v.filters(req.query, true)),
    ),
  };
}
