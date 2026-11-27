import { createApp } from './app.js';
import { env } from './config/env.js';
import { createRuntimeClient, diagnoseRuntime } from './db/runtime.js';
import { operation } from './security/operations.js';
let db;
let stopping = false;
try {
  if (env.apiMode === 'api') {
    db = createRuntimeClient();
    await diagnoseRuntime(db);
  }
  const server = createApp({ db, isStopping: () => stopping }).listen(
    env.port,
    '127.0.0.1',
    () => operation('startup'),
  );
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.setTimeout(30000, (socket) => socket.destroy());
  server.on('error', () => {
    operation('listener_failed', {}, console.error);
    process.exitCode = 1;
    void db?.$disconnect();
  });
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => {
      if (stopping) return;
      stopping = true;
      operation('shutdown');
      server.close(async () => {
        await db?.$disconnect();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    });
} catch {
  operation('startup_failed', {}, console.error);
  await db?.$disconnect();
  process.exitCode = 1;
}
