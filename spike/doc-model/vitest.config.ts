import { defineConfig } from 'vitest/config'

/**
 * 1단계 — 순수 자료구조. 브라우저가 필요 없습니다.
 *
 * 2단계의 DOM 테스트는 `vitest.browser.config.ts` 로 분리했습니다.
 * 진짜 브라우저가 필요한 것과 아닌 것을 섞으면, 실패했을 때 어느 쪽이
 * 문제인지 구분이 안 됩니다.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.browser.test.ts'],
  },
})
