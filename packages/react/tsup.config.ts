import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  minify: false,
  external: ['react', 'react-dom', 'sagak-core'],
  esbuildOptions(options) {
    options.jsx = 'automatic'
  },
})
