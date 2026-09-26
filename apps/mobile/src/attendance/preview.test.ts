import { distanceMeters, evaluateGeofence } from '@ve/shared';
import { previewStatus } from './preview';

const centre = { lat: 18.59, lng: 73.73 };
const at = (lat: number, lng: number, accuracyM: number, isMock = false) => ({ lat, lng, accuracyM, isMock });

test('no reading yet is "finding"', () => {
  expect(previewStatus(null, { ...centre, radiusM: 100 }, 50)).toEqual({ kind: 'finding' });
});

test('inside, outside and imprecise, with rounded numbers', () => {
  expect(previewStatus(at(18.59, 73.73, 7.6), { ...centre, radiusM: 100 }, 50)).toEqual({ kind: 'inside', distanceM: 0, accuracyM: 8 });
  const far = at(18.6, 73.73, 9);
  expect(previewStatus(far, { ...centre, radiusM: 100 }, 50)).toEqual({
    kind: 'outside',
    distanceM: Math.round(distanceMeters(far, centre)),
    accuracyM: 9,
  });
  expect(previewStatus(at(18.59, 73.73, 85), { ...centre, radiusM: 100 }, 50)).toEqual({ kind: 'imprecise', accuracyM: 85 });
});

test('edges give the same answer as the server rule', () => {
  const point = at(18.5905, 73.7304, 50);
  const exact = distanceMeters(point, centre);
  const cases = [
    { radiusM: exact, maxAccuracyM: 50 }, // exactly on the circle, accuracy exactly at the limit
    { radiusM: exact - 0.01, maxAccuracyM: 50 }, // a hair outside
    { radiusM: exact, maxAccuracyM: 49.99 }, // accuracy a hair too poor
  ];
  const kinds = cases.map(({ radiusM, maxAccuracyM }) => {
    const server = evaluateGeofence({ point, accuracyM: point.accuracyM, site: { ...centre, radiusM }, maxAccuracyM });
    const preview = previewStatus(point, { ...centre, radiusM }, maxAccuracyM).kind;
    const expected = server.ok ? 'inside' : server.reason === 'LOW_ACCURACY' ? 'imprecise' : 'outside';
    expect(preview).toBe(expected);
    return preview;
  });
  expect(kinds).toEqual(['inside', 'outside', 'imprecise']);
});
