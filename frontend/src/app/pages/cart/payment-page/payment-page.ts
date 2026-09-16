import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { Loader } from '../../../shared/components/loader/loader';
import { PaymentMethod } from '../../../shared/models/payment.model';
import { TruncatePipe } from '../../../shared/pipes/truncate.pipe';
import { CartService } from '../../../core/services/cart.service';
import { LoaderService } from '../../../core/services/loader.service';
import { OrderService, PlaceOrderResult } from '../../../core/services/order.service';
import { RazorpayService, RazorpaySuccess } from '../../../core/services/razorpay.service';
import { SnackbarService } from '../../../core/services/snackbar.service';

@Component({
  selector: 'app-payment-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TruncatePipe, Loader],
  templateUrl: './payment-page.html',
  styleUrl: './payment-page.css',
})
export class PaymentPage {
  private router = inject(Router);
  private orderService = inject(OrderService);
  private loaderService = inject(LoaderService);
  private snackbar = inject(SnackbarService);
  private cartService = inject(CartService);
  private razorpayService = inject(RazorpayService);
  private destroyRef = inject(DestroyRef);

  isLoading = this.loaderService.isLoading;
  selectedMethod = signal<PaymentMethod>('cod');
  orderData = signal<any>(null);

  /** False once the server reports it has no Razorpay keys; the online cards then lock. */
  onlineAvailable = signal(true);

  private paying = signal(false);

  form = {
    upiId: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
  };

  constructor() {
    const nav = this.router.currentNavigation();
    const state = nav?.extras?.state as { orderData: any };

    if (state?.orderData) {
      this.orderData.set(state.orderData);
    } else {
      this.snackbar.error('Session expired. Please try again.');
      this.router.navigate(['/']);
      return;
    }

    const sub = this.orderService.getPaymentConfig().subscribe({
      next: (config) => {
        this.onlineAvailable.set(config.razorpay.configured);
        if (!config.razorpay.configured) this.selectedMethod.set('cod');
      },

      error: () => undefined,
    });

    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  select(method: PaymentMethod) {
    if (method !== 'cod' && !this.onlineAvailable()) {
      this.snackbar.error('Online payment is unavailable right now. Please use Cash on Delivery.');
      return;
    }
    this.selectedMethod.set(method);
  }

  payNow() {
    const data = this.orderData();
    if (!data) {
      this.snackbar.error('Order data missing!');
      return;
    }
    if (this.paying()) return;

    this.paying.set(true);
    this.loaderService.show();

    const sub = this.orderService
      .placeOrder({
        address: data.address,
        shippingMethod: data.shippingMethod === 'express' ? 'express' : 'free',
        paymentMethod: this.selectedMethod(),
      })
      .subscribe({
        next: (result) => {
          if (this.selectedMethod() === 'cod') {
            this.finish(result.order.orderId!);
            return;
          }
          this.openCheckout(result, data);
        },
        error: (err: Error) => {
          this.stop();
          this.snackbar.error(err.message || 'Could not place the order. Please try again.');
        },
      });

    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  private openCheckout(result: PlaceOrderResult, data: any) {
    const orderId = result.order.orderId!;

    if (!result.razorpay) {
      this.stop();
      this.snackbar.error(
        'Online payment is unavailable right now. Please choose Cash on Delivery.',
      );
      this.orderService.abandonPayment(orderId, 'failed').subscribe({
        next: () => this.cartService.loadCart(),
        error: () => this.cartService.loadCart(),
      });
      return;
    }

    this.loaderService.hide();

    this.razorpayService
      .openPayment(
        result.razorpay,
        this.selectedMethod(),
        {
          name: data.address?.fullName || '',
          email: data.userEmail || '',
          contact: data.address?.phone || '',
        },
        (payment: RazorpaySuccess) => this.verify(orderId, payment),
        () => this.release(orderId, 'cancelled', 'Payment cancelled.'),
        (error: any) =>
          this.release(orderId, 'failed', 'Payment failed: ' + (error?.description ?? '')),
      )
      .catch((err: Error) => {
        this.release(orderId, 'failed', err.message || 'Could not open the payment window.');
      });
  }

  private verify(orderId: string, payment: RazorpaySuccess) {
    this.loaderService.show();

    this.orderService.verifyPayment(orderId, payment).subscribe({
      next: () => this.finish(orderId),
      error: (err: Error) => {
        this.stop();
        this.cartService.loadCart();
        this.snackbar.error(err.message || 'We could not verify the payment. Contact support.');
      },
    });
  }

  private release(orderId: string, reason: 'cancelled' | 'failed', message: string) {
    this.stop();
    this.snackbar.error(message);
    this.orderService.abandonPayment(orderId, reason).subscribe({
      next: () => this.cartService.loadCart(),
      error: () => this.cartService.loadCart(),
    });
  }

  private finish(orderId: string) {
    this.stop();
    this.cartService.cart.set([]);
    this.snackbar.success('Order placed successfully!');
    this.router.navigate(['/cart/order-success', orderId]);
  }

  private stop() {
    this.paying.set(false);
    this.loaderService.hide();
  }
}
