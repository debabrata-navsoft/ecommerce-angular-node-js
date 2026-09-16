import { withTransaction } from '../config/db.js';
import { Product } from '../models/product.model.js';
import { ApiError } from '../utils/api-error.js';
import { mapDefined } from '../utils/serialize.js';

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
