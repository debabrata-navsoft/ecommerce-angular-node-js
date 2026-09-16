export interface AddressUser {
  id?: string;
  createdAt?: number;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  landmark?: string;
  city: string;
  state: string;
  pinCode: string | number;
}

export type PaymentMethodPref = 'cod' | 'upi' | 'card' | 'emi' | 'netbanking';

/**
 * Preferences only. **No card data** — the API refuses to store it, since holding a card
 * number would put the app in PCI scope. Razorpay owns the card flow.
 */
export interface PaymentPrefs {
  defaultMethod: PaymentMethodPref;
  upiIds: string[];
}

export interface User {
  uid?: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string[];
  role?: 'user' | 'admin';

  /** Cloudinary `secure_url`, empty when no avatar has been uploaded. */
  avatarUrl?: string;
  paymentPrefs?: PaymentPrefs;

  /** Virtual on the API's user model: `${firstName} ${lastName}`. Read-only. */
  displayName?: string;

  addresses?: AddressUser[];
  createdAt?: any;
}

export type ProfileForm = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
};
