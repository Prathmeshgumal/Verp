import { expect, test } from 'vitest';
import { adminDay } from '../../testing/fakes';
import { dayPins } from './DayMap';

test('draws the check-in and check-out positions', () => {
  expect(dayPins(adminDay()).map((p) => p.key)).toEqual(['in', 'out']);
});

test('no check-out dot when an admin set the time', () => {
  expect(dayPins(adminDay({ flags: ['ADMIN_CORRECTED'] })).map((p) => p.key)).toEqual(['in']);
});
