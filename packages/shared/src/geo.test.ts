import { describe, expect, it } from 'vitest';
import { distanceMeters, evaluateGeofence } from './geo';

const site = { lat: 18.5204, lng: 73.8567, radiusM: 50 };

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters(site, site)).toBe(0);
  });
  it('measures one degree of latitude as ~111,195 m', () => {
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, -1);
  });
  it('measures ~11 m for 0.0001° latitude', () => {
    expect(distanceMeters(site, { lat: site.lat + 0.0001, lng: site.lng })).toBeCloseTo(11.1, 0);
  });
});

describe('evaluateGeofence', () => {
  const base = { site, maxAccuracyM: 50 };

  it('accepts a point inside the radius', () => {
    const r = evaluateGeofence({ ...base, point: { lat: site.lat + 0.0004, lng: site.lng }, accuracyM: 10 });
    expect(r.ok).toBe(true);
    expect(r.distanceM).toBeCloseTo(44.5, 0);
  });

  it('accepts a point exactly on the radius (inclusive)', () => {
    const point = { lat: site.lat + 0.0004, lng: site.lng };
    const exact = { ...site, radiusM: distanceMeters(point, site) };
    expect(evaluateGeofence({ site: exact, maxAccuracyM: 50, point, accuracyM: 10 }).ok).toBe(true);
  });

  it('rejects a point outside the radius', () => {
    const r = evaluateGeofence({ ...base, point: { lat: site.lat + 0.0005, lng: site.lng }, accuracyM: 10 });
    expect(r).toMatchObject({ ok: false, reason: 'OUTSIDE_SITE' });
    expect(r.distanceM).toBeCloseTo(55.6, 0);
  });

  it('accepts accuracy exactly at the limit', () => {
    expect(evaluateGeofence({ ...base, point: site, accuracyM: 50 }).ok).toBe(true);
  });

  it('rejects low accuracy before checking distance', () => {
    const r = evaluateGeofence({ ...base, point: { lat: site.lat + 1, lng: site.lng }, accuracyM: 50.1 });
    expect(r).toMatchObject({ ok: false, reason: 'LOW_ACCURACY' });
  });
});
