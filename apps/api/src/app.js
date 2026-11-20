import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { v1Router } from './routes/v1.js';
import { headers } from './security/http.js';
import { ApiError } from './validation/contracts.js';
export function createApp({ db = null, config = env } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('json replacer', (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
  app.use(headers);
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
  app.use(
    '/api/v1',
    db
      ? v1Router(db, config)
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
