import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { connectDB } from './config/db.js';
import { env, isProduction, razorpayConfigured } from './config/env.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import routes from './routes/index.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: false }));

  app.use(
    cors({
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

  app.use(authenticate);

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

const startServer = async () => {
  try {
    await connectDB();

    const server = createApp();

    server.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
      if (!razorpayConfigured) {
        console.warn('RAZORPAY_KEY_ID/SECRET not set — only "cod" orders will work');
      }
    });
  } catch (error) {
    console.log(error);
  }
};

startServer();
