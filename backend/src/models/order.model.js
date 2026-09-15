import crypto from 'node:crypto';

import mongoose from 'mongoose';

import { serializeJson } from '../utils/mongoose-json.js';

const { Schema } = mongoose;

/** Short, URL-safe, unguessable — it appears in /cart/order-success/:id. */
export function generateOrderId() {
  return crypto.randomBytes(9).toString('base64url');
}

const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    title: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false },
);

const orderAddressSchema = new Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    landmark: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pinCode: { type: String, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderId: { type: String, required: true, unique: true, default: generateOrderId },

    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userEmail: { type: String, required: true },

    // Frozen at checkout: prices here must not follow later product edits.
    items: { type: [orderItemSchema], required: true, validate: (v) => v.length > 0 },
    address: { type: orderAddressSchema, required: true },

    subTotal: { type: Number, required: true, min: 0 },
    gst: { type: Number, required: true, min: 0 },
    shipping: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    shippingMethod: { type: String, enum: ['free', 'express'], default: 'free' },

    // Fulfilment state — distinct from paymentStatus, matching models/payment.model.ts.
    status: {
      type: String,
      enum: ['pending', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ['cod', 'upi', 'card', 'emi', 'netbanking'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'confirmed', 'failed'],
      default: 'pending',
    },
    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
  },
  { timestamps: true },
);

// Clients address an order by its public orderId, not the Mongo _id.
serializeJson(orderSchema, {
  after(ret) {
    ret.id = ret.orderId;
    ret.userId = String(ret.userId);
    ret.items = (ret.items ?? []).map((item) => ({ ...item, productId: String(item.productId) }));
  },
});

// Drives both the customer's order history and the admin list.
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });

export const Order = mongoose.model('Order', orderSchema);
