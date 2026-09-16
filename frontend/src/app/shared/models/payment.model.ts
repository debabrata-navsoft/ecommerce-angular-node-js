export type PaymentMethod = 'cod' | 'upi' | 'card' | 'emi' | 'netbanking';

export type PaymentStatus = 'pending' | 'paid' | 'confirmed' | 'failed';

/**
 * The one place these labels are written. Order history and the profile's preferred-method
 * chips each used to carry their own copy, so a renamed label only ever landed on one
 * screen.
 */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: 'Cash on Delivery',
  upi: 'UPI',
  card: 'Card',
  emi: 'EMI',
  netbanking: 'Net Banking',
};

/** The same data as a list, for rendering options in a stable order. */
export const PAYMENT_METHODS = (Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(
  (value) => ({ value, label: PAYMENT_METHOD_LABELS[value] }),
);

export interface PaymentData {
  userId: string;
  userEmail: string;
  total: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  razorpayPaymentId?: string;
  address: {
    fullName: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
}
