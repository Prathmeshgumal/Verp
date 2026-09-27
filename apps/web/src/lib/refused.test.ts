import { describe, expect, it } from 'vitest';
import { formatDistance, refusedTitle, refusedWhere } from './refused';

describe('refused attempt wording', () => {
  it('names the kind of attempt and why it was refused', () => {
    expect(refusedTitle({ type: 'IN', result: 'OUTSIDE_SITE' })).toBe('Check-in refused · outside the site');
    expect(refusedTitle({ type: 'OUT', result: 'LOW_ACCURACY' })).toBe('Check-out refused · location not accurate enough');
  });

  it('says how far from the site, or the accuracy when there is no distance', () => {
    expect(refusedWhere({ distanceM: 140.4, siteName: 'Plot 7', accuracyM: 12 })).toBe('140 m from Plot 7');
    expect(refusedWhere({ distanceM: 2345, siteName: null, accuracyM: 12 })).toBe('2.3 km from the site');
    expect(refusedWhere({ distanceM: null, siteName: 'Plot 7', accuracyM: 87.6 })).toBe('accuracy ±88 m');
    expect(formatDistance(999)).toBe('999 m');
  });
});
