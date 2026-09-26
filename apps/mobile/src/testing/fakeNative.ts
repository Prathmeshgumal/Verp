import type { NativeDeviceInfo, Spec } from '../../specs/NativeVeDevice';

export type FakeFix = { lat: number; lng: number; accuracyM: number; isMock: boolean };
export type FakeReminder = { workDate: string; reminderTime: string; timezone: string; title: string; body: string };

export interface FakeNativeState {
  secure: Map<string, string>;
  prefs: Map<string, string>;
  info: NativeDeviceInfo;
  locationEnabled: boolean;
  fix: FakeFix | null;
  reminders: FakeReminder[];
  uuidSeq: number;
}

function initialState(): FakeNativeState {
  return {
    secure: new Map(),
    prefs: new Map(),
    info: {
      deviceId: 'device-1',
      deviceModel: 'Test Phone',
      appVersion: '0.1.0',
      apiUrl: 'http://api.test',
      tileUrl: 'https://tiles.test/{z}/{x}/{y}.png',
      sdkInt: 34,
    },
    locationEnabled: true,
    fix: { lat: 18.5912, lng: 73.7389, accuracyM: 12, isMock: false },
    reminders: [],
    uuidSeq: 0,
  };
}

export const fakeState: FakeNativeState = initialState();

export function resetFakeNative(): void {
  Object.assign(fakeState, initialState());
}

/** In-memory stand-in for the Kotlin module. Methods added by later tasks live here too. */
export const fakeNative = {
  getDeviceInfo: async () => ({ ...fakeState.info }),
  randomUuid: async () => `00000000-0000-4000-8000-${String(++fakeState.uuidSeq).padStart(12, '0')}`,
  secureGet: async (key: string) => fakeState.secure.get(key) ?? null,
  secureSet: async (key: string, value: string) => {
    fakeState.secure.set(key, value);
  },
  secureDelete: async (key: string) => {
    fakeState.secure.delete(key);
  },
  prefGet: async (key: string) => fakeState.prefs.get(key) ?? null,
  prefSet: async (key: string, value: string) => {
    fakeState.prefs.set(key, value);
  },
  prefDelete: async (key: string) => {
    fakeState.prefs.delete(key);
  },
} satisfies Spec;
