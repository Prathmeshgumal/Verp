import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/scripts/migrate.ts', 'src/scripts/seed-admin.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  // @ve/shared ships TypeScript source, so it must be bundled rather than imported at runtime.
  noExternal: ['@ve/shared'],
});
