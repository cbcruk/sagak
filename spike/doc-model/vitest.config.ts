import { defineConfig } from 'vitest/config'

/**
 * 브라우저가 필요 없습니다. 1단계는 순수 자료구조라 노드에서 돕니다 —
 * 그것이 이 단계를 DOM 과 떼어 놓은 이유입니다.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
