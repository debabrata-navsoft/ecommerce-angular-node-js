import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { map, Observable, tap } from 'rxjs';

import { ApiService, fireAndShare } from './api.service';
import { SessionService } from './session.service';
import { User } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private router = inject(Router);

  readonly currentUser$: Observable<User | null> = this.session.user$;

  readonly isAdmin$: Observable<boolean> = this.session.user$.pipe(
    map((user) => user?.role === 'admin'),
  );

  loginAdmin(email: string, password: string): Observable<User> {
    return this.api.post<{ user: User }>('/auth/admin/login', { email, password }).pipe(
      map((res) => res.user),
      tap((user) => {
        this.session.settle(user);
        if (this.api.isBrowser) localStorage.setItem('session_role', 'admin');
      }),
    );
  }

  logout(): Observable<void> {
    return fireAndShare(
      this.api.post<void>('/auth/logout').pipe(
        tap(() => {
          if (this.api.isBrowser) localStorage.removeItem('session_role');
          this.session.clear();
          this.router.navigateByUrl('/admin/login', { replaceUrl: true });
        }),
      ),
    );
  }
}
