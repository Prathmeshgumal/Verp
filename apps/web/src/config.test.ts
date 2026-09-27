import { expect, test } from 'vitest';
import { envOr } from './config';

test('an empty or blank env value falls back to the default', () => {
  expect(envOr('', 'fallback')).toBe('fallback');
  expect(envOr('  ', 'fallback')).toBe('fallback');
  expect(envOr(undefined, 'fallback')).toBe('fallback');
  expect(envOr('https://tiles.test/{z}/{x}/{y}.png', 'fallback')).toBe('https://tiles.test/{z}/{x}/{y}.png');
});
