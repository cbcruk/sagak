import { describe, it, expect, vi, afterEach } from 'vitest'
import { createErrorReporter } from '@/core/errors'
import type { EditorErrorData } from '@/core/errors'
import { EditorCore } from '@/core/editor-core'
import type { EditorContext } from '@/core/types'
import { setLogLevel } from '@/core/logger'

/**
 * 오류가 어디로 가는가.
 *
 * 예전에는 `CoreEvents.ERROR` 를 버스에 쏘고 `EditorCore` 가 그것을 받아
 * `onError` 로 넘겼습니다 — **코어가 쏘고 코어가 받는 왕복**이었고, 버스에
 * 마지막까지 남아 있던 이유였습니다.
 *
 * 지금은 `context.onError` 를 직접 부릅니다. 받는 곳이 없어도 로그는 남습니다.
 */
describe('오류 보고', () => {
  afterEach(() => {
    setLogLevel('warn')
    vi.restoreAllMocks()
  })

  describe('createErrorReporter', () => {
    it('로그를 남기고 받는 곳에 넘겨야 함', () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const received: EditorErrorData[] = []

      const report = createErrorReporter(
        (data) => received.push(data),
        'test-source'
      )
      const err = new Error('boom')

      report(err, 'Something failed:')

      /* 기존 로깅 동작 유지 (verbatim 인자) */
      expect(consoleError).toHaveBeenCalledWith('Something failed:', err)
      expect(received).toEqual([
        { source: 'test-source', message: 'Something failed:', error: err },
      ])
    })

    /**
     * 받는 곳은 **선택**입니다 — `onError` 를 안 준 사람에게도 로그는 남아야
     * 합니다. 예전에는 버스가 늘 있었으므로 이 갈래가 없었습니다.
     */
    it('받는 곳이 없어도 로그는 남아야 함', () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const report = createErrorReporter(undefined, 'test-source')
      const err = new Error('boom')

      expect(() => report(err, 'Something failed:')).not.toThrow()
      expect(consoleError).toHaveBeenCalledWith('Something failed:', err)
    })
  })

  describe('플러그인이 낸 오류', () => {
    /**
     * Why: 플러그인이 삼킨 오류는 소비자가 볼 수 있어야 합니다.
     * How: 예전에는 버스를 한 바퀴 돌았습니다. 지금은 컨텍스트에 실려 온
     *      `onError` 를 그대로 부릅니다 — **`createEditor` 에 준 그 함수**입니다.
     */
    it('플러그인 이름을 소스로 하여 알려야 함', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const errors: EditorErrorData[] = []
      const core = new EditorCore({
        onError: (data) => errors.push(data),
      })

      await core.registerPlugin({
        name: 'test:failing',
        initialize(context: EditorContext) {
          const report = createErrorReporter(
            context.onError,
            'plugin:test:failing'
          )

          report(new Error('nope'), 'Failed to do thing:')
        },
      })
      await core.run()

      expect(errors).toHaveLength(1)
      expect(errors[0].source).toBe('plugin:test:failing')
      expect(errors[0].message).toBe('Failed to do thing:')

      core.destroy()
    })
  })
})
