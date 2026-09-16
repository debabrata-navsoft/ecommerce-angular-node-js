import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AdminAuthService } from '../../../core/services/auth-admin.service';
import { SnackbarService } from '../../../core/services/snackbar.service';
import { ApiFailure } from '../../../core/services/api.service';
import { applyServerErrors, clearServerErrors } from '../../../core/form-errors';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './admin-login-page.html',
  styleUrl: './admin-login-page.css',
})
export class AdminLoginPage implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private adminAuthService = inject(AdminAuthService);
  private snackBar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);

  isLoading = signal(false);
  showPassword = signal(false);

  /** Failures belonging to no single field — a non-admin account, or the API being down. */
  serverError = signal('');

  loginForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  get email() {
    return this.loginForm.controls.email;
  }

  get password() {
    return this.loginForm.controls.password;
  }

  togglePassword() {
    this.showPassword.update((v) => !v);
  }

  ngOnInit() {
    const sub = this.adminAuthService.isAdmin$.subscribe((isAdmin) => {
      if (isAdmin) {
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/admin/dashboard';
        this.router.navigateByUrl(returnUrl);
        // this.router.navigate(['/admin']);
      }
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
    });
  }

  onSubmit() {
    this.serverError.set('');
    clearServerErrors(this.loginForm);

    // Previously this returned silently, so a malformed email looked like a dead button.
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.snackBar.error('Please enter a valid email and password');
      return;
    }

    const { email, password } = this.loginForm.getRawValue();

    this.isLoading.set(true);

    this.adminAuthService.loginAdmin(email, password).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.snackBar.success('Admin login successfully!');

        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/admin/dashboard';
        this.router.navigateByUrl(returnUrl);
      },

      error: (err: ApiFailure) => {
        // The API already says exactly what went wrong ("This email is not registered",
        // "Incorrect password") and tags the offending field in `details`. This used to
        // discard all of it and show a blanket "Login failed".
        this.serverError.set(applyServerErrors(this.loginForm, err));
        this.snackBar.error(err.message || 'Login failed. Please try again.');
        this.isLoading.set(false);
      },
    });
  }
}
///////////////////////////////////////////////////////////////////////////////////////////

// import { Component, inject } from '@angular/core';
// import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
// import { Router } from '@angular/router';
// import { MatSnackBar } from '@angular/material/snack-bar';
// import { AdminAuthService } from '../../../core/services/admin-auth-service';

// @Component({
//   selector: 'app-admin-login-page',
//   standalone: true,
//   imports: [ReactiveFormsModule],
//   templateUrl: './admin-login-page.html',
//   styleUrl: './admin-login-page.css',
// })
// export class AdminLoginPage {
//   private router = inject(Router);
//   private adminAuthService = inject(AdminAuthService);
//   private snackBar = inject(MatSnackBar);

//   loginForm = new FormGroup({
//     email: new FormControl('', [Validators.required, Validators.email]),
//     password: new FormControl('', [Validators.required]),
//   });

//   async onSubmit() {
//     if (this.loginForm.invalid) return;

//     const email = this.loginForm.value.email!;
//     const password = this.loginForm.value.password!;

//     try {
//       await this.adminAuthService.loginAdmin(email, password);

//       this.snackBar.open('Admin login successful!', 'Close', {
//         duration: 3000,
//         panelClass: ['snackbar-success'],
//       });

//       this.router.navigate(['/admin']);
//     } catch (err: any) {
//       let message = 'Login failed';

//       if (err.message === 'Not an admin user') {
//         message = 'Access denied: Not an admin';
//       }

//       this.snackBar.open(message, 'Close', {
//         duration: 3000,
//         panelClass: ['snackbar-error'],
//       });
//     }
//   }
// }
