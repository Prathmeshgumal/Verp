import { useEffect, useState } from 'react';
import NativeVeDevice from '../../specs/NativeVeDevice';
import type { Fix } from './location';

/** Streams fixes about once a second until the returned function is called. Nothing is sent to the server. */
export function watchLocation(onFix: (fix: Fix) => void, intervalMs = 1000): () => void {
  const subscription = NativeVeDevice.onLocationUpdate((f) =>
    onFix({ lat: f.lat, lng: f.lng, accuracyM: f.accuracyM, isMock: f.isMock }),
  );
  NativeVeDevice.startLocationWatch(intervalMs);
  return () => {
    subscription.remove();
    NativeVeDevice.stopLocationWatch();
  };
}

/** The latest fix while `active`; null before the first one and after pausing, so a stale reading is never shown. */
export function useLiveFix(active: boolean): Fix | null {
  const [fix, setFix] = useState<Fix | null>(null);
  useEffect(() => {
    if (!active) return;
    const stop = watchLocation(setFix);
    return () => {
      stop();
      setFix(null);
    };
  }, [active]);
  return fix;
}
