import { createApp } from './app.js';
import { env } from './config/env.js';
import { createRuntimeClient, diagnoseRuntime } from './db/runtime.js';
let db;
try {
  if (env.apiMode === 'api') {
    db = createRuntimeClient();
    console.log('Database ready', await diagnoseRuntime(db));
  }
  const server = createApp({ db }).listen(env.port, '127.0.0.1', () =>
    console.log(
      `EasyFinance API listening on http://localhost:${env.port} (${env.apiMode})`,
    ),
  );
  server.on('error', () => {
    console.error('API listener failed');
    process.exitCode = 1;
    void db?.$disconnect();
  });
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => {
      if (stopping) return;
      stopping = true;
      server.close(async () => {
        await db?.$disconnect();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    });
} catch {
  console.error(
    'API startup failed. Verify runtime configuration and database permissions.',
  );
  await db?.$disconnect();
  process.exitCode = 1;
}
