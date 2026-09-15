import { FormGroup } from '@angular/forms';

import { ApiFailure } from './api.service';

/** One entry of the API's `details` array. */
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
