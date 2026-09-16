import { inject, Injectable } from '@angular/core';
import { EMPTY, map, Observable } from 'rxjs';

import { ApiService } from './api.service';
import { Order, OrderAddress, OrderItem } from '../../shared/models/order.model';
import { PaymentMethod } from '../../shared/models/payment.model';

export interface PlaceOrderRequest {
  address: OrderAddress;
  shippingMethod: 'free' | 'express';
  paymentMethod: PaymentMethod;
}

export interface RazorpayHandoff {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
}

export interface PlaceOrderResult {
  order: Order;
  razorpay: RazorpayHandoff | null;
}

export interface PaymentConfig {
  razorpay: { configured: boolean; keyId: string };
}

export interface OrderEvent {
  order: Order;
  visible: boolean;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private api = inject(ApiService);

  getPaymentConfig(): Observable<PaymentConfig> {
    return this.api.get<PaymentConfig>('/payments/config');
  }

  streamOrders(): Observable<OrderEvent> {
    if (!this.api.isBrowser) return EMPTY;

    return new Observable<OrderEvent>((subscriber) => {
      const source = new EventSource(this.api.absoluteUrl('/orders/stream'), {
        withCredentials: true,
      });

      source.addEventListener('order', (event) => {
        try {
          subscriber.next(JSON.parse((event as MessageEvent).data));
        } catch {
        }
      });

      return () => source.close();
    });
  }

  getDiscountPrice(item: OrderItem): number {
    const discount = item.discount ?? 0;
    return item.price - (item.price * discount) / 100;
  }

  placeOrder(request: PlaceOrderRequest): Observable<PlaceOrderResult> {
    return this.api.post<PlaceOrderResult>('/orders', request);
  }

  getUserOrders(): Observable<Order[]> {
    return this.api.get<{ items: Order[] }>('/orders').pipe(map((res) => res.items));
  }

  getOrdersForUser(userId: string): Observable<Order[]> {
    return this.api
      .get<{ items: Order[] }>('/orders/all', { userId })
      .pipe(map((res) => res.items));
  }

  getOrderById(orderId: string): Observable<Order | null> {
    return this.api.get<{ order: Order }>(`/orders/${orderId}`).pipe(map((res) => res.order));
  }

  getAllOrders(): Observable<Order[]> {
    return this.api.get<{ items: Order[] }>('/orders/all').pipe(map((res) => res.items));
  }

  updateOrderStatus(orderId: string, status: Order['status']): Observable<Order> {
    return this.api
      .patch<{ order: Order }>(`/orders/${orderId}/status`, { status })
      .pipe(map((res) => res.order));
  }

  cancelOrder(orderId: string): Observable<Order> {
    return this.api.post<{ order: Order }>(`/orders/${orderId}/cancel`).pipe(map((r) => r.order));
  }

  verifyPayment(
    orderId: string,
    payload: { razorpayPaymentId: string; razorpayOrderId: string; signature: string },
  ): Observable<Order> {
    return this.api
      .post<{ order: Order }>(`/payments/${orderId}/verify`, payload)
      .pipe(map((res) => res.order));
  }

  abandonPayment(orderId: string, reason: 'cancelled' | 'failed'): Observable<Order> {
    return this.api
      .post<{ order: Order }>(`/payments/${orderId}/abandon`, { reason })
      .pipe(map((res) => res.order));
  }
}
