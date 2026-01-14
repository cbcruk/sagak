import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'sagak-core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      '@/editor': fileURLToPath(new URL('../core/src/editor', import.meta.url)),
      '@/core': fileURLToPath(new URL('../core/src/core', import.meta.url)),
      '@/plugins': fileURLToPath(new URL('../core/src/plugins', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
      headless: true,
    },
    include: ['test/**/*.browser.test.{ts,tsx}'],
  },
})
