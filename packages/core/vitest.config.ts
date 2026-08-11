import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
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
      /*
       * playwright 가 기대하는 chromium 빌드와 설치된 것이 다른 환경이
       * 있습니다. 그때만 실행 파일 경로를 넘겨 주면 됩니다 —
       * `CHROMIUM_PATH=/path/to/chrome pnpm test`.
       * 안 넘기면 지금까지와 똑같이 playwright 가 알아서 찾습니다.
       */
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
