import { Linking, PermissionsAndroid } from 'react-native';
import NativeVeDevice from '../../specs/NativeVeDevice';
import { getDeviceInfo } from './device';

export type LocationProblem = 'LOCATION_OFF' | 'PERMISSION_DENIED' | 'PRECISE_LOCATION_REQUIRED';

export interface Fix {
  lat: number;
  lng: number;
  accuracyM: number;
  isMock: boolean;
}

const FIX_TIMEOUT_MS = 20_000;

/** Run on every tap: covers Android 11 "only this time" and settings changed while the app was open. */
export async function ensureLocationReady(): Promise<LocationProblem | null> {
  if (!(await NativeVeDevice.isLocationEnabled())) return 'LOCATION_OFF';
  const { FINE, COARSE } = {
    FINE: PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    COARSE: PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  };
  const result = await PermissionsAndroid.requestMultiple([FINE, COARSE]);
  const granted = PermissionsAndroid.RESULTS.GRANTED;
  if (result[FINE] === granted) return null;
  const { sdkInt } = await getDeviceInfo();
  if (result[COARSE] === granted && sdkInt >= 31) return 'PRECISE_LOCATION_REQUIRED';
  return 'PERMISSION_DENIED';
}

export async function getBestFix(targetAccuracyM: number, timeoutMs = FIX_TIMEOUT_MS): Promise<Fix | null> {
  try {
    const fix = await NativeVeDevice.getCurrentPosition(timeoutMs, targetAccuracyM);
    return { lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM, isMock: fix.isMock };
  } catch (err) {
    console.warn('location: no fix', err);
    return null;
  }
}

export function openLocationSettings(): Promise<void> {
  return Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
}

export function openAppSettings(): Promise<void> {
  return Linking.openSettings();
}
