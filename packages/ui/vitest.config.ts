import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

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
  /*
   * Preact 와 Svelte 를 **같이** 둡니다.
   *
   * 이주 중에는 두 렌더러가 공존합니다. 각 플러그인은 자기 확장자만 다루므로
   * (`.tsx` / `.svelte`) 서로 안 부딪힙니다.
   *
   * 이 줄이 이주 전체의 전제입니다 — 안 물리면 Svelte 로 가는 길이 막힙니다.
   */
  plugins: [preact(), svelte()],
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
