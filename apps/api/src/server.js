import { app } from './app.js';
import { env } from './config/env.js';
const server = app.listen(env.port, '127.0.0.1', () => {
  console.log(`EasyFinance API listening on http://localhost:${env.port}`);
});
server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
