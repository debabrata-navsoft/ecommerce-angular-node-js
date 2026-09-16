import { razorpayConfigured } from '../config/env.js';
import { abandonOrder } from '../services/orders.js';
import { razorpayPublicKey, verifyPaymentSignature } from '../services/razorpay.js';
import { ApiError } from '../utils/api-error.js';
import { loadOwnedOrder, publishOrder } from './order.controller.js';

export async function getPaymentConfig(_req, res) {
  res.json({ razorpay: { configured: razorpayConfigured, keyId: razorpayPublicKey() } });
}

export async function verifyPayment(req, res) {
  const { razorpayPaymentId, razorpayOrderId, signature } = req.body;
  const order = await loadOwnedOrder(req);

  if (['paid', 'confirmed'].includes(order.paymentStatus)) {
    return res.json({ order: order.toJSON() });
  }

  if (order.status === 'cancelled') {
    throw ApiError.badRequest('This order was cancelled and can no longer be paid');
  }

  if (!order.razorpayOrderId || order.razorpayOrderId !== razorpayOrderId) {
    throw ApiError.badRequest('Payment does not belong to this order');
  }

  if (!verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature })) {
    await abandonOrder(order).catch(() => {});
    throw ApiError.badRequest('Payment signature verification failed');
  }

  order.paymentStatus = 'paid';
  order.razorpayPaymentId = razorpayPaymentId;
  await order.save();

  publishOrder(order);
  res.json({ order: order.toJSON() });
}

/** Called when the user dismisses the Razorpay modal or the payment fails outright. */
export async function abandonPayment(req, res) {
  const reason = req.body?.reason === 'cancelled' ? 'cancelled' : 'failed';
  const order = await abandonOrder(await loadOwnedOrder(req), { reason });

  publishOrder(order);
  res.json({ order: order.toJSON() });
}
