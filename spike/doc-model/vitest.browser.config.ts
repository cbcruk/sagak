import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

/**
 * 2단계 — 진짜 브라우저가 필요합니다.
 *
 * jsdom 으로는 이 스파이크가 재려는 것을 잴 수 없습니다. IME 조합,
 * `beforeinput` 의 `cancelable`, 네이티브 캐럿은 전부 실제 렌더러의 동작이고
 * 흉내로는 거짓 결론이 나옵니다.
 *
 * ## `CHROMIUM_PATH`
 *
 * 환경에 따라 playwright 가 기대하는 chromium 빌드 번호와 설치된 것이
 * 다를 수 있습니다. 그때만 실행 파일 경로를 넘겨 주면 됩니다.
 *
 * ```bash
 * CHROMIUM_PATH=/opt/pw-browsers/chromium npx vitest run --root spike/doc-model -c vitest.browser.config.ts
 * ```
 */
const executablePath = process.env.CHROMIUM_PATH

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.browser.test.ts'],
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: executablePath ? { executablePath } : {},
      }),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
})
