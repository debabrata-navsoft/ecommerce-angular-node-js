import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID, REQUEST } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, Observable, shareReplay, throwError } from 'rxjs';

import { environment } from '../../environments/environment';

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export type ApiFailure = Error & { status?: number; details?: unknown };

export function fireAndShare<T>(request: Observable<T>): Observable<T> {
  const shared = request.pipe(shareReplay({ bufferSize: 1, refCount: false }));

  shared.subscribe({ error: () => undefined });

  return shared;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  private serverRequest = inject(REQUEST, { optional: true });

  readonly isBrowser = isPlatformBrowser(this.platformId);

  private get baseUrl(): string {
    const base = environment.apiUrl;
    if (this.isBrowser || /^https?:\/\//i.test(base)) return base;

    const origin = this.serverRequest ? new URL(this.serverRequest.url).origin : '';
    return `${origin}${base}`;
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private get options() {
    const cookie = this.isBrowser ? null : this.serverRequest?.headers.get('cookie');

    return {
      withCredentials: true,
      ...(cookie ? { headers: { cookie } } : {}),
    };
  }

  private toParams(params?: QueryParams): HttpParams | undefined {
    if (!params) return undefined;

    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      httpParams = httpParams.set(key, String(value));
    }
    return httpParams;
  }

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http
      .get<T>(this.url(path), { ...this.options, params: this.toParams(params) })
      .pipe(catchError(handleError));
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .post<T>(this.url(path), body ?? {}, this.options)
      .pipe(catchError(handleError));
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .patch<T>(this.url(path), body ?? {}, this.options)
      .pipe(catchError(handleError));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path), this.options).pipe(catchError(handleError));
  }
}

function handleError(err: HttpErrorResponse) {
  const details = err.error?.['details'];
  const message =
    err.error?.['message'] ??
    (err.status === 0 ? 'Cannot reach the server. Is the API running?' : err.message);

  const error = new Error(message) as ApiFailure;
  error.status = err.status;
  if (details) error.details = details;

  return throwError(() => error);
}
