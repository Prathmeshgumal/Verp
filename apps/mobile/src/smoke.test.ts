import { normalizePhone } from '@ve/shared';

test('the mobile app can import @ve/shared', () => {
  expect(normalizePhone('98765 43210')).toBe('+919876543210');
});
