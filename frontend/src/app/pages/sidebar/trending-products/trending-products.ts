import { Component, DestroyRef, inject, input, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { TruncatePipe } from '../../../shared/pipes/truncate.pipe';
import { CategoryLabelPipe } from '../../../shared/pipes/category-label.pipe';
import { Highlight } from '../../../shared/directives/highlight';
import { ProductService } from '../../../core/services/product.service';
import { Product } from '../../../shared/models/product.model';
import { AuthService } from '../../../core/services/auth-user.service';
import { WishlistService } from '../../../core/services/wishlist.service';
import { Rating } from '../../../shared/utils/rating.util';
import { SnackbarService } from '../../../core/services/snackbar.service';
import { LoaderService } from '../../../core/services/loader.service';
import { Loader } from '../../../shared/components/loader/loader';

@Component({
  selector: 'app-trending-products',
  standalone: true,
  imports: [CommonModule, MatIconModule, TruncatePipe, CategoryLabelPipe, Highlight, Loader],
  templateUrl: './trending-products.html',
  styleUrl: './trending-products.css',
})
export class TrendingProducts implements OnInit {
  private productService = inject(ProductService);
  private authService = inject(AuthService);
  private wishlistService = inject(WishlistService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private snackBar = inject(SnackbarService);
  private loaderService = inject(LoaderService);

  isLoading = this.loaderService.isLoading;

  products = signal<Product[]>([]);
  showWishlistIcon = input(true);
  // @Input() showWishlistIcon = true;  // old version
  // showWishlistIcon = true;

  ngOnInit(): void {
    this.loaderService.show();

    const productSub = this.productService.getTrendingProducts().subscribe({
      next: (res) => {
        this.products.set(res.slice(0, 20));
        console.log();

        this.loaderService.hide();
      },

      error: (err) => {
        console.log(err);
        this.loaderService.hide();
      },
    });

    this.destroyRef.onDestroy(() => {
      productSub.unsubscribe();
    });
  }

  viewDetails(id: string) {
    this.router.navigate(['/products', id]);
  }

  isWishlisted(productId: string): boolean {
    return this.authService.isLoggedIn() && this.wishlistService.isInWishlist(productId);
  }

  addToWishlist(product: Product) {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    if (this.wishlistService.isInWishlist(product.id!)) {
      this.wishlistService.removeFromWishlist(product.id!);
      this.snackBar.error('Removed from wishlist');
    } else {
      this.wishlistService.addToWishlist(product);
      this.snackBar.success('Added to wishlist');
    }
  }

  getRating() {
    return Rating;
  }

  getDiscountPrice(item: Product): number {
    return this.productService.getDiscountPrice(item);
  }
}
