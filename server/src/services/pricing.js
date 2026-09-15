/**
 * Single source of truth for order maths. The Angular checkout page computes the same
 * figures for display, but the server recomputes them from live product prices at order
 * time and stores its own result — a client-supplied total is never trusted.
 *
 * Mirrors checkout-page.ts: gst = subTotal * 0.18, express shipping = 90, free = 0.
 */

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const GST_RATE = 0.18;

export const SHIPPING_RATES = Object.freeze({
  free: 0,
  express: 90,
});

export function discountedUnitPrice(price, discount = 0) {
  if (!discount) return price;
  return price - (price * discount) / 100;
}

export function lineTotal(item) {
  return discountedUnitPrice(item.price, item.discount) * item.quantity;
}

export function priceOrder(items, shippingMethod = 'free') {
  const shipping = SHIPPING_RATES[shippingMethod] ?? 0;
  const subTotal = round2(items.reduce((acc, item) => acc + lineTotal(item), 0));
  const gst = round2(subTotal * GST_RATE);

  return { subTotal, gst, shipping, total: round2(subTotal + gst + shipping) };
}
