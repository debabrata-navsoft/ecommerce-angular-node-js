import { Routes } from '@angular/router';

import { AdminLayout } from '../layouts/admin-layout/admin-layout';
import { Dashboard } from './dashboard/dashboard';
import { adminAuthGuard } from '../core/guards/admin-auth-guard';
import { AdminLoginPage } from './auth/admin-login-page/admin-login-page';

import { UserList } from './users/user-list/user-list';
import { OrderList } from './orders/order-list/order-list';
import { ProductListTable } from './products/product-list-table/product-list-table';

/**
 * `data.title` / `data.subtitle` drive the admin header — `AdminHeader` reads the deepest
 * activated route on every navigation, so pages never render their own top bar.
 */
export const adminRoutes: Routes = [
  {
    path: 'login',
    component: AdminLoginPage,
    canActivate: [adminAuthGuard],
  },

  {
    path: '',
    component: AdminLayout,
    canActivate: [adminAuthGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        component: Dashboard,
        data: { title: 'Dashboard', subtitle: 'Store performance at a glance' },
      },

      {
        path: 'users',
        children: [
          {
            path: '',
            component: UserList,
            data: { title: 'Customers', subtitle: 'Everyone with an account' },
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./users/user-detail/user-detail').then((m) => m.UserDetail),
            data: { title: 'Customer', subtitle: 'Profile, addresses and orders' },
          },
        ],
      },

      {
        path: 'products',
        children: [
          {
            path: '',
            component: ProductListTable,
            data: { title: 'Products', subtitle: 'Catalogue, pricing and stock' },
          },
          {
            path: 'add-product',
            loadComponent: () =>
              import('./products/add-product/add-product').then((m) => m.AddProduct),
            data: { title: 'Add product', subtitle: 'Create a new listing' },
          },

          {
            path: 'edit/:id',
            loadComponent: () =>
              import('./products/add-product/add-product').then((m) => m.AddProduct),
            data: { title: 'Edit product', subtitle: 'Update an existing listing' },
          },
        ],
      },

      {
        path: 'orders',
        children: [
          {
            path: '',
            component: OrderList,
            data: { title: 'Orders', subtitle: 'Every order placed in the store' },
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./orders/order-details/order-details').then((m) => m.OrderDetails),
            data: { title: 'Order details', subtitle: 'Items, payment and fulfilment' },
          },
        ],
      },
    ],
  },
];
