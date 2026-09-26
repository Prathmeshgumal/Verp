import { afterEach, expect, test, vi } from 'vitest';
import { locateBest } from './locate';

afterEach(() => {
  vi.useRealTimers();
});

const position = (latitude: number, longitude: number, accuracy: number) =>
  ({ coords: { latitude, longitude, accuracy } }) as GeolocationPosition;

/** A fake Geolocation whose watch callbacks the test fires by hand. */
function fakeGeo() {
  let success: PositionCallback = () => {};
  let failure: PositionErrorCallback | null | undefined;
  const geo = {
    watchPosition: vi.fn((s: PositionCallback, f?: PositionErrorCallback | null) => {
      success = s;
      failure = f;
      return 7;
    }),
    clearWatch: vi.fn(),
  };
  return {
    geo: geo as unknown as Geolocation,
    clearWatch: geo.clearWatch,
    send: (lat: number, lng: number, accuracy: number) => success(position(lat, lng, accuracy)),
    fail: (code: number) => failure?.({ code } as GeolocationPositionError),
  };
}

test('a reading within the allowed accuracy ends the search at once', async () => {
  const g = fakeGeo();
  const result = locateBest(g.geo, 50);
  g.send(17.4166, 78.3663, 12);
  await expect(result).resolves.toEqual({ kind: 'ok', reading: { lat: 17.4166, lng: 78.3663, accuracyM: 12 } });
  expect(g.clearWatch).toHaveBeenCalledWith(7);
});

test('keeps listening while readings improve, and reports progress', async () => {
  const g = fakeGeo();
  const progress: number[] = [];
  const result = locateBest(g.geo, 50, (m) => progress.push(m));
  g.send(17.5, 78.5, 900);
  g.send(17.4166, 78.3663, 30);
  await expect(result).resolves.toEqual({ kind: 'ok', reading: { lat: 17.4166, lng: 78.3663, accuracyM: 30 } });
  expect(progress).toEqual([900, 30]);
});

test('a laptop-style guess is reported as imprecise after 20 seconds', async () => {
  vi.useFakeTimers();
  const g = fakeGeo();
  const result = locateBest(g.geo, 50);
  g.send(17.5, 78.5, 1400);
  g.send(17.49, 78.49, 900);
  await vi.advanceTimersByTimeAsync(20_000);
  await expect(result).resolves.toEqual({ kind: 'imprecise', reading: { lat: 17.49, lng: 78.49, accuracyM: 900 } });
  expect(g.clearWatch).toHaveBeenCalled();
});

test('refused permission and silence are told apart', async () => {
  const denied = fakeGeo();
  const r1 = locateBest(denied.geo, 50);
  denied.fail(1);
  await expect(r1).resolves.toEqual({ kind: 'denied' });

  vi.useFakeTimers();
  const silent = fakeGeo();
  const r2 = locateBest(silent.geo, 50);
  silent.fail(2);
  await vi.advanceTimersByTimeAsync(20_000);
  await expect(r2).resolves.toEqual({ kind: 'unavailable' });
});
