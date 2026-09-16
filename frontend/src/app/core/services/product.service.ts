import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiService, QueryParams } from './api.service';
import { Product } from '../../shared/models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private api = inject(ApiService);

  getDiscountPrice(product: Product): number {
    if (!product.discount) return product.price;
    return product.price - (product.price * product.discount) / 100;
  }

  private list(path: string, params?: QueryParams): Observable<Product[]> {
    return this.api.get<{ items: Product[] }>(path, params).pipe(map((res) => res.items));
  }

  getProducts(params?: QueryParams): Observable<Product[]> {
    return this.list('/products', params);
  }

  getProductById(id: string): Observable<Product | null> {
    return this.api.get<{ product: Product }>(`/products/${id}`).pipe(map((res) => res.product));
  }

  addProduct(product: Product): Observable<Product> {
    return this.api.post<{ product: Product }>('/products', product).pipe(map((r) => r.product));
  }

  updateProduct(id: string, data: Partial<Product>): Observable<void> {
    return this.api.patch<{ product: Product }>(`/products/${id}`, data).pipe(map(() => void 0));
  }

  deleteProduct(id: string): Observable<void> {
    return this.api.delete<void>(`/products/${id}`);
  }

  getProductsByCategory(category: string): Observable<Product[]> {
    return this.list('/products', { category: category.toLowerCase().trim(), sort: 'newest' });
  }

  getTrendingProducts(): Observable<Product[]> {
    return this.list('/products/feed/trending');
  }

  getBestSellers(): Observable<Product[]> {
    return this.list('/products/feed/best-sellers');
  }

  getTodayDeals(): Observable<Product[]> {
    return this.list('/products/feed/today-deals');
  }

  getDiscountProducts(): Observable<Product[]> {
    return this.list('/products/feed/discounted');
  }
}
