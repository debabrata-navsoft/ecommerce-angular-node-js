import { inject, Injectable, signal } from '@angular/core';
import { BehaviorSubject, catchError, filter, map, Observable, of, tap } from 'rxjs';

import { User } from '../../shared/models/user.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private api = inject(ApiService);

  private subject = new BehaviorSubject<User | null | undefined>(undefined);

  readonly user$: Observable<User | null> = this.subject
    .asObservable()
    .pipe(filter((value): value is User | null => value !== undefined));

  readonly user = signal<User | null>(null);
  readonly isReady = signal(false);

  constructor() {
    this.refresh().subscribe();
  }

  refresh(): Observable<User | null> {
    return this.api.get<{ user: User | null }>('/auth/me').pipe(
      map((res) => res.user),
      catchError(() => of(null)),
      tap((user) => this.settle(user)),
    );
  }

  settle(user: User | null): void {
    this.subject.next(user);
    this.user.set(user);
    this.isReady.set(true);
  }

  clear(): void {
    this.settle(null);
  }

  get uid(): string | undefined {
    return this.user()?.uid;
  }
}
