import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  Directive,
  TemplateRef,
  computed,
  contentChildren,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';

export type SortDirection = 'asc' | 'desc';

/**
 * How a cell renders when no `*appTableCell` template is supplied for the column.
 * `index` prints the running row number, `custom` means "a template will handle it".
 */
export type TableColumnType =
  | 'text'
  | 'index'
  | 'number'
  | 'currency'
  | 'date'
  | 'image'
  | 'custom';

export interface TableColumn<T = any> {
  /** Property on the row, or any unique id when `value` is supplied. */
  key: string;
  header: string;
  /** Derives the cell value. Sorting and search read through it too. */
  value?: (row: T) => unknown;
  type?: TableColumnType;
  /** `DatePipe` / `DecimalPipe` format string, depending on `type`. */
  format?: string;
  sortable?: boolean;
  /** Defaults to true — set false to keep the column out of the search. */
  searchable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  /** Drop the column on narrow screens. */
  hideBelow?: 'sm' | 'md' | 'lg';
  cellClass?: string;
}

export interface TableCellContext<T = any> {
  $implicit: T;
  row: T;
  index: number;
}

/**
 * Marks an `<ng-template>` as the renderer for one column:
 *
 * ```html
 * <ng-template appTableCell="status" let-order>…</ng-template>
 * ```
 */
@Directive({
  selector: 'ng-template[appTableCell]',
  standalone: true,
})
export class TableCellDef<T = any> {
  readonly key = input.required<string>({ alias: 'appTableCell' });
  readonly template = inject<TemplateRef<TableCellContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _dir: TableCellDef<T>,
    _ctx: unknown,
  ): _ctx is TableCellContext<T> {
    return true;
  }
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined || a === '') return 1;
  if (b === null || b === undefined || b === '') return -1;

  const aNum = a instanceof Date ? a.getTime() : typeof a === 'number' ? a : NaN;
  const bNum = b instanceof Date ? b.getTime() : typeof b === 'number' ? b : NaN;

  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * The one table every admin list uses: search, sorting, pagination, loading skeletons and
 * an empty state, with per-column `*appTableCell` templates for anything bespoke.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [NgTemplateOutlet, MatIcon],
  providers: [DatePipe, DecimalPipe],
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
})
export class DataTable<T> {
  private datePipe = inject(DatePipe);
  private decimalPipe = inject(DecimalPipe);

  readonly columns = input.required<TableColumn<T>[]>();
  readonly rows = input.required<T[]>();

  readonly loading = input(false);
  readonly title = input('');
  readonly subtitle = input('');
  readonly showToolbar = input(true);
  readonly showCount = input(true);

  readonly searchable = input(true);
  readonly searchPlaceholder = input('Search…');

  readonly paginated = input(true);
  readonly pageSize = input(10);
  readonly pageSizeOptions = input<number[]>([5, 10, 25, 50]);

  readonly sortKey = input<string | null>(null);
  readonly sortDirection = input<SortDirection>('desc');

  readonly emptyMessage = input('Nothing to show yet');
  readonly emptyIcon = input('inbox');

  readonly dense = input(false);
  readonly clickableRows = input(false);
  /** Overrides the default row identity (`id` / `uid` / `orderId`, else the index). */
  readonly trackBy = input<(row: T, index: number) => unknown>();

  readonly rowClick = output<T>();

  private cellDefs = contentChildren(TableCellDef);

  protected readonly search = signal('');
  protected readonly sort = linkedSignal<{ key: string | null; direction: SortDirection }>(() => ({
    key: this.sortKey(),
    direction: this.sortDirection(),
  }));
  protected readonly size = linkedSignal(() => this.pageSize());
  private readonly requestedPage = signal(0);

  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  private readonly cellTemplates = computed(() => {
    const map = new Map<string, TemplateRef<TableCellContext<T>>>();
    for (const def of this.cellDefs()) map.set(def.key(), def.template);
    return map;
  });

  protected readonly filteredRows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const rows = this.rows() ?? [];
    if (!term) return rows;

    const cols = this.columns().filter(
      (col) => col.searchable !== false && col.type !== 'index' && col.type !== 'image',
    );

