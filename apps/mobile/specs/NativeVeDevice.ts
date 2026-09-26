import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type NativeDeviceInfo = {
  deviceId: string;
  deviceModel: string;
  appVersion: string;
  apiUrl: string;
  tileUrl: string;
  sdkInt: number;
};

export type NativeFix = { lat: number; lng: number; accuracyM: number; isMock: boolean };

export interface Spec extends TurboModule {
  getDeviceInfo(): Promise<NativeDeviceInfo>;
  randomUuid(): Promise<string>;
  secureGet(key: string): Promise<string | null>;
  secureSet(key: string, value: string): Promise<void>;
  secureDelete(key: string): Promise<void>;
  prefGet(key: string): Promise<string | null>;
  prefSet(key: string, value: string): Promise<void>;
  prefDelete(key: string): Promise<void>;
  isLocationEnabled(): Promise<boolean>;
  /** Resolves with the best reading within timeoutMs (early once accuracy <= target); rejects with code NO_FIX if none. */
  getCurrentPosition(timeoutMs: number, targetAccuracyM: number): Promise<NativeFix>;
  /** Schedules the one check-out reminder; returns false if that moment has already passed. */
  scheduleReminder(workDate: string, reminderTime: string, timezone: string, title: string, body: string): Promise<boolean>;
  cancelReminder(): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeVeDevice');
