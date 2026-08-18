import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    /* 브라우저가 필요한 것은 `vitest.browser.config.ts` 가 맡습니다 */
    exclude: ['test/**/*.browser.test.ts'],
  },
})
