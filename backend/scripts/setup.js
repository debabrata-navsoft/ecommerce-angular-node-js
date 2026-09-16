import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { CartItem } from '../models/cart-item.model.js';
import { SavedLaterItem } from '../models/saved-later-item.model.js';
import { WishlistItem } from '../models/wishlist-item.model.js';
import { Order } from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import { User } from '../models/user.model.js';

const reset = process.argv.includes('--reset');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function seedAdmin() {
  const { email, password } = env.seedAdmin;

  if (!EMAIL_RE.test(email)) {
    throw new Error(
      `SEED_ADMIN_EMAIL="${email}" is not an email address. The admin signs in with an ` +
        'email, so use something like admin@example.com.',
    );
  }

  if (password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters.');
  }

  const passwordHash = await User.hashPassword(password);

  const admin = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    {
      $set: { passwordHash, role: 'admin' },
      $setOnInsert: { firstName: 'Store', lastName: 'Admin', phoneNumber: [] },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  console.log(`[setup] admin ready: ${admin.email}`);
}

async function main() {
  await connectDB();

  if (reset) {
    await Promise.all([
      CartItem.deleteMany({}),
      WishlistItem.deleteMany({}),
      SavedLaterItem.deleteMany({}),
      Order.deleteMany({}),
    ]);
    console.log('[setup] cleared carts, wishlists, saved-later and orders');
  }

  await seedAdmin();

  await Promise.all([
    User.syncIndexes(),
    Product.syncIndexes(),
    Order.syncIndexes(),
    CartItem.syncIndexes(),
    WishlistItem.syncIndexes(),
    SavedLaterItem.syncIndexes(),
  ]);
  console.log('[setup] indexes synced');

  await disconnectDB();
  console.log('[setup] done');
}

main().catch(async (err) => {
  console.error('[setup] failed:', err.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
