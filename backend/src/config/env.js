import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

// `import 'dotenv/config'` resolves .env against process.cwd(), which breaks the moment a
// script is run from its own directory (`cd src/seed && node seed.js`). Anchor it to the
// package root instead, so every entry point loads the same file from anywhere.
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envPath = path.join(packageRoot, '.env');

dotenv.config({ path: envPath });

function required(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${key}. Expected it in ${envPath} ` +
        '(copy .env.example to .env and fill it in).',
    );
  }
  return value;
}

function list(key, fallback = '') {
  return (process.env[key] ?? fallback)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  port: Number(process.env['PORT'] ?? 3000),

  mongodbUri: required('MONGODB_URI'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',

  corsOrigins: list('CORS_ORIGINS', 'http://localhost:4200'),

  /**
   * Where the Angular app is served. Only the password-reset link needs it; it defaults to
   * the first allowed CORS origin, which is that app in every setup here.
   */
  appUrl: (process.env['APP_URL'] || list('CORS_ORIGINS', 'http://localhost:4200')[0]).replace(
    /\/+$/,
    '',
  ),

  razorpay: {
    keyId: process.env['RAZORPAY_KEY_ID'] ?? '',
    keySecret: process.env['RAZORPAY_KEY_SECRET'] ?? '',
  },

  smtp: {
    host: process.env['SMTP_HOST'] ?? '',
    port: Number(process.env['SMTP_PORT'] ?? 587),
    user: process.env['SMTP_USER'] ?? '',
    pass: process.env['SMTP_PASS'] ?? '',
    // Most providers reject a From that isn't the authenticated mailbox, so default to it.
    from: process.env['MAIL_FROM'] || process.env['SMTP_USER'] || '',
  },

  seedAdmin: {
    email: process.env['SEED_ADMIN_EMAIL'] ?? 'admin@example.com',
    password: process.env['SEED_ADMIN_PASSWORD'] ?? 'admin12345',
  },
};

export const isProduction = env.nodeEnv === 'production';

/** Razorpay endpoints degrade to 503 instead of crashing when keys are absent. */
export const razorpayConfigured = Boolean(env.razorpay.keyId && env.razorpay.keySecret);

/** Without SMTP credentials the mailer logs to the console instead of sending. */
export const smtpConfigured = Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);
