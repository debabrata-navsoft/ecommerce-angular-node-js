import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiFailure } from '../../../core/api.service';
import { applyServerErrors, clearServerErrors } from '../../../core/form-errors';
import { AuthService } from '../../../services/auth-user.service';
import { User } from '../../../models/user.model';
import { SnackbarService } from '../../../services/snackbar.service';

@Component({
  selector: 'app-signup-page',
  standalone: true,
  imports: [FormsModule, RouterLink, ReactiveFormsModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './signup-page.html',
  styleUrl: './signup-page.css',
})
export class SignupPage {
  private router = inject(Router);
  private authService = inject(AuthService);
  private snackBar = inject(SnackbarService);

  isLoading = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  /** API failures that belong to no single field; per-field ones print under their input. */
  serverError = signal('');

  form = new FormGroup(
    {
      firstName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),

      lastName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),

      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
        // asyncValidators: [this.checkEmailAvailability()],
        // updateOn: 'blur',
      }),

      // 8, matching the API's own check — at 6 the form accepted passwords the server
      // then rejected with a validation error.
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),

      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),

      phoneNumber: new FormArray<FormControl<string>>([new FormControl('', { nonNullable: true })]),
    },
    {
      validators: [this.passwordMatch],
    },
  );

  passwordMatch(group: AbstractControl) {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;

    return password === confirm ? null : { passwordMismatch: true };
  }

  // checkEmailAvailability(): AsyncValidatorFn {
  //   return (control: AbstractControl) => {
  //     if (!control.value) return of(null);

  //     return from(this.authService.checkEmail(control.value)).pipe(
  //       map((exists) => (exists ? { emailTaken: true } : null)),
  //     );
  //   };
  // }

  get phoneNumber() {
    return this.form.get('phoneNumber') as FormArray;
  }

  addPhone() {
    this.phoneNumber.push(new FormControl('', { nonNullable: true }));
  }

  removePhone(index: number) {
    this.phoneNumber.removeAt(index);
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
      this.snackBar.error('Please fill all fields correctly');
      return;
    }

    const value = this.form.getRawValue();

    const user: User = {
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      email: value.email.trim(),
      phoneNumber: value.phoneNumber.map((p: string) => p.trim()),
    };

    this.isLoading.set(true);

    this.authService.signupUser(user, value.password).subscribe({
      next: () => {
        this.snackBar.success('Signup successful');
        this.form.reset();
        this.isLoading.set(false);
        this.router.navigate(['/']);
      },

      /**
       * The API tags what it rejected — a duplicate email, a password under 8 characters,
       * a missing name — so each message lands under its own field. The check this
       * replaced looked for a Firebase code the API never sends, so a duplicate email
       * showed the generic "Signup failed".
       */
      error: (err: ApiFailure) => {
        console.error(err);

        this.serverError.set(applyServerErrors(this.form, err));
        this.snackBar.error(err.message || 'Signup failed');
        this.isLoading.set(false);
      },
    });
  }

  get firstName() {
    return this.form.controls.firstName;
  }

  get lastName() {
    return this.form.controls.lastName;
  }

  get email() {
    return this.form.controls.email;
  }

  get password() {
    return this.form.controls.password;
  }

  get confirmPassword() {
    return this.form.controls.confirmPassword;
  }
}
