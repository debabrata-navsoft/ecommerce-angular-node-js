import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';

import { UserService } from '../../../core/services/user.service';
import { SnackbarService } from '../../../core/services/snackbar.service';
import { User } from '../../../shared/models/user.model';
import { DataTable, TableCellDef, TableColumn } from '../../../shared/components/data-table/data-table';

type RoleFilter = 'all' | 'user' | 'admin';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [RouterLink, MatIcon, DataTable, TableCellDef],
  templateUrl: './user-list.html',
  styleUrl: './user-list.css',
})
export class UserList implements OnInit {
  private userService = inject(UserService);
  private snackbar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);

  /** Local rather than the global loader, so the table can render its own skeleton. */
  readonly loading = signal(true);
  readonly users = signal<User[]>([]);
  readonly roleFilter = signal<RoleFilter>('all');

  readonly columns: TableColumn<User>[] = [
    {
      key: 'index',
      header: '#',
      type: 'index',
      width: '62px',
      searchable: false,
      sortable: true,
      value: (user) => (user.createdAt ? new Date(user.createdAt).getTime() : 0),
    },
    {
      key: 'customer',
      header: 'Customer',
      type: 'custom',
      sortable: true,
      value: (user) => `${user.firstName ?? ''} ${user.lastName ?? ''} ${user.email ?? ''}`.trim(),
    },
    {
      key: 'phoneNumber',
      header: 'Phone',
      type: 'custom',
      hideBelow: 'md',
      value: (user) => user.phoneNumber?.[0] ?? '',
    },
    { key: 'role', header: 'Role', type: 'custom', width: '130px' },
    {
      key: 'createdAt',
      header: 'Joined',
      type: 'date',
      format: 'dd MMM y',
      width: '140px',
      hideBelow: 'sm',
      sortable: true,
    },
    {
      key: 'actions',
      header: '',
      type: 'custom',
      width: '96px',
      align: 'right',
      searchable: false,
    },
  ];

  readonly visibleUsers = computed(() => {
    const role = this.roleFilter();
    if (role === 'all') return this.users();
    return this.users().filter((user) => (user.role ?? 'user') === role);
  });

  readonly adminCount = computed(() => this.users().filter((u) => u.role === 'admin').length);

  ngOnInit() {
    const sub = this.userService.getUsers().subscribe({
      next: (res) => {
        this.users.set(res ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Users load error:', err);
        this.users.set([]);
        this.loading.set(false);
      },
    });

    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  setRoleFilter(value: string) {
    this.roleFilter.set(value as RoleFilter);
  }

  fullName(user: User): string {
    const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return name || 'Unnamed customer';
  }

  initials(user: User): string {
    const source = this.fullName(user) === 'Unnamed customer' ? user.email : this.fullName(user);
    return (source ?? '?')
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  deleteUser(user: User) {
    if (!user.uid) return;
    if (!confirm(`Delete ${this.fullName(user)}? This cannot be undone.`)) return;

    this.userService.deleteUser(user.uid).subscribe({
      next: () => {
        this.users.update((users) => users.filter((u) => u.uid !== user.uid));
        this.snackbar.success('Customer deleted');
      },
      error: (err) => {
        console.error('Delete failed', err);
        this.snackbar.error('Could not delete this customer');
      },
    });
  }
}
