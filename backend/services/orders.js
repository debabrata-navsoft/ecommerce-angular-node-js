import { razorpayConfigured } from '../config/env.js';
import { withTransaction } from '../config/db.js';
import { CartItem } from '../models/cart-item.model.js';
import { Order } from '../models/order.model.js';
import { ApiError } from '../utils/api-error.js';
import { toOrderItem } from '../utils/serialize.js';
import { releaseStock, reserveStock } from './inventory.js';
import { priceOrder } from './pricing.js';

/** Customer-facing wording for each fulfilment step, shown on the tracking page. */
export const STATUS_NOTES = {
  pending: 'Order confirmed and being prepared',
  shipped: 'Your order is on its way',
  delivered: 'Delivered',
  cancelled: 'Order cancelled',
};

/** The one shape of an activity entry. Everything that appends one goes through here. */
const activityEntry = (status, note = '') => ({ status, note, at: new Date() });

/**
 * Appends to the order's activity trail. Callers still have to `save()` — use
 * `setOrderStatus` instead when the fulfilment status itself is changing.
 */
export function recordActivity(order, status, note = '') {
  order.activity = [...(order.activity ?? []), activityEntry(status, note)];
}

/**
 * The single chokepoint for a fulfilment-status change: sets `status`, appends the matching
 * activity entry and saves. Going through here is what stops a new status writer from
 * silently skipping the trail, which is exactly what the raw `$push` in `updateOrderStatus`
 * used to do.
 */
export async function setOrderStatus(order, status, note = STATUS_NOTES[status] ?? '') {
  order.status = status;
  recordActivity(order, status, note);
  await order.save();
  return order;
}

export async function createOrderFromCart(user, { address, shippingMethod, paymentMethod }) {
  // Guarded here rather than in the controller: this function reserves stock and empties
  // the cart, so the rule "never do that for a payment method this server cannot take"
  // belongs with the side effect, where no future caller can skip it.
  if (paymentMethod !== 'cod' && !razorpayConfigured) {
    throw ApiError.unavailable(
      'Online payment is unavailable on this server. Please choose Cash on Delivery.',
    );
  }

  const rows = await CartItem.find({ userId: user._id }).populate('productId');
  const usable = rows.filter((row) => row.productId?._id);

  if (usable.length === 0) throw ApiError.badRequest('Your cart is empty');

  const items = usable.map(toOrderItem);
  const totals = priceOrder(items, shippingMethod);

  const isCod = paymentMethod === 'cod';

  return withTransaction(async (session) => {
    const options = session ? { session } : {};

    await reserveStock(items, session);

    const [order] = await Order.create(
      [
        {
          userId: user._id,
          userEmail: user.email,
          items,
          address,
          subTotal: totals.subTotal,
          gst: totals.gst,
          shipping: totals.shipping,
          total: totals.total,
          shippingMethod,
          status: 'pending',
          paymentMethod,
          paymentStatus: isCod ? 'confirmed' : 'pending',
          activity: [
            activityEntry(
              'pending',
              isCod ? 'Order placed — cash on delivery' : 'Order placed, awaiting payment',
            ),
          ],
        },
      ],
      options,
    );

    await CartItem.deleteMany({ userId: user._id }).setOptions(options);

    return order;
  });
}

async function restoreCart(order, session) {
  const ops = order.items.map((item) => ({
    updateOne: {
      filter: { userId: order.userId, productId: item.productId },
      update: { $setOnInsert: { quantity: item.quantity } },
      upsert: true,
    },
  }));

  if (ops.length > 0) await CartItem.bulkWrite(ops, session ? { session } : {});
}

export async function abandonOrder(order, { reason = 'failed' } = {}) {
  if (order.paymentStatus === 'paid' || order.paymentStatus === 'confirmed') {
    throw ApiError.badRequest('This order is already paid');
  }
  if (order.status === 'cancelled') return order;

  return withTransaction(async (session) => {
    const options = session ? { session } : {};

    await releaseStock(order.items, session);
    await restoreCart(order, session);

    order.status = 'cancelled';
    order.paymentStatus = reason === 'cancelled' ? 'pending' : 'failed';
    recordActivity(
      order,
      'cancelled',
      reason === 'cancelled' ? 'Payment cancelled — items returned to your cart' : 'Payment failed',
    );
    await order.save(options);

    return order;
  });
}

export async function cancelOrder(order) {
  if (order.status === 'shipped' || order.status === 'delivered') {
    throw ApiError.badRequest(`Cannot cancel an order that is already ${order.status}`);
  }
  if (order.status === 'cancelled') return order;

  return withTransaction(async (session) => {
    const options = session ? { session } : {};

    await releaseStock(order.items, session);

    order.status = 'cancelled';
    recordActivity(order, 'cancelled', STATUS_NOTES.cancelled);
    await order.save(options);

    return order;
  });
}
