import { withTransaction } from '../config/db.js';
import { CartItem } from '../models/cart-item.model.js';
import { Order } from '../models/order.model.js';
import { ApiError } from '../utils/api-error.js';
import { toOrderItem } from '../utils/serialize.js';
import { releaseStock, reserveStock } from './inventory.js';
import { priceOrder } from './pricing.js';

/**
 * Builds an order from the server's view of the user's cart. The client sends only the
 * address, shipping choice and payment method — items, prices and totals are all read
 * from the database, so a tampered request cannot buy a ₹50,000 item for ₹1.
 */
export async function createOrderFromCart(user, { address, shippingMethod, paymentMethod }) {
  const rows = await CartItem.find({ userId: user._id }).populate('productId');
  const usable = rows.filter((row) => row.productId?._id);

  if (usable.length === 0) throw ApiError.badRequest('Your cart is empty');

  const items = usable.map(toOrderItem);
  const totals = priceOrder(items, shippingMethod);

  // 'cod' never touches Razorpay, so it is settled the moment it is placed.
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
        },
      ],
      options,
    );

    await CartItem.deleteMany({ userId: user._id }).setOptions(options);

    return order;
  });
}

/**
 * Undoes an order that was placed but never paid for — a dismissed Razorpay modal, a
 * failed card, or a Razorpay outage during creation. Idempotent, because the client may
 * report a dismissal more than once.
 */
export async function abandonOrder(order, { reason = 'failed' } = {}) {
  if (order.paymentStatus === 'paid' || order.paymentStatus === 'confirmed') {
    throw ApiError.badRequest('This order is already paid');
  }
  if (order.status === 'cancelled') return order;

  return withTransaction(async (session) => {
    const options = session ? { session } : {};

    await releaseStock(order.items, session);

    order.status = 'cancelled';
    order.paymentStatus = reason === 'cancelled' ? 'pending' : 'failed';
    await order.save(options);

    return order;
  });
}

/** Customer-initiated cancellation, allowed only before the order ships. */
export async function cancelOrder(order) {
  if (order.status === 'shipped' || order.status === 'delivered') {
    throw ApiError.badRequest(`Cannot cancel an order that is already ${order.status}`);
  }
  if (order.status === 'cancelled') return order;

  return withTransaction(async (session) => {
    const options = session ? { session } : {};

    await releaseStock(order.items, session);

    order.status = 'cancelled';
    await order.save(options);

    return order;
  });
}
