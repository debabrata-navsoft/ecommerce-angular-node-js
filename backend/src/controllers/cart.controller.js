import { CartItem } from '../models/cart-item.model.js';
import { SavedLaterItem } from '../models/saved-later-item.model.js';
import {
  addLineItem,
  clearList,
  listLineItems,
  moveLineItem,
  removeLineItem,
  setLineItemQuantity,
} from '../services/line-items.js';
import { toCartItem } from '../utils/serialize.js';

const load = (userId) => listLineItems(CartItem, userId, toCartItem);

export async function getCart(req, res) {
  res.json({ items: await load(req.user._id) });
}

export async function addToCart(req, res) {
  await addLineItem(CartItem, req.user._id, req.body.productId, { increment: true });
  res.status(201).json({ items: await load(req.user._id) });
}

export async function updateCartQuantity(req, res) {
  const quantity = Number(req.body.quantity);
  await setLineItemQuantity(CartItem, req.user._id, req.params.productId, quantity);
  res.json({ items: await load(req.user._id) });
}

export async function removeFromCart(req, res) {
  await removeLineItem(CartItem, req.user._id, req.params.productId);
  res.json({ items: await load(req.user._id) });
}

export async function clearCart(req, res) {
  await clearList(CartItem, req.user._id);
  res.json({ items: [] });
}

/** One request does both halves of the move, so the two lists cannot drift apart. */
export async function saveForLater(req, res) {
  const userId = req.user._id;
  await moveLineItem(CartItem, SavedLaterItem, userId, req.params.productId);

  res.json({
    items: await load(userId),
    savedLater: await listLineItems(SavedLaterItem, userId, toCartItem),
  });
}
