import { CartItem } from '../models/cart-item.model.js';
import { SavedLaterItem } from '../models/saved-later-item.model.js';
import { WishlistItem } from '../models/wishlist-item.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { profileChanges } from './auth.controller.js';

export async function listUsers(req, res) {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;

  if (req.query.search) {
    const $regex = String(req.query.search).trim();
    filter.$or = ['email', 'firstName', 'lastName'].map((field) => ({
      [field]: { $regex, $options: 'i' },
    }));
  }

  const users = await User.find(filter).sort({ createdAt: -1 });
  res.json({ items: users.map((u) => u.toJSON()) });
}

async function findUserOr404(id) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function getUser(req, res) {
  const user = await findUserOr404(req.params.id);
  res.json({ user: user.toJSON() });
}

export async function updateUser(req, res) {
  // `role` is deliberately not settable here — privilege changes are not part of a profile
  // edit, and this route is reachable by the user themselves.
  const user = await User.findByIdAndUpdate(req.params.id, profileChanges(req.body), {
    new: true,
    runValidators: true,
  });

  if (!user) throw ApiError.notFound('User not found');
  res.json({ user: user.toJSON() });
}

export async function setUserRole(req, res) {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role: req.body.role },
    { new: true, runValidators: true },
  );

  if (!user) throw ApiError.notFound('User not found');
  res.json({ user: user.toJSON() });
}

export async function deleteUser(req, res) {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  // Orders are kept as business records; the per-user lists are not worth orphaning.
  await Promise.all(
    [CartItem, WishlistItem, SavedLaterItem].map((Model) => Model.deleteMany({ userId: user._id })),
  );

  res.status(204).end();
}

/* ---------------------------------- addresses ---------------------------------- */

const addresses = (user) => user.toJSON().addresses ?? [];

export async function listAddresses(req, res) {
  res.json({ items: addresses(await findUserOr404(req.params.id)) });
}

export async function addAddress(req, res) {
  const user = await findUserOr404(req.params.id);

  user.addresses.push(req.body);
  await user.save();

  res.status(201).json({ items: addresses(user) });
}

/** Both edit and delete resolve the subdocument by id, never by array index. */
async function withAddress(req, mutate) {
  const user = await findUserOr404(req.params.id);

  const address = user.addresses.id(req.params.addressId);
  if (!address) throw ApiError.notFound('Address not found');

  mutate(address);
  await user.save();

  return user;
}

export async function updateAddress(req, res) {
  const user = await withAddress(req, (address) => address.set(req.body));
  res.json({ items: addresses(user) });
}

export async function deleteAddress(req, res) {
  const user = await withAddress(req, (address) => address.deleteOne());
  res.json({ items: addresses(user) });
}
