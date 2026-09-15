import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env, isProduction, razorpayConfigured } from './config/env.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import routes from './routes/index.js';

/**
 * Builds the Express app without starting it. Kept exported and separate from `main()` so
 * the app can be mounted in a test (supertest) or another host without opening a port or
 * connecting to Mongo.
 */
export function createApp() {
  const app = express();

  // Behind a proxy (Cloud Run, nginx) so secure cookies and req.ip resolve correctly.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: false }));

  app.use(
    cors({
      // A credentialed request cannot use a wildcard origin, so the allow-list is checked
      // explicitly. Requests without an Origin header (the Angular SSR server calling the
      // API server-to-server, curl, health checks) are allowed through.
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin) || env.corsOrigins.includes('*')) {
          return callback(null, true);
        }
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan(isProduction ? 'combined' : 'dev'));

  // Resolves req.user for every route; individual routes decide whether it is required.
  app.use(authenticate);

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

async function main() {
  await connectDatabase();

  const server = createApp().listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port} (${env.nodeEnv})`);
    console.log(`[api] cors origins: ${env.corsOrigins.join(', ') || '(none)'}`);
    if (!razorpayConfigured) {
      console.warn('[api] RAZORPAY_KEY_ID/SECRET not set — only "cod" orders will work');
    }
  });

  // Finish in-flight requests before closing the pool, so a redeploy does not 500 anyone.
  const shutdown = async (signal) => {
    console.log(`\n[api] ${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[api] failed to start:', err.message);
  process.exit(1);
});
