import { expect, test } from 'vitest';
import { employee } from '../testing/fakes';
import { attemptResultLabel, employeeStatus, flagLabel, formatPhone, STATUS_LABEL } from './labels';

test('labels for statuses, flags and attempt results', () => {
  expect(STATUS_LABEL.MISSED_CHECKOUT).toBe('Missed check-out');
  expect(flagLabel('MOCK_LOCATION')).toBe('Fake GPS app');
  expect(flagLabel('SOMETHING_NEW')).toBe('Something new');
  expect(attemptResultLabel('OUTSIDE_SITE')).toBe('Outside the site');
  expect(attemptResultLabel('ODD')).toBe('ODD');
});

test('phone numbers are grouped for reading', () => {
  expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
  expect(formatPhone('+4420123456')).toBe('+4420123456');
});

test('employee status: inactive beats locked beats active', () => {
  const now = Date.parse('2026-09-25T06:00:00Z');
  expect(employeeStatus(employee(), now).label).toBe('Active');
  expect(employeeStatus(employee({ lockedUntil: '2026-09-25T06:10:00Z' }), now).label).toBe('Locked');
  expect(employeeStatus(employee({ lockedUntil: '2026-09-25T05:50:00Z' }), now).label).toBe('Active');
  expect(employeeStatus(employee({ isActive: false, lockedUntil: '2026-09-25T06:10:00Z' }), now).label).toBe('Inactive');
});
