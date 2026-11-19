import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ApiError } from '../validation/contracts.js';
const derive = promisify(argon2);
const params = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };
let active = 0;
async function digest(password, salt) {
  if (active >= 4)
    throw new ApiError(429, 'RATE_LIMITED', 'Please try again later.');
  active++;
  try {
    return await derive('argon2id', {
      ...params,
      message: Buffer.from(password),
      nonce: salt,
    });
  } finally {
    active--;
  }
}
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await digest(password, salt);
  return `$argon2id$v=19$m=19456,t=2,p=1$${salt.toString('base64')}$${hash.toString('base64')}`;
}
export async function verifyPassword(password, encoded) {
  const fields = typeof encoded === 'string' ? encoded.split('$') : [];
  const valid =
    fields.length === 6 &&
    fields[1] === 'argon2id' &&
    fields[2] === 'v=19' &&
    fields[3] === 'm=19456,t=2,p=1';
  const salt = valid ? Buffer.from(fields[4], 'base64') : Buffer.alloc(16, 1);
  const expected = valid ? Buffer.from(fields[5], 'base64') : Buffer.alloc(32);
  // Unknown/disabled users still perform the same expensive derivation.
  const actual = await digest(
    password,
    salt.length === 16 ? salt : Buffer.alloc(16, 1),
  );
  return (
    valid &&
    expected.length === actual.length &&
    timingSafeEqual(actual, expected)
  );
}
