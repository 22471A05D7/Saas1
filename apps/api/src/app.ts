import express, { type Express, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { corsOrigins, isTest } from './lib/env';
import { ok } from './lib/http';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './modules/auth/auth.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { productsRouter } from './modules/products/products.routes';
import { settingsRouter } from './modules/settings/settings.routes';

/**
 * Builds the Express application.
 *
 * Exported separately from the server so the test suite can mount it with
 * Supertest without binding a port.
 */
export function createApp(): Express {
  const app = express();

  // Behind a proxy/load balancer this makes req.ip and rate limiting accurate.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());

  app.use(
    cors({
      // Only the configured origins may send credentialed requests.
      origin(origin, callback) {
        // Same-origin and non-browser clients (curl, tests) send no Origin.
        if (!origin || isTest || corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );

  // A modest body limit keeps oversized payloads from reaching the handlers.
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));
  app.use(cookieParser());

  app.get('/health', (_req: Request, res: Response) =>
    ok(res, { status: 'ok', service: 'stockflow-api' }),
  );

  app.use('/auth', authRouter);
  app.use('/products', productsRouter);
  app.use('/dashboard', dashboardRouter);
  app.use('/settings', settingsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
