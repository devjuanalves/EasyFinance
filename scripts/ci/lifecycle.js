import 'dotenv/config';
import { spawn } from 'node:child_process';
import {
  createRuntimeClient,
  diagnoseRuntime,
} from '../../apps/api/src/db/runtime.js';
const db = createRuntimeClient();
try {
  console.log('Restricted runtime verified', await diagnoseRuntime(db));
} finally {
  await db.$disconnect();
}
const port = 13001;
const child = spawn(process.execPath, ['apps/api/src/server.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'test',
    API_MODE: 'api',
    API_PORT: String(port),
    WEB_ORIGIN: 'http://localhost:5173',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let exited = false;
const done = new Promise((resolve) =>
  child.once('exit', (code, signal) => {
    exited = true;
    resolve({ code, signal });
  }),
);
const deadline = setTimeout(() => {
  child.kill('SIGTERM');
}, 15000);
try {
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('"event":"startup"')) resolve();
    });
    child.once('error', reject);
    child.once('exit', () => reject(new Error('API exited before readiness')));
  });
  const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
    signal: AbortSignal.timeout(5000),
  });
  const body = await response.json();
  if (response.status !== 200 || body.status !== 'ok')
    throw new Error('Health check failed');
  const ready = await fetch(`http://127.0.0.1:${port}/api/ready`, {
    signal: AbortSignal.timeout(5000),
  });
  if (ready.status !== 200 || (await ready.json()).status !== 'ready')
    throw new Error('Database readiness failed');
  child.kill('SIGTERM');
  const result = await done;
  if (result.code !== 0 || result.signal)
    throw new Error('Graceful shutdown failed');
  console.log(
    'API startup, HTTP health, Prisma lifecycle and SIGTERM shutdown passed.',
  );
} finally {
  clearTimeout(deadline);
  if (!exited) child.kill('SIGTERM');
}
