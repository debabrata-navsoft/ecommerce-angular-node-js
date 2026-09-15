import { Order } from '../models/order.model.js';
import { abandonOrder, cancelOrder, createOrderFromCart } from '../services/orders.js';
import { createRazorpayOrder, razorpayPublicKey } from '../services/razorpay.js';
import { ApiError } from '../utils/api-error.js';
import { paginate } from '../utils/paginate.js';

/** Loads an order and enforces that the caller owns it, unless they are an admin. */
export async function loadOwnedOrder(req) {
  const order = await Order.findOne({ orderId: req.params.orderId });
  if (!order) throw ApiError.notFound('Order not found');

  const isOwner = String(order.userId) === String(req.user._id);
  if (!isOwner && req.user.role !== 'admin') throw ApiError.forbidden();

  return order;
}

export async function placeOrder(req, res) {
  const { address, shippingMethod = 'free', paymentMethod } = req.body;

  const order = await createOrderFromCart(req.user, { address, shippingMethod, paymentMethod });

  if (paymentMethod === 'cod') {
    return res.status(201).json({ order: order.toJSON(), razorpay: null });
  }

  // The Razorpay order is created here so the client gets everything it needs to open the
  // checkout in a single round trip.
  try {
    const rp = await createRazorpayOrder({
      amount: order.total,
      receipt: order.orderId,
      notes: { orderId: order.orderId, userId: String(order.userId) },
    });

    order.razorpayOrderId = rp.id;
    await order.save();

    res.status(201).json({
      order: order.toJSON(),
      razorpay: { keyId: razorpayPublicKey(), ...rp, orderId: rp.id },
    });
  } catch (err) {
    // Roll the order back rather than leaving reserved stock behind an order that can
    // never be paid.
    await abandonOrder(order).catch(() => {});
    throw err;
  }
}

export async function listMyOrders(req, res) {
  const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ items: orders.map((o) => o.toJSON()) });
}

/**
 * Admin view of every order. Firestore needed the `orders/{id}` mirror of
 * `users/{uid}/orders/{id}` to make this query possible; one indexed collection now
 * serves both, so there is no second write to keep in sync.
 */
export async function listAllOrders(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.userId) filter.userId = req.query.userId;

  res.json(await paginate(Order, filter, { createdAt: -1 }, req.query));
}

export async function getOrder(req, res) {
  const order = await loadOwnedOrder(req);
  res.json({ order: order.toJSON() });
}

export async function updateOrderStatus(req, res) {
  const { status } = req.body;

  // Cancelling has to return the reserved stock, so it goes through the service rather
  // than a bare status write.
  if (status === 'cancelled') return cancelMyOrder(req, res);

  const order = await Order.findOneAndUpdate(
    { orderId: req.params.orderId },
    { status },
    { new: true, runValidators: true },
  );

  if (!order) throw ApiError.notFound('Order not found');
  res.json({ order: order.toJSON() });
}

export async function cancelMyOrder(req, res) {
  const order = await cancelOrder(await loadOwnedOrder(req));
  res.json({ order: order.toJSON() });
}
