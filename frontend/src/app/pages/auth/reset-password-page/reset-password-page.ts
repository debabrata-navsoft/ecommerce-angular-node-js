import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiFailure } from '../../../core/services/api.service';
import { applyServerErrors, clearServerErrors } from '../../../core/form-errors';
import { AuthService } from '../../../core/services/auth-user.service';
import { SnackbarService } from '../../../core/services/snackbar.service';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './reset-password-page.html',
  styleUrl: './reset-password-page.css',
})
export class ResetPasswordPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private snackBar = inject(SnackbarService);

  /** From the ?token= on the emailed link. Read once — this page is never re-used. */
  readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  isLoading = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  /** API failures that belong to no single field — chiefly a spent or expired token. */
  serverError = signal('');

  form = new FormGroup(
    {
      password: new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),

      confirmPassword: new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [passwordMatch] },
  );

  get password() {
    return this.form.controls.password;
  }

  get confirmPassword() {
    return this.form.controls.confirmPassword;
  }

  togglePassword() {
    this.showPassword.update((show) => !show);
  }

  toggleConfirmPassword() {
    this.showConfirmPassword.update((show) => !show);
  }

  onSubmit() {
    // Before the validity check: a leftover server error from the last attempt would
    // otherwise keep the form invalid and fail it as a client-side error.
    this.serverError.set('');
    clearServerErrors(this.form);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.error('Please enter a valid password');
      return;
    }

    this.isLoading.set(true);

    this.authService.resetPassword(this.token, this.password.value).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.snackBar.success('Password updated. Please login.');
        this.router.navigate(['/login']);
      },

      error: (err: ApiFailure) => {
        console.error(err);

        this.serverError.set(applyServerErrors(this.form, err));
        this.snackBar.error(err.message || 'Could not reset the password');
        this.isLoading.set(false);
      },
    });
  }
}

function passwordMatch(group: AbstractControl) {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;

  return password === confirm ? null : { passwordMismatch: true };
}
