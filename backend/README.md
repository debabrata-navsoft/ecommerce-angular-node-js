# ecommerce-api

Node.js + Express 5 + MongoDB (Mongoose) backend for the Angular app in the sibling
`frontend/` directory. Plain ESM JavaScript (`"type": "module"`) — no build step.

MongoDB collections for data, JWT + bcrypt for auth, with roles on the user document.

## Layout

`server.js` is the only entry point: it builds the Express app (exported as
`createApp()` so it can be mounted in a test without opening a port) and starts it.
Source sits directly in the package root — there is no `src/` wrapper.

```
server.js            entry point — app wiring + startServer()
config/              env (loads .env from the package root), db connection
models/              Mongoose schemas
controllers/         plain async request handlers
routes/              express-validator chains + wiring
services/            business logic (orders, inventory, pricing, line lists, razorpay)
middleware/          auth, validation, error handling
utils/               ApiError, JWT, shared serialization + paging
scripts/             setup.js — admin-user upsert + index sync
```

Handlers are plain `async function`s with **no** try/catch wrapper — Express 5 forwards a
rejected promise to the error handler on its own, so throwing `ApiError.notFound(...)`
from inside an async handler is enough.

## Setup

```bash
cd backend
npm install
cp .env.example .env        # then fill in MONGODB_URI and JWT_SECRET
npm run setup               # creates the admin user, builds indexes
npm run dev                 # node --watch, http://localhost:5000
```

`npm run setup:reset` wipes carts, wishlists, saved-later and orders first. It does **not**
touch products — there is no sample catalogue to restore them from, so the catalogue is
only ever changed through the admin UI or the API.

Re-running the plain setup is safe: it upserts the admin (rotating the password to whatever
`SEED_ADMIN_PASSWORD` currently is) and re-syncs indexes.

### Environment

| Variable | Notes |
| --- | --- |
| `MONGODB_URI` | Include the database name in the path, or the driver silently uses `test`. |
| `JWT_SECRET` | **Required** — the server refuses to boot without it. Use 48 random bytes; a guessable secret lets anyone mint a `role=admin` token. |
| `CORS_ORIGINS` | Comma-separated. Credentialed requests cannot use a wildcard, so the Angular origin must be listed. |
| `RAZORPAY_KEY_ID` / `_SECRET` | Both required for online payment. Without them `/api/payments/*` returns 503 and only `cod` orders work. The secret is **not** the key id — copy it from the Razorpay dashboard. |
| `SEED_ADMIN_EMAIL` | Must be a real email address; every login route validates the field as one. |

## Auth model

The session is a **httpOnly cookie** (`access_token`), so the token is unreachable from
JavaScript — unlike the old `localStorage.session_role`. `Authorization: Bearer …` also
works for non-browser clients.

Two login routes over one credential store, preserving the app's customer/admin split:

- `POST /api/auth/login` accepts **only** `role: 'user'`
- `POST /api/auth/admin/login` accepts **only** `role: 'admin'`

Each refuses the other's role, so this is now enforced server-side rather than by the
Angular service — calling the API directly cannot bypass it. `authenticate` re-reads the
user on every request, so a role change or deletion takes effect immediately instead of
waiting for the token to expire.

## Endpoints

`GET /api/health` — status + connection state.

### Auth
| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/auth/signup` | public |
| POST | `/api/auth/login` | public (role `user` only) |
| POST | `/api/auth/admin/login` | public (role `admin` only) |
| POST | `/api/auth/logout` | public |
| GET | `/api/auth/me` | public (returns `{ user: null }` when anonymous) |
| PATCH | `/api/auth/me` | authed |
| POST | `/api/auth/change-password` | authed |

### Products
| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/products` | public |
| GET | `/api/products/:id` | public (increments `views`) |
| GET | `/api/products/feed/trending` | public |
| GET | `/api/products/feed/best-sellers` | public |
| GET | `/api/products/feed/today-deals` | public (discount ≥ 70) |
| GET | `/api/products/feed/discounted` | public (discount ≥ 50) |
| POST / PATCH / DELETE | `/api/products[/:id]` | admin |

`GET /api/products` filters: `category` (matches `category` **or** `subCategory`), `main`,
`subCategory`, `brand`, `search`, `minDiscount`, `minPrice`, `maxPrice`, `inStock`,
`sort` (`newest`\|`oldest`\|`price-asc`\|`price-desc`\|`discount`\|`rating`), `page`,
`limit` (omit or `0` for everything, max 200).

The ranked feeds are Mongo aggregations using the same score weights the browser used to
apply after downloading the entire collection:

- best sellers — `sales*3 + rating*2 + discount*0.5`, top 20
- trending — `views*0.5 + rating*1.5 + discount*0.3`, excluding those top 20

