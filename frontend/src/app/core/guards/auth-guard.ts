import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { map, of, take } from 'rxjs';

import { SessionService } from '../services/session.service';
import { SnackbarService } from '../services/snackbar.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);
  const session = inject(SessionService);
  const snackBar = inject(SnackbarService);

  if (!isPlatformBrowser(platformId)) return of(true);

  const url = state.url;
  const isAuthPage =
    url.startsWith('/login') || url.startsWith('/signup') || url.startsWith('/forgot-password');

  return session.user$.pipe(
    take(1),
    map((user) => {
      if (!user) {
        if (isAuthPage) return true;
        snackBar.error('Please login first');
        localStorage.setItem('redirectUrl', url);
        return router.createUrlTree(['/login']);
      }

      const sessionRole = localStorage.getItem('session_role');

      if (user.role === 'admin' || sessionRole === 'admin') {
        snackBar.error('Please login with a customer account.');
        return router.createUrlTree(['/login']);
      }

      if (isAuthPage) {
        snackBar.error('You are already logged in');
        return router.createUrlTree(['/']);
      }

      return true;
    }),
  );
};
