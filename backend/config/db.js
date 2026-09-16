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

 // Transactions need a replica set. Standalone `mongod` (the common local setup) does not
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