### Users
| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/users` | admin |
| GET / PATCH | `/api/users/:id` | self or admin |
| DELETE | `/api/users/:id` | admin |
| PATCH | `/api/users/:id/role` | admin |
| GET / POST | `/api/users/:id/addresses` | self or admin |
| PATCH / DELETE | `/api/users/:id/addresses/:addressId` | self or admin |

Addresses are keyed by **id**, not array index. `PATCH /api/users/:id` deliberately
ignores `role` and `addresses` — privilege changes and address edits have their own routes.

### Cart / wishlist / saved-later

All authed, all scoped to the caller — there is no `userId` in any of these paths.

| Method | Path |
| --- | --- |
| GET / DELETE | `/api/cart` |
| POST | `/api/cart` — body `{ productId }`, increments if present |
| PATCH / DELETE | `/api/cart/:productId` — body `{ quantity }` (0 removes) |
| POST | `/api/cart/:productId/save-for-later` |
| GET / POST | `/api/wishlist`, DELETE `/api/wishlist/:productId` |
| GET / POST | `/api/saved-later`, DELETE `/api/saved-later/:productId` |
| POST | `/api/saved-later/:productId/move-to-cart` |

Every mutation returns the full updated list, so the client reconciles against the server
instead of guessing.

These three collections store only `{ userId, productId, quantity }` and resolve the
product with `populate` on read — so a price or stock edit is reflected everywhere at
once. Orders are the deliberate exception and embed a frozen snapshot.

`save-for-later` and `move-to-cart` do both halves of the move in one request. Previously
the caller had to remember to call two services, and forgetting one lost the item.

### Orders
| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/orders` | own orders |
| GET | `/api/orders/all` | admin (filters: `status`, `userId`, `page`, `limit`) |
| POST | `/api/orders` | authed |
| GET | `/api/orders/:orderId` | owner or admin |
| POST | `/api/orders/:orderId/cancel` | owner or admin (before shipping) |
| PATCH | `/api/orders/:orderId/status` | admin |

`POST /api/orders` takes **only** `{ address, shippingMethod, paymentMethod }`. Items,
prices and totals are read from the user's cart and recomputed server-side — a client
cannot set its own `total`. Totals match the Angular checkout page: `gst = subTotal * 0.18`,
`express` shipping = 90, `free` = 0.

Placing an order reserves stock with a conditional update
(`{ stock: { $gte: quantity } }`), so two shoppers racing for the last unit cannot both
succeed, and clears the cart.

Firestore needed every order written twice (`users/{uid}/orders/{id}` **and**
`orders/{id}`) so admins could query them all. One indexed collection now serves both
views — there is no second write to keep in sync.

### Payments
| Method | Path |
| --- | --- |
| GET | `/api/payments/config` |
| POST | `/api/payments/:orderId/verify` |
| POST | `/api/payments/:orderId/abandon` |

Flow is **order → pay → verify**:

1. `POST /api/orders` with a non-`cod` method returns the order plus a Razorpay
   `{ keyId, orderId, amount, currency }`.
2. The browser opens the Razorpay checkout bound to that `order_id`.
3. `POST /api/payments/:orderId/verify` recomputes the HMAC over
   `<order_id>|<payment_id>` with the secret and only then marks the order `paid`.

This is the main security fix over the previous flow, which paid first and then created
the order from a browser-supplied `razorpay_payment_id` that was never verified.

`abandon` releases the reserved stock when the modal is dismissed or the payment fails.
`cod` skips Razorpay entirely and is written `paymentStatus: 'confirmed'`.

## Collections

```
users             # profile, passwordHash (select:false), role, addresses[]
products
cartitems         # { userId, productId, quantity }, unique (userId, productId)
wishlistitems     # same shape
savedlateritems   # same shape
orders            # embedded item snapshots + address; indexed { userId, createdAt }
```

Note the two distinct order states, matching `models/payment.model.ts`:
`status` is fulfilment (`pending`/`shipped`/`delivered`/`cancelled`) and `paymentStatus`
is payment (`pending`/`paid`/`confirmed`/`failed`).

## Errors

Every failure returns the same envelope, so the Angular `ApiService` can surface
`message` directly:

```json
{ "message": "Validation failed", "details": [{ "field": "email", "message": "..." }] }
```

`401` unauthenticated · `403` wrong role or not the owner · `404` missing · `409`
duplicate · `400` validation, bad id, insufficient stock · `503` Razorpay not configured.

## Transactions

Multi-document writes go through `withTransaction`, which falls back to running
sequentially when the server does not support transactions — a standalone `mongod`, the
common local setup, does not. Atlas and any replica set get real atomicity. Where the
fallback applies, stock reservation unwinds by hand on failure.
