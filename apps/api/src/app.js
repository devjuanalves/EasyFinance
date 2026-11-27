import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { v1Router } from './routes/v1.js';
import { headers } from './security/http.js';
import { ApiError } from './validation/contracts.js';
import { authEvents } from './security/operations.js';
import { readiness } from './controllers/readiness.js';
export function createApp({
  db = null,
  config = env,
  isStopping,
  identityTransport,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.set('json replacer', (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
  app.use(headers);
  app.use(authEvents);
  app.use(
    cors({
      origin: config.webOrigin,
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-EasyFinance-CSRF'],
    }),
  );
  app.use('/api/v1/workspaces/:wid/imports', express.json({ limit: '6mb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(healthRouter);
  app.get('/api/ready', readiness(db, isStopping));
  app.use(
    '/api/v1',
    db
      ? v1Router(db, config, identityTransport)
      : (_req, _res, next) =>
          next(
            new ApiError(
              503,
              'API_DISABLED',
              'Persistent API mode is not enabled.',
            ),
          ),
  );
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
export const app = createApp();
