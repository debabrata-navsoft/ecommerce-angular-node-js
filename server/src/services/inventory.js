import { Product } from '../models/product.model.js';
import { ApiError } from '../utils/api-error.js';

/**
 * Stock moves through a conditional update — `{ stock: { $gte: quantity } }` in the filter
 * means the decrement only applies if the stock is still there. Two shoppers racing for the
 * last unit cannot both succeed, which a read-then-write check would allow.
 */
export async function reserveStock(items, session = null) {
  const options = session ? { session } : {};
  const reserved = [];

  for (const item of items) {
    const result = await Product.updateOne(
      { _id: item.productId, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity, sales: item.quantity } },
    ).setOptions(options);

    if (result.modifiedCount === 0) {
      // Inside a transaction the abort undoes the earlier decrements for us; on a
      // standalone mongod there is no transaction, so unwind by hand.
      if (!session) await releaseStock(reserved, null);
      throw ApiError.badRequest(`"${item.title}" does not have enough stock left`);
    }

    reserved.push(item);
  }
}

export async function releaseStock(items, session = null) {
  const options = session ? { session } : {};

  for (const item of items) {
    await Product.updateOne(
      { _id: item.productId },
      { $inc: { stock: item.quantity, sales: -item.quantity } },
    ).setOptions(options);
  }
}
