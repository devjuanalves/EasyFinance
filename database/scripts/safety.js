export function disposableDatabaseUrl(env = process.env) {
  if (
    env.NODE_ENV === 'production' ||
    env.EASYFINANCE_DISPOSABLE_DB !== 'yes'
  ) {
    throw new Error(
      'Database writes require EASYFINANCE_DISPOSABLE_DB=yes outside production.',
    );
  }
  const raw = env.DATABASE_URL;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Set an explicit disposable DATABASE_URL.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^\/easyfinance_(?:(test|dev)_disposable(?:_[a-z0-9]+)?|block8_test)$/.test(
      url.pathname,
    ) ||
    [...url.searchParams].some(
      ([key, value]) => key !== 'schema' || value !== 'public',
    )
  ) {
    throw new Error(
      'Only a loopback easyfinance_test_disposable, easyfinance_dev_disposable or easyfinance_block8_test database with public schema is allowed.',
    );
  }
  return raw;
}
