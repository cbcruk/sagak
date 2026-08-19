import { describe, it, expect, vi, afterEach } from 'vitest'
import { EventBus } from '@/core/event-bus'
import { createErrorReporter } from '@/core/errors'
import { EditorCore } from '@/core/editor-core'
import type { EditorContext } from '@/core/types'
import { CoreEvents } from '@/core/events'
import { setLogLevel } from '@/core/logger'

/**
 * 오류 피드백 경로 테스트
 *
 * Why: 삼켜지던 플러그인/코어 오류를 소비자가 구독할 수 있어야 함
 * How: createErrorReporter, EventBus 중앙 포착, EditorCore onError, 플러그인 reportError 검증
 */
describe('error reporting', () => {
  afterEach(() => {
    setLogLevel('warn')
    vi.restoreAllMocks()
  })

  describe('createErrorReporter', () => {
    it('로그를 남기고 ERROR 이벤트를 발행해야 함', () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const bus = new EventBus()
      const received: unknown[] = []
      bus.on(CoreEvents.ERROR, (data?: unknown) => {
        received.push(data)
      })

      const report = createErrorReporter(bus, 'test-source')
      const err = new Error('boom')
      report(err, 'Something failed:')

      // 기존 로깅 동작 유지 (verbatim 인자)
      expect(consoleError).toHaveBeenCalledWith('Something failed:', err)
      // ERROR 이벤트 발행
      expect(received).toEqual([
        { source: 'test-source', message: 'Something failed:', error: err },
      ])
    })
  })

  describe('EventBus 중앙 오류 포착', () => {
    it('핸들러가 throw하면 ERROR 이벤트를 발행해야 함', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const bus = new EventBus()
      const errors: Array<{ source: string }> = []
      bus.on(CoreEvents.ERROR, (data?: unknown) => {
        errors.push(data as { source: string })
      })

      bus.on('SOME_EVENT', () => {
        throw new Error('handler failed')
      })
      bus.emit('SOME_EVENT')

      expect(errors).toHaveLength(1)
      expect(errors[0].source).toContain('event-bus:SOME_EVENT')
    })

    it('ERROR 핸들러 자체가 throw해도 무한 루프에 빠지지 않아야 함', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const bus = new EventBus()
      let count = 0
      bus.on(CoreEvents.ERROR, () => {
        count++
        throw new Error('error handler failed')
      })

      bus.on('SOME_EVENT', () => {
        throw new Error('handler failed')
      })

      // 재귀 없이 종료되어야 함
      expect(() => bus.emit('SOME_EVENT')).not.toThrow()
      expect(count).toBe(1)
    })
  })

  describe('EditorCore onError 콜백', () => {
    it('ERROR 이벤트 발생 시 onError를 호출해야 함', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const onError = vi.fn()
      const core = new EditorCore({ onError })

      core.getEventBus().emit(CoreEvents.ERROR, {
        source: 'x',
        message: 'y',
        error: new Error('z'),
      })

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'x', message: 'y' })
      )

      core.destroy()
    })

    it('destroy 후에는 onError를 호출하지 않아야 함', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const onError = vi.fn()
      const core = new EditorCore({ onError })
      const bus = core.getEventBus()

      core.destroy()
      bus.emit(CoreEvents.ERROR, { source: 'x', message: 'y', error: null })

      expect(onError).not.toHaveBeenCalled()
    })
  })

  describe('플러그인 reportError', () => {
    /**
     * Why: 플러그인이 삼킨 오류는 소비자가 볼 수 있어야 합니다.
     * How: 예전에는 `definePlugin` 이 `reportError` 를 핸들러에 넣어 줬습니다.
     *      서식 플러그인 24개가 커맨드가 되면서 그 팩토리를 쓰는 곳이 하나도
     *      안 남아 지웠고, 남은 플러그인들은 `createErrorReporter` 를 직접
     *      부릅니다 — 재는 것은 그 규약입니다.
     */
    it('플러그인 이름을 소스로 하여 오류를 발행해야 함', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const errors: Array<{ source: string; message: string }> = []

      const failingPlugin = {
        name: 'test:failing',
        initialize(context: EditorContext) {
          const report = createErrorReporter(
            context.eventBus,
            'plugin:test:failing'
          )

          context.eventBus.on('DO_FAIL', () => {
            report(new Error('nope'), 'Failed to do thing:')

            return false
          })
        },
      }

      const core = new EditorCore()
      core.getEventBus().on(CoreEvents.ERROR, (data?: unknown) => {
        errors.push(data as { source: string; message: string })
      })
      await core.registerPlugin(failingPlugin)
      await core.run()

      core.exec('DO_FAIL')

      expect(errors).toHaveLength(1)
      expect(errors[0].source).toBe('plugin:test:failing')
      expect(errors[0].message).toBe('Failed to do thing:')

      core.destroy()
    })
  })
})
