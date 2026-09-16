import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe, SlicePipe, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';

import { mergeOrderEvent, OrderService } from '../../../core/services/order.service';
import { SnackbarService } from '../../../core/services/snackbar.service';
import { Order } from '../../../shared/models/order.model';
import { DataTable, TableCellDef, TableColumn } from '../../../shared/components/data-table/data-table';

type StatusFilter = 'all' | Order['status'];

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [RouterLink, MatIcon, DecimalPipe, SlicePipe, TitleCasePipe, DataTable, TableCellDef],
  templateUrl: './order-list.html',
  styleUrl: './order-list.css',
})
export class OrderList implements OnInit {
  private orderService = inject(OrderService);
  private snackbar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly orders = signal<Order[]>([]);
  readonly statusFilter = signal<StatusFilter>('all');

  readonly statuses: Order['status'][] = ['pending', 'shipped', 'delivered', 'cancelled'];

  readonly columns: TableColumn<Order>[] = [
    {
      key: 'index',
      header: '#',
      type: 'index',
      width: '62px',
      searchable: false,
      sortable: true,
      value: (order) => order.createdAt ?? 0,
    },
    { key: 'orderId', header: 'Order', type: 'custom', sortable: true },
    { key: 'userEmail', header: 'Customer', type: 'text', sortable: true },
    { key: 'total', header: 'Amount', type: 'currency', width: '120px', sortable: true },
    { key: 'paymentStatus', header: 'Payment', type: 'custom', width: '150px', hideBelow: 'md' },
    {
      key: 'createdAt',
      header: 'Placed',
      type: 'date',
      format: 'dd MMM y, h:mm a',
      width: '170px',
      hideBelow: 'sm',
      sortable: true,
    },
    { key: 'status', header: 'Fulfilment', type: 'custom', width: '170px' },
    { key: 'actions', header: '', type: 'custom', width: '64px', align: 'right', searchable: false },
  ];

  readonly visibleOrders = computed(() => {
    const status = this.statusFilter();
    if (status === 'all') return this.orders();
    return this.orders().filter((order) => order.status === status);
  });

  readonly pendingCount = computed(() => this.orders().filter((o) => o.status === 'pending').length);

  readonly revenue = computed(() =>
    this.orders()
      .filter((order) => order.status !== 'cancelled')
      .reduce((sum, order) => sum + (order.total ?? 0), 0),
  );

  ngOnInit() {
    const orderSub = this.orderService.getAllOrders().subscribe({
      next: (res) => {
        this.orders.set(res ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Orders load error:', err);
        this.orders.set([]);
        this.loading.set(false);
      },
    });

    // Admin status changes and customer cancellations land here without a refresh.
    const streamSub = this.orderService.streamOrders().subscribe({
      next: (event) => this.orders.update((list) => mergeOrderEvent(list, event)),
      error: (err) => console.error('Order stream error:', err),
    });

    this.destroyRef.onDestroy(() => {
      orderSub.unsubscribe();
      streamSub.unsubscribe();
    });
  }

  setStatusFilter(value: string) {
    this.statusFilter.set(value as StatusFilter);
  }

  changeStatus(order: Order, event: Event) {
    const select = event.target as HTMLSelectElement;
    const status = select.value as Order['status'];
    const previous = order.status;

    this.patchStatus(order.orderId, status);

    this.orderService.updateOrderStatus(order.orderId!, status).subscribe({
      next: () => this.snackbar.success(`Order marked ${status}`),
      error: (err) => {
        console.error('Status update failed', err);
        this.patchStatus(order.orderId, previous);
        select.value = previous;
        this.snackbar.error('Could not update the order status');
      },
    });
  }

  private patchStatus(orderId: string | undefined, status: Order['status']) {
    this.orders.update((list) =>
      list.map((item) => (item.orderId === orderId ? { ...item, status } : item)),
    );
  }

  paymentTone(order: Order): string {
    switch (order.paymentStatus) {
      case 'paid':
      case 'confirmed':
        return 'adm-badge--success';
      case 'failed':
        return 'adm-badge--danger';
      default:
        return 'adm-badge--warn';
    }
  }

  statusTone(status: Order['status']): string {
    switch (status) {
      case 'delivered':
        return 'status--delivered';
      case 'shipped':
        return 'status--shipped';
      case 'cancelled':
        return 'status--cancelled';
      default:
        return 'status--pending';
    }
  }
}
