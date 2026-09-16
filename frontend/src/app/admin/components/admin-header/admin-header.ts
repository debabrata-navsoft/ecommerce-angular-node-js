import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { MatIcon } from '@angular/material/icon';

import { AdminAuthService } from '../../../core/services/auth-admin.service';
import { SnackbarService } from '../../../core/services/snackbar.service';
import { User } from '../../../shared/models/user.model';

@Component({
  selector: 'app-admin-header',
  standalone: true,
  imports: [RouterLink, MatIcon],
  templateUrl: './admin-header.html',
  styleUrl: './admin-header.css',
  host: {
    // Any click outside the avatar button closes the menu; the trigger stops propagation.
    '(document:click)': 'closeMenu()',
  },
})
export class AdminHeader implements OnInit {
  private adminAuthService = inject(AdminAuthService);
  private snackbar = inject(SnackbarService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  readonly collapsed = input(false);

  readonly toggleDrawer = output<void>();
  readonly toggleCollapse = output<void>();

  readonly admin = signal<User | null>(null);
  readonly pageTitle = signal('Dashboard');
  readonly pageSubtitle = signal('');
  readonly menuOpen = signal(false);

  readonly adminName = computed(
    () => this.admin()?.displayName?.trim() || this.admin()?.email || 'Admin',
  );

  readonly initials = computed(() => {
    const source = this.admin()?.displayName?.trim() || this.admin()?.email || 'A';
    return source
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  });

  ngOnInit() {
    const adminSub = this.adminAuthService.currentUser$.subscribe((user) => this.admin.set(user));

    const routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.readRouteData());

    this.readRouteData();

    this.destroyRef.onDestroy(() => {
      adminSub.unsubscribe();
      routerSub.unsubscribe();
    });
  }

  /** Header copy comes from the deepest route's `data`, so pages stay free of chrome. */
  private readRouteData() {
    let route = this.route.root;
    while (route.firstChild) route = route.firstChild;

    const data = route.snapshot.data;
    this.pageTitle.set((data['title'] as string) ?? 'Dashboard');
    this.pageSubtitle.set((data['subtitle'] as string) ?? '');
  }

  onMenuTrigger(event: MouseEvent) {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  closeMenu() {
    if (this.menuOpen()) this.menuOpen.set(false);
  }

  logout() {
    this.closeMenu();
    this.adminAuthService.logout();
    this.snackbar.success('Admin logout successfully!');
  }
}
