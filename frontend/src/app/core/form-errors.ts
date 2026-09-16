import { FormGroup } from '@angular/forms';

import { ApiFailure } from './services/api.service';
import { AddressUser } from '../shared/models/user.model';

/** Every address field that is validated. `landmark` is optional, so it is absent here. */
export type AddressField =
  | 'fullName'
  | 'email'
  | 'phone'
  | 'address'
  | 'city'
  | 'state'
  | 'pinCode';

/**
 * Mirrors `addressRules` in the API's routes/validators.js, so the form rejects exactly
 * what the server would reject instead of surfacing it as a 400. Shared by the checkout
 * address form and the Address Book, which are otherwise separate components.
 */
export function validateAddress(a: AddressUser): Partial<Record<AddressField, string>> {
  const errors: Partial<Record<AddressField, string>> = {};
  const val = (v: string | number | undefined | null) => String(v ?? '').trim();

  if (!val(a.fullName)) errors.fullName = 'Full name is required';

  if (!val(a.email)) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val(a.email)))
    errors.email = 'Enter a valid email address';

  if (!val(a.phone)) errors.phone = 'Phone number is required';
  else if (!/^[0-9+\-\s()]{7,20}$/.test(val(a.phone))) errors.phone = 'Enter a valid phone number';

  if (!val(a.address)) errors.address = 'Address is required';
  if (!val(a.city)) errors.city = 'City is required';
  if (!val(a.state)) errors.state = 'State is required';

  if (!val(a.pinCode)) errors.pinCode = 'PIN code is required';
  else if (!/^[0-9]{4,10}$/.test(val(a.pinCode))) errors.pinCode = 'Enter a valid PIN code';

  return errors;
}

interface FieldIssue {
  field: string;
  message: string;
}

const isFieldIssue = (value: unknown): value is FieldIssue =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as FieldIssue).field === 'string' &&
  typeof (value as FieldIssue).message === 'string';

export function applyServerErrors(form: FormGroup, err: ApiFailure): string {
  const details = Array.isArray(err.details) ? err.details.filter(isFieldIssue) : [];

  const unmatched = details.filter((issue) => {
    const control = form.get(issue.field);
    if (!control) return true;

    control.setErrors({ ...(control.errors ?? {}), server: issue.message });
    control.markAsTouched();
    return false;
  });

  if (details.length === 0 || unmatched.length > 0) {
    return unmatched.map((issue) => issue.message).join(' ') || err.message;
  }

  return '';
}

export function clearServerErrors(form: FormGroup): void {
  for (const control of Object.values(form.controls)) {
    if (!control.errors?.['server']) continue;

    const { server, ...rest } = control.errors;
    control.setErrors(Object.keys(rest).length ? rest : null);
  }
}
