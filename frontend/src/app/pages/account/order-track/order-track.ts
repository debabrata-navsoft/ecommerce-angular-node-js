import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Loader } from '../../../shared/components/loader/loader';
import { Order, OrderActivity, OrderItem } from '../../../shared/models/order.model';
import { LoaderService } from '../../../core/services/loader.service';
import { OrderService } from '../../../core/services/order.service';

/** The happy path, in order. Cancelled is handled separately since it ends the track. */
const STEPS: { status: Order['status']; label: string; blurb: string }[] = [
  { status: 'pending', label: 'Order placed', blurb: 'We have your order and are preparing it.' },
  { status: 'shipped', label: 'Shipped', blurb: 'Your order is on its way.' },
  { status: 'delivered', label: 'Delivered', blurb: 'Your order has arrived.' },
];

@Component({
  selector: 'app-order-track',
  standalone: true,
  imports: [CommonModule, RouterLink, Loader],
  templateUrl: './order-track.html',
  styleUrl: './order-track.css',
})
export class OrderTrack implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orderService = inject(OrderService);
  private loaderService = inject(LoaderService);
  private destroyRef = inject(DestroyRef);

  isLoading = this.loaderService.isLoading;

  order = signal<Order | null>(null);
  notFound = signal(false);

  readonly steps = STEPS;

  cancelled = computed(() => this.order()?.status === 'cancelled');

  /** Newest first, so the most recent update reads at the top of the activity list. */
  activity = computed<OrderActivity[]>(() =>
    [...(this.order()?.activity ?? [])].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    ),
  );

  /** How far along the happy path we are; -1 once cancelled. */
  currentStep = computed(() => {
    const status = this.order()?.status;
    if (!status || status === 'cancelled') return -1;
    return STEPS.findIndex((s) => s.status === status);
  });

  /** The timestamp a given step happened, or null if it has not yet. */
  stepAt(status: Order['status']): string | number | null {
    const hit = (this.order()?.activity ?? []).find((a) => a.status === status);
    return hit?.at ?? null;
  }

  ngOnInit() {
    const orderId = this.route.snapshot.paramMap.get('orderId');
    if (!orderId) {
      this.router.navigate(['/account']);
      return;
    }

    this.loaderService.show();

    const sub = this.orderService.getOrderById(orderId).subscribe({
      next: (order) => {
        if (order) this.order.set(order);
        else this.notFound.set(true);
        this.loaderService.hide();
      },
      error: () => {
        this.notFound.set(true);
        this.loaderService.hide();
      },
    });

    // Live feed: an admin moving the order to shipped updates this page in place.
    const streamSub = this.orderService.streamOrders().subscribe({
      next: ({ order }) => {
        if (order.orderId === orderId) this.order.set(order);
      },
      error: () => undefined,
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
      streamSub.unsubscribe();
    });
  }

  getDiscountPrice(item: OrderItem): number {
    return this.orderService.getDiscountPrice(item);
  }

  viewProduct(productId: string) {
    this.router.navigate(['/products', productId]);
  }
}
