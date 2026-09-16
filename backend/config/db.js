import mongoose from 'mongoose';

import { env } from './env.js';

mongoose.set('strictQuery', true);

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongodbUri);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  await mongoose.connection.close(false);
};

/**
 * Whether this deployment supports transactions. Unknown until the first attempt, then
 * remembered: the answer cannot change for a running server, and without the cache every
 * order write on a standalone `mongod` paid for a session, a doomed transaction and a
 * full re-run of the work.
 */
let transactionsSupported = null;

// Transactions need a replica set. Standalone `mongod` (the common local setup) does not
// have one, so the work is re-run without a session and is NOT atomic there.
export async function withTransaction(work) {
  if (transactionsSupported === false) return work(null);

  let session;
  try {
    session = await mongoose.startSession();
  } catch {
    transactionsSupported = false;
    return work(null);
  }

  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    transactionsSupported = true;
    return result;
  } catch (err) {
    const unsupported =
      err?.code === 20 ||
      /Transaction numbers are only allowed|replica set|not supported/i.test(err?.message ?? '');

    if (unsupported) {
      transactionsSupported = false;
      return work(null);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}
