import { it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
import { createRuntimeClient, diagnoseRuntime } from '../src/db/runtime.js';
import { operation } from '../src/security/operations.js';
import { readiness } from '../src/controllers/readiness.js';
it('audits accepted Express path variants without leaking submitted data', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const app = createApp();
    const response = await request(app)
      .post('/API/v1/AUTH/LOGIN/')
      .send({ email: 'private@example.test', password: 'private-password' });
    const events = log.mock.calls.map(([line]) => JSON.parse(line));
    expect(events).toEqual([
      {
        event: 'auth_result',
        action: 'login',
        status: 503,
        requestId: response.headers['x-request-id'],
      },
    ]);
    expect(JSON.stringify(events)).not.toMatch(/private|password/);
  } finally {
    log.mockRestore();
    error.mockRestore();
  }
});
it('requires explicit API and HTTPS production configuration', () => {
  for (const config of [
    {},
    { API_MODE: 'demo', WEB_ORIGIN: 'https://example.test' },
    { API_MODE: 'api', WEB_ORIGIN: 'http://example.test' },
  ])
    expect(() => parseEnv({ ...config, NODE_ENV: 'production' })).toThrow();
  expect(
    parseEnv({
      NODE_ENV: 'production',
      API_MODE: 'api',
      WEB_ORIGIN: 'https://example.test',
    }).apiMode,
  ).toBe('api');
});
it('rejects missing/default runtime credentials before connecting', () => {
  for (const password of [
    '',
    'PASSWORD',
    'password-1234567890',
    'changeme-1234567890',
  ])
    expect(() =>
      createRuntimeClient({
        NODE_ENV: 'test',
        EASYFINANCE_DISPOSABLE_DB: 'yes',
        API_DATABASE_URL: `postgresql://easyfinance_9a_app:${password}@127.0.0.1/easyfinance_test_disposable`,
      }),
    ).toThrow();
});
it('rejects replication-capable runtime roles', async () => {
  await expect(
    diagnoseRuntime({ $queryRaw: async () => [{ rolreplication: true }] }),
  ).rejects.toThrow('Unsafe runtime');
});
it('keeps liveness independent and readiness false without a database', async () => {
  const app = createApp();
  await request(app).get('/api/health').expect(200);
  await request(app).get('/api/ready').expect(503, { status: 'not_ready' });
});
it('reflects database loss and recovery without leaking infrastructure details', async () => {
  let available = true;
  const db = {
    $queryRaw: async () => {
      if (!available) throw new Error('postgresql://secret:credential/private');
      return [{ '?column?': 1 }];
    },
  };
  const app = createApp({ db });
  await request(app).get('/api/ready').expect(200, { status: 'ready' });
  available = false;
  await request(app).get('/api/ready').expect(503, { status: 'not_ready' });
  available = true;
  await request(app).get('/api/ready').expect(200);
});
it('stops readiness during shutdown without querying the database', async () => {
  const db = { $queryRaw: vi.fn() };
  await request(createApp({ db, isStopping: () => true }))
    .get('/api/ready')
    .expect(503);
  expect(db.$queryRaw).not.toHaveBeenCalled();
});
it('bounds and coalesces readiness probes using an event-driven deadline', async () => {
  vi.useFakeTimers();
  try {
    const db = { $queryRaw: vi.fn(() => new Promise(() => {})) };
    const handler = readiness(db);
    const response = () => ({
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    });
    const a = response(),
      b = response();
    const pending = Promise.all([handler({}, a), handler({}, b)]);
    await vi.advanceTimersByTimeAsync(3000);
    await pending;
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(a.status).toHaveBeenCalledWith(503);
    expect(b.status).toHaveBeenCalledWith(503);
  } finally {
    vi.useRealTimers();
  }
});
it('logs only allowlisted operational fields', () => {
  const sink = vi.fn();
  operation(
    'auth_result',
    {
      requestId: '12345678-1234-1234-1234-123456789abc',
      action: 'login',
      status: 401,
      password: 'secret',
      cookie: 'secret',
      email: 'private@example.test',
    },
    sink,
  );
  expect(JSON.parse(sink.mock.calls[0][0])).toEqual({
    event: 'auth_result',
    requestId: '12345678-1234-1234-1234-123456789abc',
    action: 'login',
    status: 401,
  });
  operation('secret-token', {}, sink);
  expect(sink).toHaveBeenCalledTimes(1);
});
it('rejects oversized bodies and ignores proxy-supplied identities', async () => {
  const app = createApp();
  expect(app.get('trust proxy')).toBe(false);
  const result = await request(app)
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', '1.2.3.4')
    .send({ password: 'x'.repeat(110000) });
  expect(result.status).toBe(413);
  expect(JSON.stringify(result.body)).not.toContain('xxxx');
});
