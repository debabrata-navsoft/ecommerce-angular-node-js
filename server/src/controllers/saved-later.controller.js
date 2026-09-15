import { CartItem } from '../models/cart-item.model.js';
import { SavedLaterItem } from '../models/saved-later-item.model.js';
import {
  addLineItem,
  listLineItems,
  moveLineItem,
  removeLineItem,
} from '../services/line-items.js';
import { toCartItem } from '../utils/serialize.js';

const load = (userId) => listLineItems(SavedLaterItem, userId, toCartItem);

export async function getSavedLater(req, res) {
  res.json({ items: await load(req.user._id) });
}

export async function addToSavedLater(req, res) {
  await addLineItem(SavedLaterItem, req.user._id, req.body.productId);
  res.status(201).json({ items: await load(req.user._id) });
}

export async function removeFromSavedLater(req, res) {
  await removeLineItem(SavedLaterItem, req.user._id, req.params.productId);
  res.json({ items: await load(req.user._id) });
}

export async function moveToCart(req, res) {
  const userId = req.user._id;
  await moveLineItem(SavedLaterItem, CartItem, userId, req.params.productId);

  res.json({
    items: await load(userId),
    cart: await listLineItems(CartItem, userId, toCartItem),
  });
}
