import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { Order, OrderItem } from '../../../shared/models/order.model';
import { PAYMENT_METHOD_LABELS, PaymentMethod } from '../../../shared/models/payment.model';
import { OrderService } from '../../../core/services/order.service';

const MAX_PREVIEW_ITEMS = 3;

/** One order prepared for display: everything the template needs, already derived. */
interface OrderRow {
  order: Order;
  items: (OrderItem & { finalPrice: number })[];
  hiddenCount: number;
  paymentLabel: string;
  isPaid: boolean;
}

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order-history.html',
  styleUrl: './order-history.css',
})
export class OrderHistory {
  private router = inject(Router);
  private orderService = inject(OrderService);

  orders = input<Order[]>([]);

  /**
   * Derived once per `orders()` change rather than per change-detection pass. The template
   * previously called visibleItems()/hiddenCount()/paymentLabel()/getDiscountPrice() from
   * inside its `@for`, so each ran on every CD cycle for every row — and `visibleItems`
   * returned a fresh array each time, defeating the repeater's identity check.
   */
  rows = computed<OrderRow[]>(() =>
    this.orders().map((order) => ({
      order,
      items: order.items.slice(0, MAX_PREVIEW_ITEMS).map((item) => ({
        ...item,
        finalPrice: this.orderService.getDiscountPrice(item),
      })),
      hiddenCount: Math.max(0, order.items.length - MAX_PREVIEW_ITEMS),
      paymentLabel: PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod] ?? 'Online',
      isPaid: order.paymentStatus === 'paid' || order.paymentStatus === 'confirmed',
    })),
  );

  viewProductDetails(productId: string) {
    this.router.navigate(['/products', productId]);
  }
}
