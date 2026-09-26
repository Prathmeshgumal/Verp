// Shared Jest setup for @ve/mobile.
jest.mock('./specs/NativeVeDevice', () => ({
  __esModule: true,
  default: require('./src/testing/fakeNative').fakeNative,
}));

beforeEach(() => {
  require('./src/testing/fakeNative').resetFakeNative();
  require('./src/native/device').resetDeviceInfoCache();
});

require('./src/i18n');

jest.mock('react-native-svg', () => {
  const React = require('react');
  const host = (name) => {
    const Component = (props) => React.createElement(name, props, props.children);
    Component.displayName = name;
    return Component;
  };
  return { __esModule: true, default: host('Svg'), Svg: host('Svg'), Path: host('Path') };
});

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
