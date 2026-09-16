import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, switchMap } from 'rxjs';

import { AuthService } from '../../../core/services/auth-user.service';
import { mergeOrderEvent, OrderService } from '../../../core/services/order.service';
import { UserService } from '../../../core/services/user.service';
import { PAYMENT_METHODS } from '../../../shared/models/payment.model';
import { ProfileDetails } from '../profile-details/profile-details';
import { Address } from '../address/address';
import { OrderHistory } from '../order-history/order-history';
import { PaymentMethodPref, PaymentPrefs, User } from '../../../shared/models/user.model';
import { Order } from '../../../shared/models/order.model';
import { SnackbarService } from '../../../core/services/snackbar.service';
import { LoaderService } from '../../../core/services/loader.service';
import { Loader } from '../../../shared/components/loader/loader';

/** `handle@psp` — the PSP suffix has no dot, unlike an email domain. */
const UPI_RE = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [ProfileDetails, Address, OrderHistory, Loader, FormsModule, MatIconModule],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePage implements OnInit {
  private authService = inject(AuthService);
  private orderService = inject(OrderService);
  private userService = inject(UserService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private snackBar = inject(SnackbarService);
  private loaderService = inject(LoaderService);

  isLoading = this.loaderService.isLoading;

  orders = signal<Order[]>([]);
  user = signal<User | null>(null);
  activeSection = 'orders';

  // --- avatar ---

  uploadingAvatar = signal(false);

  onAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Clear immediately so picking the same file twice still fires a change event.
    input.value = '';

    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      this.snackBar.error('Choose a PNG, JPG or WebP image');
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      this.snackBar.error('Image must be under 5 MB');
      return;
    }

    const uid = this.user()?.uid;
    if (!uid) return;

    this.uploadingAvatar.set(true);

    this.userService
      .uploadAvatar(uid, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.user.set(user);
          this.uploadingAvatar.set(false);
          this.snackBar.success('Profile photo updated');
        },
        error: (err: Error) => {
          this.uploadingAvatar.set(false);
          this.snackBar.error(err.message || 'Could not upload the photo');
        },
      });
  }

  removeAvatar() {
    const uid = this.user()?.uid;
    if (!uid) return;

    this.userService
      .removeAvatar(uid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.user.set(user);
          this.snackBar.success('Profile photo removed');
        },
        error: (err: Error) => this.snackBar.error(err.message || 'Could not remove the photo'),
      });
  }

  // --- payment preferences (no card data; see PaymentPrefs) ---

  readonly paymentMethods = PAYMENT_METHODS;

  defaultMethod = computed<PaymentMethodPref>(
    () => this.user()?.paymentPrefs?.defaultMethod ?? 'cod',
  );

  upiIds = computed(() => this.user()?.paymentPrefs?.upiIds ?? []);

  newUpi = signal('');
  upiError = signal('');

  setDefaultMethod(method: PaymentMethodPref) {
    if (method === this.defaultMethod()) return;
    this.savePrefs({ defaultMethod: method }, 'Preferred payment method updated');
  }

  addUpi() {
    const id = this.newUpi().trim();

    if (!UPI_RE.test(id)) {
      this.upiError.set('Enter a valid UPI id, like yourname@bank');
      return;
    }

    if (this.upiIds().includes(id)) {
      this.upiError.set('That UPI id is already saved');
      return;
    }

    this.upiError.set('');
    this.savePrefs({ upiIds: [...this.upiIds(), id] }, 'UPI id saved');
    this.newUpi.set('');
  }

  removeUpi(id: string) {
    this.savePrefs(
      { upiIds: this.upiIds().filter((existing) => existing !== id) },
      'UPI id removed',
    );
  }

  private savePrefs(prefs: Partial<PaymentPrefs>, message: string) {
    const uid = this.user()?.uid;
    if (!uid) return;

    this.userService
      .updatePaymentPrefs(uid, prefs)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.user.set(user);
          this.snackBar.success(message);
        },
        error: (err: Error) =>
          this.snackBar.error(err.message || 'Could not save your preferences'),
      });
  }

  ngOnInit() {
    this.loaderService.show();

    const userSub = this.authService
      .getFullUser()
      .pipe(
        switchMap((user) => {
          this.user.set(user);
          if (!user?.uid) {
            this.orders.set([]);
            return EMPTY;
          }
          return this.orderService.getUserOrders();
        }),
      )
      .subscribe({
        next: (orders) => {
          this.orders.set(orders);
          this.loaderService.hide();
        },

        error: (err) => {
          console.error('Fetch error:', err);
          this.loaderService.hide();
        },
      });

    const streamSub = this.orderService.streamOrders().subscribe({
      next: (event) => this.orders.update((list) => mergeOrderEvent(list, event)),
      error: (err) => console.error('Order stream error:', err),
    });

    this.destroyRef.onDestroy(() => streamSub.unsubscribe());

    // const userSub = this.authService.getFullUser().subscribe({
    //   next: (user) => {
    //     this.user.set(user);

    //     if (!user?.uid) {
    //       this.loaderService.hide();
    //       return;
    //     }

    //     const orderSub = this.orderService.getUserOrders(user.uid).subscribe({
    //       next: (orders) => {
    //         this.orders.set(
    //           orders.map((o: Order) => ({
    //             ...o,
    //             // date: o.date?.toDate ? o.date.toDate() : o.date,
    //           })),
    //         );
    //         this.loaderService.hide();
    //       },
    //       error: (err) => {
    //         console.error('Orders error:', err);
    //         this.loaderService.hide();
    //       },
    //     });

    //     this.destroyRef.onDestroy(() => {
    //       orderSub.unsubscribe();
    //     });
    //   },

    //   error: (err) => {
    //     console.error('User error:', err);
    //     this.loaderService.hide();
    //   },
    // });

    this.destroyRef.onDestroy(() => {
      userSub.unsubscribe();
    });
  }

  changeSection(section: string) {
    this.activeSection = section;
  }

  logout() {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/login']);
      this.snackBar.success('Logged out successfully');
    });
  }

  // logout() {
  //   this.authService.logout();
  //   this.router.navigate(['/login']);
  // }
}
