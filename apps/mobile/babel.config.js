module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // zod v4 (via @ve/shared) ships `export * as ns from`, which the RN preset does not transform.
  plugins: ['@babel/plugin-transform-export-namespace-from'],
};
