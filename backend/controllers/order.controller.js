import { razorpayConfigured } from '../config/env.js';
import { Order } from '../models/order.model.js';
import { abandonOrder, cancelOrder, createOrderFromCart } from '../services/orders.js';
import { createRazorpayOrder, razorpayPublicKey } from '../services/razorpay.js';
import { ApiError } from '../utils/api-error.js';
import { paginate } from '../utils/paginate.js';

const streamClients = new Set();

export function publishOrder(order) {
  if (streamClients.size === 0) return;

  const payload = JSON.stringify({
    order: order.toJSON(),
    visible: !isAbandoned(order),
  });

  for (const client of streamClients) {
    if (!client.isAdmin && String(client.userId) !== String(order.userId)) continue;

    try {
      client.res.write(`event: order\ndata: ${payload}\n\n`);
    } catch {
    }
  }
}

export async function streamOrders(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(': connected\n\n');

  const client = { userId: req.user._id, isAdmin: req.user.role === 'admin', res };
  streamClients.add(client);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
    }
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    streamClients.delete(client);
    res.end();
  });
}

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

  if (paymentMethod !== 'cod' && !razorpayConfigured) {
    throw ApiError.unavailable(
      'Online payment is unavailable on this server. Please choose Cash on Delivery.',
    );
  }

  const order = await createOrderFromCart(req.user, { address, shippingMethod, paymentMethod });

  if (paymentMethod === 'cod') {
    publishOrder(order);
    return res.status(201).json({ order: order.toJSON(), razorpay: null });
  }

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

const ABANDONED_PAYMENT_STATES = ['pending', 'failed'];

const NOT_ABANDONED = {
  $nor: [{ status: 'cancelled', paymentStatus: { $in: ABANDONED_PAYMENT_STATES } }],
};

function isAbandoned(order) {
  return order.status === 'cancelled' && ABANDONED_PAYMENT_STATES.includes(order.paymentStatus);
}

export async function listMyOrders(req, res) {
  const orders = await Order.find({ userId: req.user._id, ...NOT_ABANDONED }).sort({
    createdAt: -1,
  });

  res.json({ items: orders.map((o) => o.toJSON()) });
}

export async function listAllOrders(req, res) {
  const filter = req.query.includeAbandoned === 'true' ? {} : { ...NOT_ABANDONED };

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

  if (status === 'cancelled') return cancelMyOrder(req, res);

  const order = await Order.findOneAndUpdate(
    { orderId: req.params.orderId },
    { status },
    { new: true, runValidators: true },
  );

  if (!order) throw ApiError.notFound('Order not found');

  publishOrder(order);
  res.json({ order: order.toJSON() });
}

export async function cancelMyOrder(req, res) {
  const order = await cancelOrder(await loadOwnedOrder(req));

  publishOrder(order);
  res.json({ order: order.toJSON() });
}
