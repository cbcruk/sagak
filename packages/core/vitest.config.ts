import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * 브라우저를 **UTF-8 로케일**로 띄웁니다.
 *
 * 이게 없으면 한글 이름의 문서를 OPFS 에 쓸 때 **렌더러가 통째로 죽습니다.**
 * 페이지가 죽으면 그 파일의 테스트는 실패가 아니라 **아예 보고되지 않아서**,
 * 요약 줄만 보면 초록으로 읽힙니다 (`Tests 1088 passed (1110)` — 괄호 안이
 * 실제 개수입니다. 22개가 조용히 빠져 있었습니다).
 *
 * 원인은 제품 코드가 아니라 환경입니다. 이 컨테이너는 `LC_CTYPE=POSIX` 라
 * Chromium 이 OPFS 이름을 실제 파일명으로 옮기지 못합니다. 리눅스 파일시스템
 * 자체는 한글 이름을 잘 받습니다 — 확인했습니다.
 *
 * 재현: `메모.html` 을 쓰는 테스트 **하나만** 돌려도 죽고, `a.html` 이나
 * `memo.html` 은 멀쩡합니다. `LANG=C.UTF-8` 을 주면 통과합니다.
 *
 * 여기 박아 두는 이유는 부르는 쪽이 매번 기억하지 않게 하기 위해서입니다.
 */
const UTF8_LOCALE = { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }

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
          launch: {
            env: UTF8_LOCALE,
            ...(process.env.CHROMIUM_PATH
              ? { executablePath: process.env.CHROMIUM_PATH }
              : {}),
          },
        },
      ],
      headless: true,
    },
    include: ['test/**/*.browser.test.{ts,tsx}'],
  },
})
