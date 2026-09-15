import mongoose from 'mongoose';

import { env, isProduction } from './env.js';

mongoose.set('strictQuery', true);
if (!isProduction) {
  mongoose.set('debug', false);
}

export async function connectDatabase() {
  mongoose.connection.on('connected', () => console.log('[db] connected'));
  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));
  mongoose.connection.on('error', (err) => console.error('[db] error', err.message));

  await mongoose.connect(env.mongodbUri, {
    serverSelectionTimeoutMS: 10_000,
  });

  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.connection.close(false);
}

/**
 * Transactions need a replica set. Standalone `mongod` (the common local setup) does not
 * support them, so multi-document writes fall back to running sequentially without a session.
 */
export async function withTransaction(work) {
  let session;
  try {
    session = await mongoose.startSession();
  } catch {
    return work(null);
  }

  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (err) {
    const unsupported =
      err?.code === 20 ||
      /Transaction numbers are only allowed|replica set|not supported/i.test(err?.message ?? '');
    if (unsupported) return work(null);
    throw err;
  } finally {
    await session.endSession();
  }
}
