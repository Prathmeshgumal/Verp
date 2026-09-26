import { act, renderHook } from '@testing-library/react-native';
import { emitFakeLocation, fakeState } from '../testing/fakeNative';
import { useLiveFix, watchLocation } from './liveLocation';

const reading = { lat: 18.59, lng: 73.73, accuracyM: 7, isMock: false };

test('watching streams fixes until stopped', () => {
  const onFix = jest.fn();
  const stop = watchLocation(onFix, 1000);
  expect(fakeState.watchIntervalMs).toBe(1000);
  emitFakeLocation(reading);
  expect(onFix).toHaveBeenCalledWith(reading);
  stop();
  expect(fakeState.watchIntervalMs).toBeNull();
  emitFakeLocation({ ...reading, lat: 18.6 });
  expect(onFix).toHaveBeenCalledTimes(1);
});

test('the hook watches only while active and forgets the last fix when paused', async () => {
  const { result, rerender } = await renderHook(({ active }: { active: boolean }) => useLiveFix(active), {
    initialProps: { active: false },
  });
  expect(fakeState.watchIntervalMs).toBeNull();
  await rerender({ active: true });
  expect(fakeState.watchIntervalMs).toBe(1000);
  await act(async () => emitFakeLocation(reading));
  expect(result.current).toEqual(reading);
  await rerender({ active: false });
  expect(fakeState.watchIntervalMs).toBeNull();
  expect(result.current).toBeNull();
});
