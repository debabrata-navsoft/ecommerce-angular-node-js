export interface OrderItem {
  productId: string;
  title: string;
  image: string;
  price: number;
  quantity: number;
  discount?: number;
}

export interface OrderAddress {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  landmark?: string;
  city: string;
  state: string;
  pinCode: string;
}

/** One step in the order's history, appended server-side on every status write. */
export interface OrderActivity {
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  note?: string;
  at: string | number;
}

export interface Order {
  orderId?: string;
  userId: string;
  userEmail?: string;
  items: OrderItem[];
  address: OrderAddress;
  subTotal: number;
  gst: number;
  shipping?: number;
  total: number;
  shippingMethod: string;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus?: 'pending' | 'paid' | 'confirmed' | 'failed';
  paymentMethod?: string;
  activity?: OrderActivity[];
  createdAt: number | null;
}
