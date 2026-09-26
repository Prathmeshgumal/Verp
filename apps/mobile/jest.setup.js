// Shared Jest setup for @ve/mobile.
jest.mock('./specs/NativeVeDevice', () => ({
  __esModule: true,
  default: require('./src/testing/fakeNative').fakeNative,
}));

beforeEach(() => {
  require('./src/testing/fakeNative').resetFakeNative();
  require('./src/native/device').resetDeviceInfoCache();
});
