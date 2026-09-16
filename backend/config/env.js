import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');

dotenv.config({ path: envPath });

const required = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable ${key}. Expected it in ${envPath}`);
  }
  return value;
};

const list = (key, fallback = '') =>
  (process.env[key] ?? fallback)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const corsOrigins = list('CORS_ORIGINS', 'http://localhost:4200');

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),

  mongodbUri: required('MONGODB_URI'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',

  corsOrigins,

  appUrl: (process.env.APP_URL || corsOrigins[0]).replace(/\/+$/, ''),

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? '',
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
    folder: process.env.CLOUDINARY_FOLDER ?? 'snapcart/avatars',
  },

  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM || process.env.SMTP_USER || '',
  },

  seedAdmin: {
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD ?? 'admin12345',
  },
};

export const isProduction = env.nodeEnv === 'production';

export const razorpayConfigured = Boolean(env.razorpay.keyId && env.razorpay.keySecret);

/** Without these the avatar upload endpoints return 503 instead of failing mid-upload. */
export const cloudinaryConfigured = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret,
);

export const smtpConfigured = Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);
