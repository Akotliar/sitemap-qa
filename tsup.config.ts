import { defineConfig } from 'tsup';
import { readFileSync, cpSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  shims: true,
  platform: 'node',
  external: ['playwright', 'playwright-core'],
  define: {
    '__PACKAGE_VERSION__': JSON.stringify(packageJson.version),
  },
  onSuccess: async () => {
    // Copy templates to dist folder
    cpSync('src/reporters/templates', 'dist/reporters/templates', { recursive: true });
    console.log('✓ Templates copied to dist/reporters/templates');
  },
});
