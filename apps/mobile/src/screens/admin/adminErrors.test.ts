import i18n from '../../i18n';
import { ApiError, NetworkError } from '../../api/errors';
import { adminErrorKey } from './adminErrors';

test.each([
  [new ApiError(409, 'PHONE_TAKEN', 'x', null), 'admin.errors.phoneTaken'],
  [new ApiError(409, 'EMPLOYEE_CODE_TAKEN', 'x', null), 'admin.errors.codeTaken'],
  [new ApiError(400, 'VALIDATION_ERROR', 'x', null), 'admin.errors.invalid'],
  [new ApiError(404, 'SITE_NOT_FOUND', 'x', null), 'admin.errors.notFound'],
  [new NetworkError('offline'), 'common.noInternet'],
  [new Error('boom'), 'admin.errors.generic'],
])('%s → %s', (err, key) => {
  expect(adminErrorKey(err)).toBe(key);
  expect(i18n.exists(key)).toBe(true);
});
