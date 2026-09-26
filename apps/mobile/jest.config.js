module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  restoreMocks: true,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-svg|react-native-webview|react-native-screens|react-native-safe-area-context)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/'],
};
