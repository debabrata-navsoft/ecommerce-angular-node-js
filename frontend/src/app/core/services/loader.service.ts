import { computed, Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoaderService {
  /**
   * A counter, not a boolean. Two overlapping `show()` calls used to be cancelled by the
   * first `hide()`, dropping the spinner while the second request was still running.
   */
  private pending = signal(0);

  /** In-flight HTTP requests, counted by `loadingInterceptor`. */
  private requests = signal(0);

  /**
   * The page-level blocking spinner. Templates render
   * `@if (isLoading()) { <app-loader /> } @else { content }`, so this stays under the
   * component's control — driving it from HTTP would blank the page on every background
   * mutation.
   */
  isLoading = computed(() => this.pending() > 0);

  /**
   * True while any API request is in flight, anywhere. Drives the global progress bar,
   * which overlays rather than replacing content, so it is safe on every page for every
   * call.
   */
  isBusy = computed(() => this.requests() > 0);

  show() {
    this.pending.update((n) => n + 1);
  }

  hide() {
    this.pending.update((n) => Math.max(0, n - 1));
  }

  requestStarted() {
    this.requests.update((n) => n + 1);
  }

  requestFinished() {
    this.requests.update((n) => Math.max(0, n - 1));
  }
}
