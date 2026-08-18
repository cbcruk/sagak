import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * 진짜 브라우저가 필요한 검사들.
 *
 * jsdom 으로 도는 `roundtrip`·`paste`·`style-marks` 는 **제가 손으로 쓴
 * 마크업**을 봅니다. 여기 있는 것은 **제품이 실제로 만든 마크업**을 봅니다 —
 * 커맨드가 `document.execCommand` 와 네이티브 선택 영역을 거치므로 흉내로는
 * 같은 결과가 안 나옵니다.
 *
 * ## `LANG=C.UTF-8`
 *
 * OPFS 에 한글 이름을 쓸 때 렌더러가 통째로 죽는 것을 막습니다. 이유는
 * `packages/ui/vitest.config.ts` 에 적혀 있습니다 — 페이지가 죽으면 그 파일의
 * 검사는 실패가 아니라 **아예 보고되지 않아서** 요약만 보면 초록으로 읽힙니다.
 *
 * ## `CHROMIUM_PATH`
 *
 * playwright 가 기대하는 chromium 과 설치된 것이 다를 때만 씁니다.
 */
const UTF8_LOCALE = { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }

export default defineConfig({
  resolve: {
    alias: {
      'sagak-core': fileURLToPath(
        new URL('../../packages/core/src/index.ts', import.meta.url)
      ),
      '@': fileURLToPath(
        new URL('../../packages/core/src', import.meta.url)
      ),
    },
  },
  test: {
    globals: true,
    include: ['test/**/*.browser.test.ts'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
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
    },
  },
})
