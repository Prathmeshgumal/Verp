export interface Reading {
  lat: number;
  lng: number;
  accuracyM: number;
}

export type LocateResult =
  | { kind: 'ok'; reading: Reading }
  | { kind: 'imprecise'; reading: Reading }
  | { kind: 'denied' }
  | { kind: 'unavailable' };

/**
 * Listens for up to `timeoutMs`, keeping the most accurate reading, and stops early once one is within `maxAccuracyM`.
 * A laptop without GPS usually ends as 'imprecise': the browser only has a Wi-Fi or IP guess.
 */
export function locateBest(
  geo: Geolocation,
  maxAccuracyM: number,
  onProgress: (accuracyM: number) => void = () => {},
  timeoutMs = 20_000,
): Promise<LocateResult> {
  return new Promise((resolve) => {
    let best: Reading | null = null;
    let done = false;
    let watchId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: LocateResult) => {
      if (done) return;
      done = true;
      if (timer !== null) clearTimeout(timer);
      if (watchId !== null) geo.clearWatch(watchId);
      resolve(result);
    };

    timer = setTimeout(() => finish(best ? { kind: 'imprecise', reading: best } : { kind: 'unavailable' }), timeoutMs);
    watchId = geo.watchPosition(
      (pos) => {
        const reading = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy };
        if (!best || reading.accuracyM < best.accuracyM) best = reading;
        onProgress(best.accuracyM);
        if (best.accuracyM <= maxAccuracyM) finish({ kind: 'ok', reading: best });
      },
      (err) => {
        // 1 = PERMISSION_DENIED. Other errors (no signal yet, timeout) wait for the deadline.
        if (err.code === 1) finish({ kind: 'denied' });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    );
    // The first callback can fire inside watchPosition, before watchId was assigned.
    if (done) geo.clearWatch(watchId);
  });
}
