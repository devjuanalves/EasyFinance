import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { hashPassword, verifyPassword } from '../src/security/passwords.js';
import { transactionInput, filters } from '../src/validation/contracts.js';
import { cashTotals } from '@easyfinance/shared';
import { rateLimit, sessionCookie } from '../src/security/http.js';
import express from 'express';
import { errorHandler } from '../src/middleware/errors.js';
describe('Backend security primitives', () => {
  it('Argon2id is salted, verifies and rejects altered passwords', async () => {
    const password = 'Example-test-password!';
    const a = await hashPassword(password),
      b = await hashPassword(password);
    expect(a).not.toBe(b);
    expect(await verifyPassword(password, a)).toBe(true);
    expect(await verifyPassword(password + 'x', a)).toBe(false);
    expect(await verifyPassword(password, null)).toBe(false);
  });
  it('rejects mass assignment, decimal/exponent amounts and dates', () => {
    expect(() => transactionInput({ role: 'owner' }, true)).toThrow();
    expect(() => filters({ currency: 'AUD', page: '0' })).toThrow();
    expect(() => filters({ currency: 'AUD', start: '2026-02-30' })).toThrow();
    expect(() => filters({ currency: 'USD', extra: 'value' })).toThrow();
  });
  it('shares exact ledger definitions across Number and BigInt without double counting', () => {
    const rows = [
      { type: 'expense', amount: -125 },
      { type: 'income', amount: 200 },
      { type: 'transfer', amount: 100 },
      { type: 'expense', amount: -10, excluded: true },
    ];
    expect(cashTotals(rows)).toEqual({ income: 200, expenses: 125, net: 75 });
    expect(
      cashTotals(rows, { amount: (r) => BigInt(r.amount), zero: 0n }),
    ).toEqual({ income: 200n, expenses: 125n, net: 75n });
  });
  it('has explicit unavailable API mode without weakening existing health', async () => {
    const r = await request(createApp()).get('/api/v1/workspaces');
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe('API_DISABLED');
    expect(JSON.stringify(r.body)).not.toMatch(/postgresql|password|stack/);
  });
  it('rate limiter expires entries with a clock, not sleeps', async () => {
    let time = 0;
    const app = express();
    app.use(rateLimit({ limit: 1, windowMs: 1000, now: () => time }));
    app.get('/', (_req, res) => res.sendStatus(200));
    app.use(errorHandler);
    await request(app).get('/').expect(200);
    await request(app).get('/').expect(429);
    time = 1001;
    await request(app).get('/').expect(200);
  });
  it('production cookies are Secure and HttpOnly with exact scope', async () => {
    const app = express();
    app.get('/', (_req, res) => {
      sessionCookie(res, 'a'.repeat(64), true, true);
      res.sendStatus(200);
    });
    const r = await request(app).get('/');
    expect(r.headers['set-cookie'][0]).toMatch(/Secure/);
    expect(r.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(r.headers['set-cookie'][0]).toMatch(/SameSite=Strict/);
    expect(r.headers['set-cookie'][0]).toMatch(/Path=\/api\/v1/);
  });
  it('centralized errors hide query/credential details', async () => {
    const app = express();
    app.get('/api/v1/test', () => {
      throw Object.assign(
        new Error('postgresql://private:secret SELECT sensitive'),
        { code: 'P2003' },
      );
    });
    app.use(errorHandler);
    const r = await request(app).get('/api/v1/test');
    expect(r.status).toBe(409);
    expect(JSON.stringify(r.body)).not.toMatch(/private|secret|SELECT/);
  });
});

it('database availability errors return a safe retryable response', async () => {
  const app = express();
  app.get('/api/v1/check', () => {
    throw Object.assign(new Error('secret connection details'), {
      code: 'P1001',
    });
  });
  app.use(errorHandler);
  const r = await request(app).get('/api/v1/check');
  expect(r.status).toBe(503);
  expect(r.body.error.code).toBe('DATABASE_UNAVAILABLE');
  expect(JSON.stringify(r.body)).not.toContain('secret');
});
