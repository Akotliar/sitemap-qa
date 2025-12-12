import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  shims: true,
  define: {
    '__PACKAGE_VERSION__': JSON.stringify(packageJson.version),
  },
});
