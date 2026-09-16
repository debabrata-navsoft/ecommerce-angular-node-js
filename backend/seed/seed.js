import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { CartItem } from '../models/cart-item.model.js';
import { SavedLaterItem } from '../models/saved-later-item.model.js';
import { WishlistItem } from '../models/wishlist-item.model.js';
import { Order } from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import { User } from '../models/user.model.js';
import { SAMPLE_PRODUCTS } from './products.data.js';

const reset = process.argv.includes('--reset');

// The admin email is a login credential for /admin, and every login route validates the
// field as an email address — so a bare username here would create an account that can
// never sign in. Fail now with an explanation rather than later with a confusing 400.
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

  // Upsert so re-running the seed rotates the password instead of erroring on the
  // unique email index.
  const admin = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    {
      $set: { passwordHash, role: 'admin' },
      $setOnInsert: { firstName: 'Store', lastName: 'Admin', phoneNumber: [] },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  console.log(`[seed] admin ready: ${admin.email}`);
}

async function seedProducts() {
  if (reset) {
    const { deletedCount } = await Product.deleteMany({});
    console.log(`[seed] removed ${deletedCount} existing products`);
  }

  let created = 0;
  let skipped = 0;

  for (const data of SAMPLE_PRODUCTS) {
    const exists = await Product.exists({ title: data.title });
    if (exists) {
      skipped += 1;
      continue;
    }

    // .create() rather than insertMany so the pre-save hook fills in searchName and
    // discountPrice.
    await Product.create(data);
    created += 1;
  }

  console.log(`[seed] products: ${created} created, ${skipped} already present`);
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
    console.log('[seed] cleared carts, wishlists, saved-later and orders');
  }

  await seedAdmin();
  await seedProducts();

  // Builds the unique/compound indexes declared on the schemas so the first real request
  // is not the thing that creates them.
  await Promise.all([
    User.syncIndexes(),
    Product.syncIndexes(),
    Order.syncIndexes(),
    CartItem.syncIndexes(),
    WishlistItem.syncIndexes(),
    SavedLaterItem.syncIndexes(),
  ]);
  console.log('[seed] indexes synced');

  await disconnectDB();
  console.log('[seed] done');
}

main().catch(async (err) => {
  console.error('[seed] failed:', err.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
