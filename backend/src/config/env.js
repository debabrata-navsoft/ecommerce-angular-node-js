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

  razorpay: {
    keyId: process.env['RAZORPAY_KEY_ID'] ?? '',
    keySecret: process.env['RAZORPAY_KEY_SECRET'] ?? '',
  },

  seedAdmin: {
    email: process.env['SEED_ADMIN_EMAIL'] ?? 'admin@example.com',
    password: process.env['SEED_ADMIN_PASSWORD'] ?? 'admin12345',
  },
};

export const isProduction = env.nodeEnv === 'production';

/** Razorpay endpoints degrade to 503 instead of crashing when keys are absent. */
export const razorpayConfigured = Boolean(env.razorpay.keyId && env.razorpay.keySecret);
