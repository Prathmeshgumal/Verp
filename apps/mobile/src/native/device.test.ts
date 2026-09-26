import { fakeNative, fakeState } from '../testing/fakeNative';
import { getDeviceInfo, prefs, randomUuid, secureStore } from './device';

test('getDeviceInfo asks the native module once and caches it', async () => {
  const spy = jest.spyOn(fakeNative, 'getDeviceInfo');
  const [a, b] = await Promise.all([getDeviceInfo(), getDeviceInfo()]);
  expect(a).toEqual(b);
  expect(a.apiUrl).toBe('http://api.test');
  expect(spy).toHaveBeenCalledTimes(1);
});

test('getDeviceInfo retries after a native failure', async () => {
  const spy = jest.spyOn(fakeNative, 'getDeviceInfo').mockRejectedValueOnce(new Error('boom'));
  await expect(getDeviceInfo()).rejects.toThrow('boom');
  await expect(getDeviceInfo()).resolves.toMatchObject({ deviceId: 'device-1' });
  expect(spy).toHaveBeenCalledTimes(2);
});

test('secure store and prefs round-trip and delete', async () => {
  await secureStore.set('refreshToken', 'abc');
  expect(await secureStore.get('refreshToken')).toBe('abc');
  await secureStore.remove('refreshToken');
  expect(await secureStore.get('refreshToken')).toBeNull();

  await prefs.setJson('user', { id: 'u1' });
  expect(await prefs.getJson<{ id: string }>('user')).toEqual({ id: 'u1' });
});

test('prefs.getJson returns null for corrupt JSON instead of throwing', async () => {
  fakeState.prefs.set('user', '{not json');
  expect(await prefs.getJson('user')).toBeNull();
});

test('randomUuid returns distinct values', async () => {
  expect(await randomUuid()).not.toBe(await randomUuid());
});
