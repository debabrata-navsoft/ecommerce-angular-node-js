import { Product } from '../models/product.model.js';
import { ApiError } from '../utils/api-error.js';
import { serializeLean } from '../utils/mongoose-json.js';
import { paginate } from '../utils/paginate.js';

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  'price-asc': { discountPrice: 1 },
  'price-desc': { discountPrice: -1 },
  discount: { discount: -1 },
  rating: { rating: -1 },
};

const weighted = (fields) => ({
  $add: Object.entries(fields).map(([field, weight]) => ({
    $multiply: [{ $ifNull: [`$${field}`, 0] }, weight],
  })),
});

/**
 * Score weights kept identical to those the old client-side ProductService applied after
 * downloading the whole collection.
 */
const BEST_SELLER_SCORE = weighted({ sales: 3, rating: 2, discount: 0.5 });
const TRENDING_SCORE = weighted({ views: 0.5, rating: 1.5, discount: 0.3 });

const BEST_SELLER_LIMIT = 20;

function buildFilter(query) {
  const filter = {};
  const slug = (value) => String(value).toLowerCase().trim();

  // `category` matches either level, mirroring getProductsByCategory(), which treated a
  // slug as a hit against category *or* subCategory.
  if (query.category && query.category !== 'all') {
    filter.$or = [{ category: slug(query.category) }, { subCategory: slug(query.category) }];
  }

  if (query.main) filter.category = slug(query.main);
  if (query.subCategory) filter.subCategory = slug(query.subCategory);
  if (query.brand) filter.brand = String(query.brand).trim();
  if (query.minDiscount) filter.discount = { $gte: Number(query.minDiscount) };
  if (query.inStock === 'true') filter.stock = { $gt: 0 };
  if (query.search) filter.searchName = { $regex: slug(query.search), $options: 'i' };

  const range = {};
  if (query.minPrice) range.$gte = Number(query.minPrice);
  if (query.maxPrice) range.$lte = Number(query.maxPrice);
  if (Object.keys(range).length) filter.discountPrice = range;

  return filter;
}

export async function listProducts(req, res) {
  const sort = SORTS[req.query.sort] ?? SORTS.newest;
  res.json(await paginate(Product, buildFilter(req.query), sort, req.query));
}

export async function getProduct(req, res) {
  // $inc rather than read-modify-write so concurrent views cannot lose a count.
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { $inc: { views: 1 } },
    { new: true },
  );

  if (!product) throw ApiError.notFound('Product not found');
  res.json({ product: product.toJSON() });
}

function rank(score, { limit, exclude } = {}) {
  const pipeline = [];
  if (exclude) pipeline.push({ $match: { _id: { $nin: exclude } } });

  pipeline.push({ $addFields: { score } }, { $sort: { score: -1, _id: 1 } });
  if (limit) pipeline.push({ $limit: limit });

  return Product.aggregate(pipeline);
}

const drop = ({ score, ...rest }) => serializeLean(rest);

export async function listBestSellers(_req, res) {
  const items = await rank(BEST_SELLER_SCORE, { limit: BEST_SELLER_LIMIT });
  res.json({ items: items.map(drop) });
}

export async function listTrending(_req, res) {
  // Trending is explicitly "popular but not already a best seller", so the top 20 by
  // best-seller score are excluded before ranking by the trending weights.
  const best = await rank(BEST_SELLER_SCORE, { limit: BEST_SELLER_LIMIT });
  const items = await rank(TRENDING_SCORE, { exclude: best.map((p) => p._id) });

  res.json({ items: items.map(drop) });
}

const discountFeed = (minDiscount) => async (_req, res) => {
  const items = await Product.find({ discount: { $gte: minDiscount } }).sort({ createdAt: -1 });
  res.json({ items: items.map((p) => p.toJSON()) });
};

export const listTodayDeals = discountFeed(70);
export const listDiscounted = discountFeed(50);

export async function createProduct(req, res) {
  const product = await Product.create(req.body);
  res.status(201).json({ product: product.toJSON() });
}

export async function updateProduct(req, res) {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!product) throw ApiError.notFound('Product not found');
  res.json({ product: product.toJSON() });
}

export async function deleteProduct(req, res) {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  res.status(204).end();
}
