import { inject, Injectable } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';

import { ApiService } from './api.service';
import { AddressUser, PaymentPrefs, User } from '../../shared/models/user.model';

/** Signed parameters for a direct browser→Cloudinary upload. */
interface AvatarSignature {
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private api = inject(ApiService);

  getUsers(): Observable<User[]> {
    return this.api.get<{ items: User[] }>('/users').pipe(map((res) => res.items));
  }

  getUserById(uid: string): Observable<User> {
    return this.api.get<{ user: User }>(`/users/${uid}`).pipe(map((res) => res.user));
  }

  updateUser(uid: string, changes: Partial<User>): Observable<User> {
    return this.api.patch<{ user: User }>(`/users/${uid}`, changes).pipe(map((res) => res.user));
  }

  deleteUser(id: string): Observable<void> {
    return this.api.delete<void>(`/users/${id}`);
  }

  /**
   * Uploads an avatar straight to Cloudinary, then saves the returned URL.
   *
   * The file does not pass through our API — it asks for a signature, posts the file to
   * Cloudinary directly, and only sends the resulting URL back to be stored. That keeps
   * the API secret on the server and large uploads off it.
   */
  uploadAvatar(uid: string, file: File): Observable<User> {
    return this.api.get<AvatarSignature>(`/users/${uid}/avatar`).pipe(
      switchMap((sig) => {
        const form = new FormData();
        form.append('file', file);
        form.append('api_key', sig.apiKey);
        form.append('timestamp', String(sig.timestamp));
        form.append('signature', sig.signature);
        form.append('folder', sig.folder);
        form.append('public_id', sig.publicId);
        form.append('overwrite', 'true');

        // Plain fetch, not HttpClient: this request must NOT carry our session cookie or
        // the API base URL, and Cloudinary rejects unexpected headers.
        return from(
          fetch(sig.uploadUrl, { method: 'POST', body: form }).then(async (res) => {
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error?.message ?? 'Image upload failed');
            return body as { secure_url: string; public_id: string };
          }),
        );
      }),
      switchMap((uploaded) =>
        this.api.post<{ user: User }>(`/users/${uid}/avatar`, {
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
        }),
      ),
      map((res) => res.user),
    );
  }

  removeAvatar(uid: string): Observable<User> {
    return this.api.delete<{ user: User }>(`/users/${uid}/avatar`).pipe(map((res) => res.user));
  }

  /** Default payment method and UPI ids. Card data is never sent or stored. */
  updatePaymentPrefs(uid: string, prefs: Partial<PaymentPrefs>): Observable<User> {
    return this.api
      .patch<{ user: User }>(`/users/${uid}/payment-prefs`, prefs)
      .pipe(map((res) => res.user));
  }

  getAddresses(uid: string): Observable<AddressUser[]> {
    return this.api
      .get<{ items: AddressUser[] }>(`/users/${uid}/addresses`)
      .pipe(map((res) => res.items));
  }

  addAddress(uid: string, address: AddressUser): Observable<AddressUser[]> {
    return this.api
      .post<{ items: AddressUser[] }>(`/users/${uid}/addresses`, address)
      .pipe(map((res) => res.items));
  }

  updateAddress(uid: string, addressId: string, address: AddressUser): Observable<AddressUser[]> {
    return this.api
      .patch<{ items: AddressUser[] }>(`/users/${uid}/addresses/${addressId}`, address)
      .pipe(map((res) => res.items));
  }

  deleteAddress(uid: string, addressId: string): Observable<AddressUser[]> {
    return this.api
      .delete<{ items: AddressUser[] }>(`/users/${uid}/addresses/${addressId}`)
      .pipe(map((res) => res.items));
  }
}
