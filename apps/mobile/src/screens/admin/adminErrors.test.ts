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

test('google maps link problems have their own messages', () => {
  const err = (code: string) => new ApiError(422, code, code, { code });
  expect(adminErrorKey(err('NOT_A_MAPS_LINK'))).toBe('admin.sites.link.notMapsLink');
  expect(adminErrorKey(err('NO_EXACT_PIN'))).toBe('admin.sites.link.noExactPin');
  expect(adminErrorKey(err('LINK_UNREACHABLE'))).toBe('admin.sites.link.unreachable');
});
