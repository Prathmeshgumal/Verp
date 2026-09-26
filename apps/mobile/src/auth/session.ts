import type { PublicUser } from '@ve/shared';
import { prefs } from '../native/device';
import { cancelCheckoutReminder } from '../native/reminder';
import { StorageKeys } from '../storageKeys';

export const loadCachedUser = () => prefs.getJson<PublicUser>(StorageKeys.user);

export const saveCachedUser = (user: PublicUser) => prefs.setJson(StorageKeys.user, user);

/** Everything on the phone that belongs to the signed-in person. Tokens are cleared by the API client. */
export async function clearLocalSession(): Promise<void> {
  await Promise.all([prefs.remove(StorageKeys.user), prefs.remove(StorageKeys.pendingAction)]);
  try {
    await cancelCheckoutReminder();
  } catch (err) {
    console.warn('session: could not cancel reminder', err);
  }
}
