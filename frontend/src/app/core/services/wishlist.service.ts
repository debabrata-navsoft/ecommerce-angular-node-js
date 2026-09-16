import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { map, Observable, of, tap } from 'rxjs';

import { ApiService, fireAndShare } from './api.service';
import { SessionService } from './session.service';
import { Product } from '../../shared/models/product.model';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private destroyRef = inject(DestroyRef);

  private wishlist = signal<Product[]>([]);

  itemCount = computed(() => this.wishlist().length);
  getWishlistSignal = this.wishlist.asReadonly();

  constructor() {
    const sub = this.session.user$.subscribe((user) => {
      if (user) {
        this.loadWishlist();
      } else {
        this.wishlist.set([]);
      }
    });

    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  loadWishlist(): void {
    this.api.get<{ items: Product[] }>('/wishlist').subscribe({
      next: (res) => this.wishlist.set(res.items),
      error: () => undefined,
    });
  }

  addToWishlist(product: Product): Observable<void> {
    if (!this.session.uid) return of(void 0);
    if (this.isInWishlist(product.id)) return of(void 0);

    const rollback = this.wishlist();
    this.wishlist.set([{ ...product, createdAt: Date.now() }, ...rollback]);

    return fireAndShare(
      this.api.post<{ items: Product[] }>('/wishlist', { productId: product.id }).pipe(
        tap({
          next: (res) => this.wishlist.set(res.items),
          error: () => this.wishlist.set(rollback),
        }),
        map(() => void 0),
      ),
    );
  }

  removeFromWishlist(id: string): void {
    if (!this.session.uid) return;

    const rollback = this.wishlist();
    this.wishlist.set(rollback.filter((p) => p.id !== id));

    this.api.delete<{ items: Product[] }>(`/wishlist/${id}`).subscribe({
      next: (res) => this.wishlist.set(res.items),
      error: (err) => {
        console.error('Delete failed:', err);
        this.wishlist.set(rollback);
      },
    });
  }

  isInWishlist(id: string | undefined): boolean {
    if (!id) return false;
    return this.wishlist().some((p) => p.id === id);
  }
}
