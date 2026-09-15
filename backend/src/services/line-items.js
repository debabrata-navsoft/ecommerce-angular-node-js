import { withTransaction } from '../config/db.js';
import { Product } from '../models/product.model.js';
import { ApiError } from '../utils/api-error.js';
import { mapDefined } from '../utils/serialize.js';

/**
 * Shared behaviour for the three per-user product lists (cart, wishlist, saved-later).
 * Every read populates the product so the caller always sees current price and stock;
 * rows whose product has been deleted are dropped rather than returned half-empty.
 */

const PRODUCT_FIELDS =
  'title price stock brand color category subCategory image description sales views discount discountPrice rating createdAt updatedAt';

export function listLineItems(Model, userId, mapper) {
  return Model.find({ userId })
    .sort({ createdAt: -1 })
    .populate('productId', PRODUCT_FIELDS)
    .then((docs) => mapDefined(docs, mapper));
}

async function loadPopulated(Model, id) {
  return Model.findById(id).populate('productId', PRODUCT_FIELDS);
}

/**
 * Adds a product to a list, or bumps its quantity when `increment` is set (the cart).
 * `$inc` on an existing row plus create-on-miss keeps this safe under concurrent clicks —
 * a duplicate-key collision just means another request won the race, so we retry the
 * increment instead of failing the user's action.
 */
export async function addLineItem(Model, userId, productId, { increment = false } = {}) {
  const product = await Product.findById(productId).select('stock');
  if (!product) throw ApiError.notFound('Product not found');

  if (increment) {
    const existing = await Model.findOne({ userId, productId });

    if (existing) {
      if (existing.quantity + 1 > product.stock) {
        throw ApiError.badRequest(`Only ${product.stock} left in stock`);
      }
      existing.quantity += 1;
      await existing.save();
      return loadPopulated(Model, existing._id);
    }

    if (product.stock < 1) throw ApiError.badRequest('This product is out of stock');
  }

  try {
    const created = await Model.create({ userId, productId, quantity: 1 });
    return loadPopulated(Model, created._id);
  } catch (err) {
    if (err?.code !== 11000) throw err;

    const doc = await Model.findOneAndUpdate(
      { userId, productId },
      increment ? { $inc: { quantity: 1 } } : {},
      { new: true },
    );
    return loadPopulated(Model, doc._id);
  }
}

export async function setLineItemQuantity(Model, userId, productId, quantity) {
  if (quantity <= 0) {
    await removeLineItem(Model, userId, productId);
    return null;
  }

  const product = await Product.findById(productId).select('stock');
  if (!product) throw ApiError.notFound('Product not found');
  if (quantity > product.stock) throw ApiError.badRequest(`Only ${product.stock} left in stock`);

  const doc = await Model.findOneAndUpdate({ userId, productId }, { quantity }, { new: true });
  if (!doc) throw ApiError.notFound('Item is not in this list');

  return loadPopulated(Model, doc._id);
}

export async function removeLineItem(Model, userId, productId) {
  const result = await Model.deleteOne({ userId, productId });
  if (result.deletedCount === 0) throw ApiError.notFound('Item is not in this list');
}

export function clearList(Model, userId) {
  return Model.deleteMany({ userId });
}

/**
 * Moves a row between two lists in one call — this is what makes "save for later" and
 * "move to cart" atomic. The old CartService.saveForLater() only did the removal and
 * relied on the caller to remember the matching SaveLaterService.saveForLater().
 */
export async function moveLineItem(FromModel, ToModel, userId, productId) {
  await withTransaction(async (session) => {
    const options = session ? { session } : {};

    const source = await FromModel.findOne({ userId, productId }).setOptions(options);
    if (!source) throw ApiError.notFound('Item is not in this list');

    await FromModel.deleteOne({ _id: source._id }).setOptions(options);

    await ToModel.findOneAndUpdate(
      { userId, productId },
      { $set: { quantity: source.quantity ?? 1 } },
      { upsert: true, new: true, ...options },
    );
  });
}
