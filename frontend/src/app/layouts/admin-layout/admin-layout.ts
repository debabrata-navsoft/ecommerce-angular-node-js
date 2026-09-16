import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AdminSidebar } from '../../admin/components/admin-sidebar/admin-sidebar';
import { AdminHeader } from '../../admin/components/admin-header/admin-header';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, AdminSidebar, AdminHeader],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {
  /** Desktop: the sidebar shrinks to an icon rail. */
  readonly collapsed = signal(false);

  /** Below 1024px the sidebar becomes an overlay drawer instead. */
  readonly drawerOpen = signal(false);

  toggleCollapse() {
    this.collapsed.update((value) => !value);
  }

  toggleDrawer() {
    this.drawerOpen.update((value) => !value);
  }

  closeDrawer() {
    this.drawerOpen.set(false);
  }
}
