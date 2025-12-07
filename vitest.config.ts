import { defineConfig } from 'vitest/config'
import { createSagakAliases } from './vite.shared'

export default defineConfig({
  resolve: {
    alias: createSagakAliases(import.meta.url),
  },
  test: {
    globals: true,
    setupFiles: [],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.pnpm/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,tsup,build}.config.*',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/vite-env.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.browser.test.ts',
        '**/*.browser.test.tsx',
      ],
    },
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
      headless: true,
    },
    include: ['packages/*/test/**/*.browser.test.{ts,tsx}'],
  },
})
