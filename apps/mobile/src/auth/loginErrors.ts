import { ApiError, NetworkError } from '../api/errors';

export function loginErrorKey(err: unknown, mode: 'worker' | 'admin'): string {
  if (err instanceof NetworkError) return 'login.errors.network';
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'INVALID_CREDENTIALS':
        return mode === 'worker' ? 'login.errors.wrong' : 'login.errors.wrongAdmin';
      case 'ACCOUNT_LOCKED':
        return 'login.errors.locked';
      case 'ACCOUNT_INACTIVE':
        return 'login.errors.inactive';
      case 'RATE_LIMITED':
        return 'login.errors.tooMany';
      case 'VALIDATION_ERROR':
        // The phone is checked on the phone, so for workers this means a bad PIN or number.
        return mode === 'worker' ? 'login.errors.wrong' : 'login.errors.invalid';
    }
  }
  console.warn('login failed', err);
  return 'login.errors.generic';
}

export function lostReasonKey(reason: string | null): string | null {
  if (!reason) return null;
  return reason === 'ACCOUNT_INACTIVE' ? 'login.errors.inactive' : 'login.errors.sessionExpired';
}
