import { PermissionsAndroid } from 'react-native';
import { fakeNative, fakeState } from '../testing/fakeNative';
import { ensureLocationReady, getBestFix } from './location';

const FINE = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const COARSE = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

function grant(fine: string, coarse: string) {
  return jest
    .spyOn(PermissionsAndroid, 'requestMultiple')
    .mockResolvedValue({ [FINE]: fine, [COARSE]: coarse } as never);
}

test('location services off asks to turn them on before any permission prompt', async () => {
  fakeState.locationEnabled = false;
  const request = grant('granted', 'granted');
  expect(await ensureLocationReady()).toBe('LOCATION_OFF');
  expect(request).not.toHaveBeenCalled();
});

test('precise permission granted is ready', async () => {
  const request = grant('granted', 'granted');
  expect(await ensureLocationReady()).toBeNull();
  expect(request).toHaveBeenCalledWith([FINE, COARSE]);
});

test('approximate-only permission on Android 12+ asks for precise location', async () => {
  fakeState.info.sdkInt = 31;
  grant('denied', 'granted');
  expect(await ensureLocationReady()).toBe('PRECISE_LOCATION_REQUIRED');
});

test('denied or never-ask-again permission is PERMISSION_DENIED', async () => {
  grant('denied', 'denied');
  expect(await ensureLocationReady()).toBe('PERMISSION_DENIED');
  jest.restoreAllMocks();
  grant('never_ask_again', 'never_ask_again');
  expect(await ensureLocationReady()).toBe('PERMISSION_DENIED');
});

test('coarse-only below Android 12 is PERMISSION_DENIED (no precise toggle exists there)', async () => {
  fakeState.info.sdkInt = 30;
  grant('denied', 'granted');
  expect(await ensureLocationReady()).toBe('PERMISSION_DENIED');
});

test('getBestFix asks for up to 20 s and stops at the target accuracy', async () => {
  const spy = jest.spyOn(fakeNative, 'getCurrentPosition');
  expect(await getBestFix(50)).toEqual({ lat: 18.5912, lng: 73.7389, accuracyM: 12, isMock: false });
  expect(spy).toHaveBeenCalledWith(20000, 50);
});

test('getBestFix passes the mock flag through untouched', async () => {
  fakeState.fix = { lat: 1, lng: 2, accuracyM: 5, isMock: true };
  expect((await getBestFix(50))?.isMock).toBe(true);
});

test('getBestFix returns null when there is no reading at all', async () => {
  fakeState.fix = null;
  expect(await getBestFix(50)).toBeNull();
});
