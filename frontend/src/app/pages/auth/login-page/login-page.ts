import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiFailure } from '../../../core/api.service';
import { applyServerErrors, clearServerErrors } from '../../../core/form-errors';
import { AuthService } from '../../../services/auth-user.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink, ReactiveFormsModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  private router = inject(Router);
  private authService = inject(AuthService);
  private snackBar = inject(SnackbarService);
  private platformId = inject(PLATFORM_ID);

  isLoading = signal(false);
  showPassword = signal(false);

  /** The API's own rejection text, shown above the button and cleared on the next try. */
  serverError = signal('');

  form = new FormGroup({
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.email, Validators.required],
    }),
    password: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
  });

  get email() {
    return this.form.controls.email;
  }

  get password() {
    return this.form.controls.password;
  }

  togglePassword() {
    this.showPassword.update((show) => !show);
  }

  onSubmit() {
    this.serverError.set('');
    clearServerErrors(this.form);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.error('Please enter valid email and password');
      return;
    }

    const { email, password } = this.form.getRawValue();

    this.isLoading.set(true);

    this.authService.login(email, password).subscribe({
      next: () => {
        this.snackBar.success('Login successful');
        this.isLoading.set(false);

        if (isPlatformBrowser(this.platformId)) {
          const redirectUrl = localStorage.getItem('redirectUrl');

          if (redirectUrl) {
            localStorage.removeItem('redirectUrl');
            this.router.navigate([redirectUrl]);
          } else {
            this.router.navigate(['/']);
          }
        }
      },

      error: (err: ApiFailure) => {
        console.error(err);

        this.serverError.set(applyServerErrors(this.form, err));
        this.snackBar.error(err.message || 'Login failed. Please try again.');
        this.isLoading.set(false);
      },
    });
  }
}
