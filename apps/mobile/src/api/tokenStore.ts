import { secureStore } from '../native/device';
import type { TokenStore } from './client';

const KEY = 'refreshToken';

export const secureTokenStore: TokenStore = {
  getRefreshToken: () => secureStore.get(KEY),
  setRefreshToken: (token) => (token ? secureStore.set(KEY, token) : secureStore.remove(KEY)),
};
