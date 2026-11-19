export const API_MODE = import.meta.env.VITE_AUTH_MODE === 'api';
let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}
export async function api(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch('/api/v1' + path, {
      method,
      credentials: 'include',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(method === 'GET' ? {} : { 'X-EasyFinance-CSRF': '1' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('The API is unavailable. Check the connection and retry.', {
      cause: error,
    });
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    if (
      response.status === 401 &&
      !['/auth/login', '/auth/password'].includes(path)
    )
      onUnauthorized();
    const error = new Error(
      result?.error?.message || 'The request could not be completed.',
    );
    error.status = response.status;
    throw error;
  }
  return result.data;
}
export function decimalToMinor(value) {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value))
    throw new Error('Enter a signed amount with up to two decimal places.');
  const negative = value.startsWith('-'),
    [whole, fraction = ''] = value.replace('-', '').split('.');
  const n = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (n > 9007199254740991n) throw new Error('Amount is too large.');
  return (negative ? -n : n).toString();
}
export function formatMinor(value, currency) {
  const n = BigInt(value);
  const a = n < 0n ? -n : n;
  return `${currency} ${n < 0n ? '-' : ''}${(a / 100n).toLocaleString('en-AU')}.${(a % 100n).toString().padStart(2, '0')}`;
}
