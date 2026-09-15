import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Cart, wishlist and saved-later are all "this user pinned this product" lists, so they
 * share one schema shape and differ only in collection.
 *
 * They store only a reference — the product is resolved with populate on read, so a price
 * or stock edit shows up in every list at once instead of going stale in each. Orders are
 * the deliberate exception: they embed a frozen copy of the line items.
 */
export function createLineItemModel(modelName, collectionName) {
  const schema = new Schema(
    {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, default: 1, min: 1 },
    },
    { timestamps: true, collection: collectionName },
  );

  // One row per product per user — makes add-to-cart an idempotent upsert.
  schema.index({ userId: 1, productId: 1 }, { unique: true });
  schema.index({ userId: 1, createdAt: -1 });

  return mongoose.model(modelName, schema);
}
