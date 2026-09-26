import { expect, test } from 'vitest';
import { attemptResultLabel, flagLabel, STATUS_LABEL } from './labels';

test('labels for statuses, flags and attempt results', () => {
  expect(STATUS_LABEL.MISSED_CHECKOUT).toBe('Missed check-out');
  expect(flagLabel('MOCK_LOCATION')).toBe('Fake GPS app');
  expect(flagLabel('SOMETHING_NEW')).toBe('Something new');
  expect(attemptResultLabel('OUTSIDE_SITE')).toBe('Outside the site');
  expect(attemptResultLabel('ODD')).toBe('ODD');
});
