import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { map, of, take } from 'rxjs';

import { SessionService } from '../services/session.service';

export const adminAuthGuard: CanActivateFn = (_route, state) => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);
  const session = inject(SessionService);

  const isLoginPage = state.url.startsWith('/admin/login');

  if (!isPlatformBrowser(platformId)) return of(true);

  return session.user$.pipe(
    take(1),
    map((user) => {
      if (!user) {
        return isLoginPage ? true : router.createUrlTree(['/admin/login']);
      }

      const isAdmin = user.role === 'admin';
      const sessionRole = localStorage.getItem('session_role');

      if (!isAdmin || sessionRole === 'user') {
        return isLoginPage ? true : router.createUrlTree(['/admin/login']);
      }

      if (isLoginPage) {
        return router.createUrlTree(['/admin/dashboard']);
      }

      return true;
    }),
  );
};