    return rows.filter((row) =>
      cols.some((col) => {
        const value = this.cellValue(col, row);
        return value !== null && value !== undefined && String(value).toLowerCase().includes(term);
      }),
    );
  });

  protected readonly sortedRows = computed(() => {
    const { key, direction } = this.sort();
    const rows = this.filteredRows();
    if (!key) return rows;

    const col = this.columns().find((c) => c.key === key);
    if (!col) return rows;

    const factor = direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => factor * compare(this.cellValue(col, a), this.cellValue(col, b)));
  });

  protected readonly total = computed(() => this.filteredRows().length);

  protected readonly pageCount = computed(() =>
    this.paginated() ? Math.max(1, Math.ceil(this.total() / this.size())) : 1,
  );

  /** Clamped rather than assigned, so a shrinking list cannot strand the view on page 9. */
  protected readonly pageIndex = computed(() =>
    Math.min(this.requestedPage(), this.pageCount() - 1),
  );

  protected readonly pagedRows = computed(() => {
    if (!this.paginated()) return this.sortedRows();
    const start = this.pageIndex() * this.size();
    return this.sortedRows().slice(start, start + this.size());
  });

  protected readonly rangeStart = computed(() =>
    this.total() === 0 ? 0 : this.pageIndex() * this.size() + 1,
  );

  protected readonly rangeEnd = computed(() =>
    Math.min(this.total(), (this.pageIndex() + 1) * this.size()),
  );

  /** Page numbers to render; `-1` is an ellipsis. */
  protected readonly pages = computed(() => {
    const count = this.pageCount();
    const current = this.pageIndex();
    if (count <= 7) return Array.from({ length: count }, (_, i) => i);

    const pages = new Set<number>([0, count - 1, current]);
    if (current - 1 > 0) pages.add(current - 1);
    if (current + 1 < count - 1) pages.add(current + 1);

    const sorted = [...pages].sort((a, b) => a - b);
    const out: number[] = [];
    sorted.forEach((page, i) => {
      if (i > 0 && page - sorted[i - 1] > 1) out.push(-1);
      out.push(page);
    });
    return out;
  });

  protected cellValue(col: TableColumn<T>, row: T): unknown {
    if (col.value) return col.value(row);
    return (row as unknown as Record<string, unknown>)[col.key];
  }

  /** Text for every built-in column type; `index`, `image` and custom cells bypass it. */
  protected display(col: TableColumn<T>, row: T): string {
    const value = this.cellValue(col, row);
    if (value === null || value === undefined || value === '') return '—';

    switch (col.type) {
      case 'date': {
        const date = value instanceof Date ? value : new Date(value as string | number);
        if (Number.isNaN(date.getTime())) return '—';
        return this.datePipe.transform(date, col.format ?? 'dd MMM y, h:mm a') ?? '—';
      }
      case 'currency':
        return `₹${this.decimalPipe.transform(Number(value) || 0, col.format ?? '1.0-0')}`;
      case 'number':
        return this.decimalPipe.transform(Number(value) || 0, col.format ?? '1.0-2') ?? '—';
      default:
        return String(value);
    }
  }

  protected imageSrc(col: TableColumn<T>, row: T): string {
    const value = this.cellValue(col, row);
    return typeof value === 'string' ? value : '';
  }

  /** Mirrors the old tables: a descending sort counts down from the row total. */
  protected displayIndex(i: number): number {
    const offset = this.pageIndex() * this.size();
    return this.sort().direction === 'desc' ? this.total() - (offset + i) : offset + i + 1;
  }

  protected templateFor(key: string): TemplateRef<TableCellContext<T>> | null {
    return this.cellTemplates().get(key) ?? null;
  }

  protected rowKey(row: T, index: number): unknown {
    const custom = this.trackBy();
    if (custom) return custom(row, index);

    const record = row as unknown as Record<string, unknown>;
    return record['id'] ?? record['uid'] ?? record['orderId'] ?? index;
  }

  protected columnClass(col: TableColumn<T>): string {
    return [
      col.cellClass ?? '',
      col.hideBelow ? `dt-hide-${col.hideBelow}` : '',
      col.align ? `dt-align-${col.align}` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  protected ariaSort(col: TableColumn<T>): 'ascending' | 'descending' | 'none' | null {
    if (!col.sortable) return null;
    const { key, direction } = this.sort();
    if (key !== col.key) return 'none';
    return direction === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIcon(col: TableColumn<T>): string {
    const { key, direction } = this.sort();
    if (key !== col.key) return 'unfold_more';
    return direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  protected onHeaderClick(col: TableColumn<T>): void {
    if (!col.sortable) return;

    this.sort.update((current) =>
      current.key === col.key
        ? { key: col.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key: col.key, direction: 'asc' },
    );
    this.requestedPage.set(0);
  }

  protected setSearch(value: string): void {
    this.search.set(value);
    this.requestedPage.set(0);
  }

  protected changeSize(value: number): void {
    this.size.set(value);
    this.requestedPage.set(0);
  }

  protected goTo(page: number): void {
    this.requestedPage.set(Math.max(0, Math.min(page, this.pageCount() - 1)));
  }

  protected onRowClick(row: T): void {
    if (this.clickableRows()) this.rowClick.emit(row);
  }
}
