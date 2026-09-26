import { ApiError, NetworkError } from '../../api/errors';

export function adminErrorKey(err: unknown): string {
  if (err instanceof NetworkError) return 'common.noInternet';
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'PHONE_TAKEN':
        return 'admin.errors.phoneTaken';
      case 'EMPLOYEE_CODE_TAKEN':
        return 'admin.errors.codeTaken';
      case 'VALIDATION_ERROR':
        return 'admin.errors.invalid';
      case 'NOT_FOUND':
      case 'SITE_NOT_FOUND':
        return 'admin.errors.notFound';
    }
  }
  console.warn('admin action failed', err);
  return 'admin.errors.generic';
}
