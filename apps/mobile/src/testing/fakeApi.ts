import type { Api } from '../api/endpoints';

/** An Api whose unstubbed methods reject loudly, so a test never silently hits a default. */
export function fakeApi(overrides: Partial<Api> = {}): Api {
  return new Proxy(overrides, {
    get(target, prop) {
      if (prop === 'then') return undefined; // not a thenable
      if (prop in target) return target[prop as keyof Api];
      return () => Promise.reject(new Error(`fakeApi.${String(prop)} not stubbed`));
    },
  }) as Api;
}
