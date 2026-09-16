import { Component, DestroyRef, inject, input, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIcon } from '@angular/material/icon';

import { AuthService } from '../../../core/services/auth-user.service';
import { ProductService } from '../../../core/services/product.service';
import { Product } from '../../../shared/models/product.model';
import { Rating } from '../../../shared/utils/rating.util';
import { Error } from '../../../shared/components/error/error';
import { CartService } from '../../../core/services/cart.service';
import { WishlistService } from '../../../core/services/wishlist.service';
import { LoaderService } from '../../../core/services/loader.service';
import { SnackbarService } from '../../../core/services/snackbar.service';
import { CategoryLabelPipe } from '../../../shared/pipes/category-label.pipe';

const MAX_RELATED = 8;

@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  imports: [CommonModule, Error, MatIcon, CategoryLabelPipe],
  templateUrl: './product-detail-page.html',
  styleUrl: './product-detail-page.css',
})
export class ProductDetailPage implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private wishlistService = inject(WishlistService);
  private destroyRef = inject(DestroyRef);
  private loaderService = inject(LoaderService);
  private snackBar = inject(SnackbarService);

  showWishlistIcon = input(true);
  // @Input() showWishlistIcon = true; // old version

  product = signal<Product | null>(null);
  stars = signal<string[]>([]);
  errorMsg = signal(false);

  /** Same subcategory, current product excluded. Empty until the product resolves. */
  related = signal<Product[]>([]);

  ngOnInit(): void {
    const routeSub = this.route.paramMap.subscribe((params) => {
      const productId = params.get('id');

      if (!productId) return;

      this.loaderService.show();

      this.errorMsg.set(false);
      this.product.set(null);
      this.related.set([]);

      const productSub = this.productService.getProductById(productId).subscribe({
        next: (res) => {
          this.product.set(res as Product);
          this.stars.set(Rating.getStars(res?.rating || 0));
          // this.stars.set(Rating.getStars(this.product()?.rating || 0));
          this.loadRelated(res as Product);
          this.loaderService.hide();
        },

        error: (err) => {
          this.errorMsg.set(true);
          this.loaderService.hide();
          console.log(err);
        },
      });

      this.destroyRef.onDestroy(() => {
        productSub.unsubscribe();
      });
    });

    this.destroyRef.onDestroy(() => {
      routeSub.unsubscribe();
    });
  }

  /**
   * Reuses the catalogue filter, which matches `category` OR `subCategory` server-side, so
   * no dedicated endpoint is needed. Failures are swallowed — the strip is supplementary
   * and must never take the page down with it.
   */
  private loadRelated(product: Product) {
    const slug = product?.subCategory || product?.category;
    if (!slug) return;

    const sub = this.productService.getProductsByCategory(slug).subscribe({
      next: (items) =>
        this.related.set(items.filter((p) => p.id !== product.id).slice(0, MAX_RELATED)),
      error: () => this.related.set([]),
    });

    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  getDiscountPrice(item: Product): number {
    return this.productService.getDiscountPrice(item);
  }

  getRating() {
    return Rating;
  }

  viewProduct(id: string) {
    this.router.navigate(['/products', id]);
  }

  addToCart(product: Product) {
    if (!this.authService.isLoggedIn()) {
      this.snackBar.error('Please login to add cart');

      this.router.navigate(['/login']);
      return;
    }

    this.cartService.addToCart(product);
    this.router.navigate(['/cart']);
    this.snackBar.success('Added to cart');
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
      this.snackBar.success('Add to wishlist');
    }
  }

  buyNow(product: Product) {
    this.cartService.addToCart(product);
    this.router.navigate(['/cart/checkout']);
  }
}
