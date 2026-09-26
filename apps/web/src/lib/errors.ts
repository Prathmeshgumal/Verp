import { ApiError, NetworkError } from '../api/errors';

const MESSAGES: Partial<Record<string, string>> = {
  INVALID_CREDENTIALS: 'Wrong email or password',
  ACCOUNT_LOCKED: 'Too many wrong tries. Try again in 15 minutes',
  ACCOUNT_INACTIVE: 'This account is turned off',
  RATE_LIMITED: 'Too many attempts. Wait a minute and try again',
  SESSION_EXPIRED: 'Please log in again',
  FORBIDDEN: 'You do not have access to this',
  NOT_FOUND: 'Not found. It may have been removed',
  PHONE_TAKEN: 'Another employee already has this mobile number',
  EMAIL_TAKEN: 'This email is already used',
  EMPLOYEE_CODE_TAKEN: 'Another employee already has this code',
  SITE_NOT_FOUND: 'That site no longer exists',
  INVALID_CHECKOUT_TIME: 'Check-out must be after check-in, on the same day, and not in the future',
  INVALID_STATE: 'The employee is still checked in',
};

export function errorMessage(err: unknown): string {
  if (err instanceof NetworkError) {
    return err.reason === 'timeout' ? 'The server took too long. Try again' : 'Cannot reach the server. Check your internet';
  }
  if (err instanceof ApiError) {
    return MESSAGES[err.code] ?? (err.status >= 500 ? 'Something went wrong on the server. Try again' : err.message);
  }
  return 'Something went wrong. Try again';
}
