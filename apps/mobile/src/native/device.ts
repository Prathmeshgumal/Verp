import NativeVeDevice from '../../specs/NativeVeDevice';

export interface DeviceInfo {
  deviceId: string;
  deviceModel: string;
  appVersion: string;
  apiUrl: string;
  tileUrl: string;
  sdkInt: number;
}

let cached: Promise<DeviceInfo> | null = null;

export function getDeviceInfo(): Promise<DeviceInfo> {
  if (!cached) {
    cached = NativeVeDevice.getDeviceInfo().catch((err: unknown) => {
      cached = null;
      throw err;
    });
  }
  return cached;
}

export function resetDeviceInfoCache(): void {
  cached = null;
}

export const randomUuid = (): Promise<string> => NativeVeDevice.randomUuid();

export const secureStore = {
  get: (key: string) => NativeVeDevice.secureGet(key),
  set: (key: string, value: string) => NativeVeDevice.secureSet(key, value),
  remove: (key: string) => NativeVeDevice.secureDelete(key),
};

export const prefs = {
  get: (key: string) => NativeVeDevice.prefGet(key),
  set: (key: string, value: string) => NativeVeDevice.prefSet(key, value),
  remove: (key: string) => NativeVeDevice.prefDelete(key),
  async getJson<T>(key: string): Promise<T | null> {
    const raw = await NativeVeDevice.prefGet(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setJson: (key: string, value: unknown) => NativeVeDevice.prefSet(key, JSON.stringify(value)),
};
