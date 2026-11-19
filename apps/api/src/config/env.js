import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({
  path: fileURLToPath(new URL('../../../../.env', import.meta.url)),
  quiet: true,
});
export function parseEnv(source = process.env) {
  const port = Number(source.API_PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('API_PORT must be an integer from 1 to 65535');
  const nodeEnv = source.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv))
    throw new Error('Invalid NODE_ENV');
  const webOrigin = source.WEB_ORIGIN ?? 'http://localhost:5173';
  const url = new URL(webOrigin);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== webOrigin)
    throw new Error('WEB_ORIGIN must be an HTTP(S) origin');
  const apiMode = source.API_MODE ?? 'demo';
  if (!['api', 'demo'].includes(apiMode)) throw new Error('Invalid API_MODE');
  if (
    nodeEnv === 'production' &&
    (apiMode !== 'api' || url.protocol !== 'https:')
  )
    throw new Error('Production requires API mode and HTTPS origin');
  return { port, nodeEnv, webOrigin, apiMode };
}
export const env = parseEnv();
