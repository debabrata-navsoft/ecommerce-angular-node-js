import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';

import { ApiFailure } from '../../../core/services/api.service';
import { applyServerErrors, clearServerErrors } from '../../../core/form-errors';
import { AuthService } from '../../../core/services/auth-user.service';
import { SnackbarService } from '../../../core/services/snackbar.service';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.css',
})
export class ForgotPasswordPage {
  private authService = inject(AuthService);
  private snackBar = inject(SnackbarService);

  isLoading = signal(false);

  /** Swaps the form for the confirmation panel once a request has gone through. */
  isSent = signal(false);
  sentTo = signal('');

  /** API failures that belong to no single field; per-field ones print under the input. */
  serverError = signal('');

  form = new FormGroup({
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  get email() {
    return this.form.controls.email;
  }

  onSubmit() {
    // Before the validity check: a leftover server error from the last attempt would
    // otherwise keep the form invalid and fail it as a client-side error.
    this.serverError.set('');
    clearServerErrors(this.form);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.error('Please enter a valid email');
      return;
    }

    const email = this.email.value.trim();
    this.isLoading.set(true);

    this.authService.forgotPassword(email).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.sentTo.set(email);
        this.isSent.set(true);
      },

      // 404 "This email is not registered" lands on the email field; anything else (SMTP
      // or network trouble) goes to the banner.
      error: (err: ApiFailure) => {
        console.error(err);

        this.serverError.set(applyServerErrors(this.form, err));
        this.snackBar.error(err.message || 'Could not send the reset link');
        this.isLoading.set(false);
      },
    });
  }

  /** "Use a different email" — back to the form with the field cleared. */
  startOver() {
    this.form.reset();
    this.isSent.set(false);
  }
}
