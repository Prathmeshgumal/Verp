import { expect, test } from 'vitest';
import { ApiError, NetworkError } from '../api/errors';
import { errorMessage } from './errors';

test('known codes get plain English', () => {
  expect(errorMessage(new ApiError(401, 'INVALID_CREDENTIALS', 'x'))).toBe('Wrong email or password');
  expect(errorMessage(new ApiError(409, 'PHONE_TAKEN', 'x'))).toBe('Another employee already has this mobile number');
  expect(errorMessage(new ApiError(400, 'INVALID_CHECKOUT_TIME', 'x'))).toBe(
    'Check-out must be after check-in, on the same day, and not in the future',
  );
});

test('network problems say what to do', () => {
  expect(errorMessage(new NetworkError('offline'))).toBe('Cannot reach the server. Check your internet');
  expect(errorMessage(new NetworkError('timeout'))).toBe('The server took too long. Try again');
});

test('other client errors show the server message; server errors do not', () => {
  expect(errorMessage(new ApiError(400, 'VALIDATION_ERROR', 'Export has 9000 rows, more than the 5000 limit; narrow the date range'))).toBe(
    'Export has 9000 rows, more than the 5000 limit; narrow the date range',
  );
  expect(errorMessage(new ApiError(500, 'INTERNAL', 'db exploded'))).toBe('Something went wrong on the server. Try again');
  expect(errorMessage(new Error('boom'))).toBe('Something went wrong. Try again');
});
