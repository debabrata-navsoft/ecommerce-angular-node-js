import crypto from 'node:crypto';

import { cloudinaryConfigured, env } from '../config/env.js';
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

/** Every partial-update handler below shares this write-then-404 shape. */
async function updateUserOr404(id, changes) {
  const user = await User.findByIdAndUpdate(id, changes, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function getUser(req, res) {
  const user = await findUserOr404(req.params.id);
  res.json({ user: user.toJSON() });
}

/**
 * Signs a direct browser→Cloudinary upload.
 *
 * The file never passes through this server and `CLOUDINARY_API_SECRET` never leaves it —
 * only the HMAC of the upload parameters does. The signature covers `folder`, `timestamp`
 * and `public_id`, so a client cannot redirect the upload somewhere else or reuse it later
 * (Cloudinary rejects a stale timestamp).
 */
export async function getAvatarUploadSignature(req, res) {
  if (!cloudinaryConfigured) {
    throw ApiError.unavailable('Image uploads are not configured on this server');
  }

  const { cloudName, apiKey, apiSecret, folder } = env.cloudinary;
  const timestamp = Math.floor(Date.now() / 1000);

  // One deterministic id per user, so a new avatar overwrites the old rather than
  // accumulating orphans in the account.
  const publicId = `user_${req.params.id}`;

  // Cloudinary signs the parameters sorted by key and joined as a query string.
  const toSign = `folder=${folder}&overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash('sha1')
    .update(toSign + apiSecret)
    .digest('hex');

  res.json({
    cloudName,
    apiKey,
    timestamp,
    folder,
    publicId,
    overwrite: true,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
  });
}

/**
 * Stores the URL Cloudinary returned. The client supplies it, so the host and the account's
 * cloud name are both checked — otherwise any URL could be written onto a profile.
 */
export async function saveAvatar(req, res) {
  if (!cloudinaryConfigured) {
    throw ApiError.unavailable('Image uploads are not configured on this server');
  }

  const { url, publicId } = req.body;
  const expectedPrefix = `https://res.cloudinary.com/${env.cloudinary.cloudName}/`;

  if (typeof url !== 'string' || !url.startsWith(expectedPrefix)) {
    throw ApiError.badRequest('Avatar must be an upload to this account');
  }

  const user = await updateUserOr404(req.params.id, {
    avatarUrl: url,
    avatarPublicId: String(publicId ?? ''),
  });

  res.json({ user: user.toJSON() });
}

export async function removeAvatar(req, res) {
  const user = await updateUserOr404(req.params.id, { avatarUrl: '', avatarPublicId: '' });
  res.json({ user: user.toJSON() });
}

/**
 * Payment preferences. Deliberately limited to a default method and UPI ids — see the
 * note on `paymentPrefsSchema`; no card data is accepted or stored.
 */
export async function updatePaymentPrefs(req, res) {
  const { defaultMethod, upiIds } = req.body;

  const prefs = {};
  if (defaultMethod) prefs['paymentPrefs.defaultMethod'] = defaultMethod;

  if (Array.isArray(upiIds)) {
    prefs['paymentPrefs.upiIds'] = [
      ...new Set(upiIds.map((id) => String(id).trim()).filter(Boolean)),
    ].slice(0, 5);
  }

  const user = await updateUserOr404(req.params.id, prefs);
  res.json({ user: user.toJSON() });
}

export async function updateUser(req, res) {
  // `role` is deliberately not settable here — privilege changes are not part of a profile
  // edit, and this route is reachable by the user themselves.
  const user = await updateUserOr404(req.params.id, profileChanges(req.body));
  res.json({ user: user.toJSON() });
}

export async function setUserRole(req, res) {
  const user = await updateUserOr404(req.params.id, { role: req.body.role });
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
