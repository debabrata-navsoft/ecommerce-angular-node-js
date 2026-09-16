import crypto from 'node:crypto';

import Razorpay from 'razorpay';

import { env, razorpayConfigured } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

let client = null;

function getClient() {
  if (!razorpayConfigured) {
    throw ApiError.unavailable('Razorpay is not configured on this server');
  }
  client ??= new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
  return client;
}

export async function createRazorpayOrder({ amount, receipt, notes }) {
  const order = await getClient().orders.create({
    amount: Math.round(amount * 100), // Razorpay works in paise
    currency: 'INR',
    receipt,
    notes,
  });

  return { id: order.id, amount: order.amount, currency: order.currency };
}

export function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature }) {
  if (!razorpayConfigured) {
    throw ApiError.unavailable('Razorpay is not configured on this server');
  }

  const expected = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature ?? ''), 'utf8');

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const razorpayPublicKey = () => env.razorpay.keyId;
