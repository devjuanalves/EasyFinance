import { it, expect } from 'vitest';
import { identityDelivery } from '../src/security/identity-mail.js';
import { parseEnv } from '../src/config/env.js';
import { operation } from '../src/security/operations.js';
it('requires a shared secret in API mode and never defaults it', () => {
  expect(() => parseEnv({ API_MODE: 'api' })).toThrow('IDENTITY_RATE_SECRET');
  expect(
    parseEnv({ API_MODE: 'api', IDENTITY_RATE_SECRET: 'a'.repeat(64) })
      .identityRateSecret,
  ).toHaveLength(64);
});
it('identity delivery rejects origins containing paths and injected recipients', async () => {
  expect(() =>
    identityDelivery({ webOrigin: 'https://example.test/evil' }),
  ).toThrow();
  const delivery = identityDelivery(
    { nodeEnv: 'test', webOrigin: 'https://example.test' },
    { kind: 'test', send() {} },
  );
  await expect(
    delivery.send({
      type: 'reset',
      email: 'a@example.test\r\nbcc: b@example.test',
      token: 'a'.repeat(64),
    }),
  ).rejects.toThrow();
});
it('message links use the configured origin and fragment without exposing password data', async () => {
  const messages = [];
  const delivery = identityDelivery(
    { nodeEnv: 'test', webOrigin: 'https://example.test' },
    { kind: 'test', send: async (m) => messages.push(m) },
  );
  await delivery.send({
    type: 'verify',
    email: 'fictional@example.test',
    token: 'a'.repeat(64),
  });
  expect(messages[0].text).toContain(
    'https://example.test/verify-email#token=',
  );
  expect(messages[0].html).toContain('Continue securely');
  expect(messages[0]).not.toHaveProperty('password');
});
it('unconfigured delivery never claims that an email was sent', async () => {
  const delivery = identityDelivery({ webOrigin: 'https://example.test' });
  expect(delivery.available).toBe(false);
  await expect(delivery.send({})).rejects.toMatchObject({
    code: 'DELIVERY_UNAVAILABLE',
  });
});
it('identity operational events discard submitted tokens and credentials', () => {
  const logs = [];
  operation(
    'auth_result',
    {
      action: 'reset',
      status: 200,
      token: 'secret-proof',
      password: 'secret-password',
      email: 'private@example.test',
    },
    (line) => logs.push(line),
  );
  expect(JSON.parse(logs[0])).toEqual({
    event: 'auth_result',
    action: 'reset',
    status: 200,
  });
  expect(logs[0]).not.toMatch(/secret|private/);
});
