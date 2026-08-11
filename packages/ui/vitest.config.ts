import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  resolve: {
    // preact 인스턴스가 둘로 갈리면 훅이 렌더 컨텍스트를 못 찾습니다
    dedupe: ['preact', 'preact/hooks'],
    alias: {
      'sagak-core': fileURLToPath(
        new URL('../core/src/index.ts', import.meta.url)
      ),
      '@/editor': fileURLToPath(new URL('../core/src/editor', import.meta.url)),
      '@/core': fileURLToPath(new URL('../core/src/core', import.meta.url)),
      '@/plugins': fileURLToPath(
        new URL('../core/src/plugins', import.meta.url)
      ),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    browser: {
      enabled: true,
      provider: 'playwright',
      // core 와 같은 이유 — `CHROMIUM_PATH` 로 실행 파일을 지정할 수 있습니다
      instances: [
        {
          browser: 'chromium',
          launch: process.env.CHROMIUM_PATH
            ? { executablePath: process.env.CHROMIUM_PATH }
            : {},
        },
      ],
      headless: true,
    },
    include: ['test/**/*.browser.test.{ts,tsx}'],
  },
})
