import { Component, computed, DestroyRef, effect, inject, input, output, signal } from '@angular/core';

import { AddressUser, User } from '../../../../shared/models/user.model';
import { UserService } from '../../../../core/services/user.service';
import { SnackbarService } from '../../../../core/services/snackbar.service';
import { AddressForm, emptyAddress } from '../../../../shared/components/address-form/address-form';

@Component({
  selector: 'app-checkout-address',
  standalone: true,
  imports: [AddressForm],
  templateUrl: './checkout-address.html',
  styleUrl: './checkout-address.css',
})
export class CheckoutAddress {
  private userService = inject(UserService);
  private snackbar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);

  user = input<User | null>();
  addressSelected = output<AddressUser>();

  userData = signal<User | null>(null);
  editingIndex = signal<number | null>(null);
  selectedAddress = signal<AddressUser | null>(null);
  selectedIndex = signal<number | null>(null);

  showAll = signal(false);
  showAddressPopup = signal(false);

  /** Seed handed to AddressForm; the dialog owns the draft and its validation. */
  newAddress = signal<AddressUser>(emptyAddress());

  constructor() {
    effect(() => {
      const u = this.user();
      if (!u?.uid) return;

      const userSub = this.userService.getUserById(u.uid).subscribe((user) => {
        this.userData.set(user);
      });
      this.destroyRef.onDestroy(() => {
        userSub.unsubscribe();
      });
    });
  }

  editAddress(addr: AddressUser, index: number) {
    this.newAddress.set({ ...addr });
    this.editingIndex.set(index);
    this.showAddressPopup.set(true);
  }

  selectAddress(addr: AddressUser, index: number) {
    this.selectedAddress.set(addr);
    this.selectedIndex.set(index);
    this.addressSelected.emit(addr);
  }

  visibleAddresses = computed(() => {
    const addresses = this.userData()?.addresses || [];
    const indexed = addresses.map((addr, index) => ({ addr, index }));
    return this.showAll() ? indexed : indexed.slice(0, 2);
  });

  toggleShowAll() {
    this.showAll.update((v) => !v);
  }

  openPopup() {
    const u = this.userData();

    this.newAddress.set({
      ...emptyAddress(),
      fullName: `${u?.firstName || ''} ${u?.lastName || ''}`.trim(),
      email: u?.email || '',
      phone: u?.phoneNumber?.[0] || '',
    });

    this.editingIndex.set(null);
    this.showAddressPopup.set(true);
  }

  /** `clean` arrives already validated and trimmed by AddressForm. */
  saveAddress(clean: AddressUser) {
    const u = this.userData();
    if (!u?.uid) return;

    // The server assigns the id and the ordering, so edits target an id rather than an
    // array index and the response replaces the local list.
    const idx = this.editingIndex();
    const editingId = idx !== null ? this.userData()?.addresses?.[idx]?.id : undefined;

    const request = editingId
      ? this.userService.updateAddress(u.uid, editingId, clean)
      : this.userService.addAddress(u.uid, clean);

    request.subscribe({
      next: (addresses) => {
        this.userData.set({ ...u, addresses });

        this.editingIndex.set(null);
        this.showAddressPopup.set(false);

        // Newly added addresses come back first (the API sorts newest-first).
        const newIndex = editingId ? idx! : 0;
        if (addresses[newIndex]) this.selectAddress(addresses[newIndex], newIndex);

        this.snackbar.success(editingId ? 'Address updated' : 'Address added');
      },

      error: (err: Error) => {
        this.snackbar.error(err.message || 'Failed to save address');
      },
    });
  }
}
