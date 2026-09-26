import i18n from '../i18n';
import { ApiError, NetworkError } from '../api/errors';
import { loginErrorKey, lostReasonKey } from './loginErrors';

const api = (code: string, status = 401) => new ApiError(status, code, code, null);

test.each([
  [api('INVALID_CREDENTIALS'), 'worker', 'login.errors.wrong'],
  [api('INVALID_CREDENTIALS'), 'admin', 'login.errors.wrongAdmin'],
  [api('ACCOUNT_LOCKED', 423), 'worker', 'login.errors.locked'],
  [api('ACCOUNT_INACTIVE', 403), 'worker', 'login.errors.inactive'],
  [api('RATE_LIMITED', 429), 'admin', 'login.errors.tooMany'],
  [api('VALIDATION_ERROR', 400), 'worker', 'login.errors.wrong'],
  [api('VALIDATION_ERROR', 400), 'admin', 'login.errors.invalid'],
  [new NetworkError('offline'), 'worker', 'login.errors.network'],
  [new Error('boom'), 'worker', 'login.errors.generic'],
] as const)('%s (%s) → %s', (err, mode, key) => {
  expect(loginErrorKey(err, mode)).toBe(key);
  expect(i18n.exists(key)).toBe(true);
});

test('lost-session reasons map to a message', () => {
  expect(lostReasonKey(null)).toBeNull();
  expect(lostReasonKey('ACCOUNT_INACTIVE')).toBe('login.errors.inactive');
  expect(lostReasonKey('SESSION_EXPIRED')).toBe('login.errors.sessionExpired');
});
