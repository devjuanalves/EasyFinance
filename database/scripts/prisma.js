import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { disposableDatabaseUrl } from './safety.js';
const command = process.argv[2];
const commands = {
  deploy: ['migrate', 'deploy'],
  status: ['migrate', 'status'],
};
if (!commands[command])
  throw new Error(
    'Use deploy or status; no reset/db push command is provided.',
  );
disposableDatabaseUrl();
const result = spawnSync(
  process.execPath,
  [
    'node_modules/prisma/build/index.js',
    ...commands[command],
    '--config',
    'prisma.config.js',
  ],
  { stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
