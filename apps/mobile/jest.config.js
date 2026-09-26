module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  restoreMocks: true,
  // CI runs every workspace's tests at once on 2 cores; the slow screen tests need more than 5 s there.
  testTimeout: 30000,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-svg|react-native-webview|react-native-screens|react-native-safe-area-context)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/'],
};
