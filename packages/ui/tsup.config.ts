import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  minify: false,
  external: ['sagak-core'],
})
