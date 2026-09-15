import { WishlistItem } from '../models/wishlist-item.model.js';
import { addLineItem, listLineItems, removeLineItem } from '../services/line-items.js';
import { toWishlistProduct } from '../utils/serialize.js';

const load = (userId) => listLineItems(WishlistItem, userId, toWishlistProduct);

export async function getWishlist(req, res) {
  res.json({ items: await load(req.user._id) });
}

/** Idempotent: re-adding a product the user already saved is a no-op, not a 409. */
export async function addToWishlist(req, res) {
  await addLineItem(WishlistItem, req.user._id, req.body.productId);
  res.status(201).json({ items: await load(req.user._id) });
}

export async function removeFromWishlist(req, res) {
  await removeLineItem(WishlistItem, req.user._id, req.params.productId);
  res.json({ items: await load(req.user._id) });
}
