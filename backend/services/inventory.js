import { Product } from '../models/product.model.js';
import { ApiError } from '../utils/api-error.js';

export async function reserveStock(items, session = null) {
  const options = session ? { session } : {};
  const reserved = [];

  for (const item of items) {
    const result = await Product.updateOne(
      { _id: item.productId, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity, sales: item.quantity } },
    ).setOptions(options);

    if (result.modifiedCount === 0) {
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
