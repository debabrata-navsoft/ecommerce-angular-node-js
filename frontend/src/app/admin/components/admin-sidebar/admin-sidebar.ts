import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIcon } from '@angular/material/icon';

export interface AdminNavItem {
  label: string;
  icon: string;
  route: string;
  /** Only highlight on an exact URL match — needed for list routes with child pages. */
  exact?: boolean;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIcon],
  templateUrl: './admin-sidebar.html',
  styleUrl: './admin-sidebar.css',
  host: {
    '[class.is-collapsed]': 'collapsed()',
  },
})
export class AdminSidebar {
  readonly collapsed = input(false);

  /** Lets the layout close the mobile drawer once a destination is picked. */
  readonly navigated = output<void>();

  readonly groups: AdminNavGroup[] = [
    {
      label: 'Overview',
      items: [{ label: 'Dashboard', icon: 'grid_view', route: '/admin/dashboard' }],
    },
    {
      label: 'Catalogue',
      items: [
        { label: 'Products', icon: 'inventory_2', route: '/admin/products', exact: true },
        { label: 'Add product', icon: 'add_box', route: '/admin/products/add-product' },
      ],
    },
    {
      label: 'Commerce',
      items: [{ label: 'Orders', icon: 'receipt_long', route: '/admin/orders' }],
    },
    {
      label: 'People',
      items: [{ label: 'Customers', icon: 'group', route: '/admin/users' }],
    },
  ];
}
