import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { finalize } from 'rxjs';

import { LoaderService } from './services/loader.service';

/**
 * Drives `LoaderService.isBusy` from HTTP activity, so every page shows a loading
 * indicator for every API call without each component wiring one up.
 *
 * Browser-only. During SSR the counter would be incremented on the server, where Angular
 * only serializes once those requests settle — so it could never be observed, while an
 * unbalanced count would leak into the hydrated state.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return next(req);

  const loader = inject(LoaderService);
  loader.requestStarted();

  // `finalize` covers success, error and unsubscribe (a cancelled navigation), so the
  // counter can never be left stuck above zero.
  return next(req).pipe(finalize(() => loader.requestFinished()));
};
