import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { AddressUser } from '../../models/user.model';
import { AddressField, validateAddress } from '../../../core/form-errors';

export function emptyAddress(): AddressUser {
  return {
    fullName: '',
    email: '',
    phone: '',
    address: '',
    landmark: '',
    city: '',
    state: '',
    pinCode: '',
  };
}

@Component({
  selector: 'app-address-form',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: './address-form.html',
  styleUrl: './address-form.css',
})
export class AddressForm {
  open = input<boolean>(false);
  value = input<AddressUser>(emptyAddress());
  editing = input<boolean>(false);
  saving = input<boolean>(false);
  save = output<AddressUser>();
  closed = output<void>();
  draft = signal<AddressUser>(emptyAddress());
  touched = signal<Partial<Record<AddressField, boolean>>>({});
  submitted = signal(false);

  errors = computed(() => validateAddress(this.draft()));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.draft.set({ ...emptyAddress(), ...untracked(() => this.value()) });
      this.touched.set({});
      this.submitted.set(false);
    });
  }

  updateField(field: keyof AddressUser, value: string) {
    this.draft.update((a) => ({ ...a, [field]: value }));
  }

  markTouched(field: AddressField) {
    this.touched.update((t) => ({ ...t, [field]: true }));
  }

  showError(field: AddressField): boolean {
    return Boolean(this.errors()[field]) && (this.submitted() || Boolean(this.touched()[field]));
  }

  errorFor(field: AddressField): string {
    return this.showError(field) ? (this.errors()[field] ?? '') : '';
  }

  submit() {
    if (this.saving()) return;

    this.submitted.set(true);

    const invalid = Object.keys(this.errors()) as AddressField[];
    if (invalid.length > 0) {
      document.getElementById(`af-${invalid[0]}`)?.focus();
      return;
    }

    const a = this.draft();
    this.save.emit({
      ...a,
      fullName: a.fullName.trim(),
      email: a.email.trim(),
      phone: String(a.phone ?? '').trim(),
      address: a.address.trim(),
      landmark: a.landmark?.trim() || '',
      city: a.city.trim(),
      state: a.state.trim(),
      pinCode: String(a.pinCode ?? '').trim(),
    });
  }

  close() {
    this.closed.emit();
  }
}
