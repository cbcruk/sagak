import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CommandRegistry,
  runCommand,
  type CommandContext,
} from '@/core/command-registry'
import { EventBus } from '@/core/event-bus'
import { CoreEvents } from '@/core/events'

/**
 * CommandRegistry 테스트
 *
 * Why: execCommand 의존을 격리하는 커맨드 추상화 계층의 정확성 검증
 * How: precedence 실행 순서, 위임(decline), 상태 조회, 레거시 어댑터를 확인
 */
describe('CommandRegistry', () => {
  let eventBus: EventBus
  let ctx: CommandContext

  beforeEach(() => {
    eventBus = new EventBus()
    ctx = { eventBus }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('register / run', () => {
    it('등록한 핸들러의 결과를 반환해야 함', () => {
      const registry = new CommandRegistry(ctx)
      registry.register('bold', () => true)

      expect(registry.run('bold')).toBe(true)
    })

    it('핸들러가 없으면 false를 반환해야 함', () => {
      const registry = new CommandRegistry(ctx)
      expect(registry.run('insertText', '가')).toBe(false)
    })

    it('높은 precedence 핸들러를 먼저 시도해야 함', () => {
      const registry = new CommandRegistry(ctx)
      const order: string[] = []
      registry.register(
        'bold',
        () => {
          order.push('low')
          return true
        },
        0
      )
      registry.register(
        'bold',
        () => {
          order.push('high')
          return true
        },
        100
      )

      registry.run('bold')
      expect(order).toEqual(['high'])
    })

    it('undefined를 반환하면 다음 핸들러로 위임해야 함', () => {
      const registry = new CommandRegistry(ctx)
      const order: string[] = []
      registry.register(
        'bold',
        () => {
          order.push('high')
          return undefined
        },
        100
      )
      registry.register(
        'bold',
        () => {
          order.push('low')
          return true
        },
        0
      )

      expect(registry.run('bold')).toBe(true)
      expect(order).toEqual(['high', 'low'])
    })

    it('핸들러의 false는 결과로 사용되어 다음으로 넘어가지 않아야 함', () => {
      const registry = new CommandRegistry(ctx)
      const lower = vi.fn(() => true)
      registry.register('bold', () => false, 100)
      registry.register('bold', lower, 0)

      expect(registry.run('bold')).toBe(false)
      expect(lower).not.toHaveBeenCalled()
    })

    it('값 인자를 핸들러에 전달해야 함', () => {
      const registry = new CommandRegistry(ctx)
      const handler = vi.fn(() => true)
      registry.register('fontName', handler)

      registry.run('fontName', 'Georgia')
      expect(handler).toHaveBeenCalledWith(ctx, 'Georgia')
    })

    it('등록 해제 후에는 핸들러가 실행되지 않아야 함', () => {
      const registry = new CommandRegistry(ctx)
      const handler = vi.fn(() => true)
      const unsub = registry.register('bold', handler)

      unsub()
      expect(registry.run('bold')).toBe(false)
      expect(handler).not.toHaveBeenCalled()
      expect(registry.has('bold')).toBe(false)
    })
  })

  describe('queryState', () => {
    it('등록한 조회 함수의 결과를 반환해야 함', () => {
      const registry = new CommandRegistry(ctx)
      registry.registerStateQuery('bold', () => true)

      expect(registry.queryState('bold')).toBe(true)
    })

    it('조회 함수가 없으면 false를 반환해야 함', () => {
      const registry = new CommandRegistry(ctx)
      expect(registry.queryState('bold')).toBe(false)
    })
  })

  describe('runCommand 헬퍼', () => {
    it('CAPTURE_SNAPSHOT를 발행한 뒤 커맨드를 실행해야 함', () => {
      const registry = new CommandRegistry(ctx)
      const order: string[] = []
      eventBus.on(CoreEvents.CAPTURE_SNAPSHOT, 'on', () => {
        order.push('snapshot')
      })
      registry.register('bold', () => {
        order.push('command')
        return true
      })

      const result = runCommand(registry, eventBus, 'bold')
      expect(result).toBe(true)
      expect(order).toEqual(['snapshot', 'command'])
    })

    it('커맨드가 성공하면 실행 뒤에 FOCUS_REQUESTED를 발행해야 함', () => {
      const registry = new CommandRegistry(ctx)
      const order: string[] = []
      eventBus.on(CoreEvents.FOCUS_REQUESTED, 'on', () => {
        order.push('focus')
      })
      registry.register('bold', () => {
        order.push('command')
        return true
      })

      runCommand(registry, eventBus, 'bold')
      expect(order).toEqual(['command', 'focus'])
    })

    it('커맨드가 실패하면 FOCUS_REQUESTED를 발행하지 않아야 함', () => {
      const registry = new CommandRegistry(ctx)
      let focusCount = 0
      eventBus.on(CoreEvents.FOCUS_REQUESTED, 'on', () => {
        focusCount += 1
      })
      registry.register('bold', () => false)

      expect(runCommand(registry, eventBus, 'bold')).toBe(false)
      expect(focusCount).toBe(0)
    })

    it('등록되지 않은 커맨드에는 FOCUS_REQUESTED를 발행하지 않아야 함', () => {
      const registry = new CommandRegistry(ctx)
      let focusCount = 0
      eventBus.on(CoreEvents.FOCUS_REQUESTED, 'on', () => {
        focusCount += 1
      })

      expect(runCommand(registry, eventBus, 'insertHorizontalRule')).toBe(
        false
      )
      expect(focusCount).toBe(0)
    })
  })

  /**
   * precedence 체인 자체를 잽니다.
   *
   * 예전에는 이 자리에 `registerLegacyExecCommands` 가 있었습니다 —
   * `document.execCommand` 로 된 최하위 폴백이었고, 그 위에 자체 구현이
   * 얹히는 것을 여기서 확인했습니다. 그 층은 **모델이 늘 먼저 답하게 되면서
   * 한 번도 안 잡혀** 지웠습니다 (`test/model/command-layers.browser.test.ts`).
   *
   * 체인 규약은 그대로 살아 있으므로 층을 흉내 내 잽니다.
   */
  describe('precedence 체인', () => {
    it('높은 층이 낮은 층을 가립니다', () => {
      const registry = new CommandRegistry(ctx)
      const low = vi.fn(() => true)

      registry.register('bold', low, -100)
      registry.register('bold', () => true, 100)

      expect(registry.run('bold')).toBe(true)
      expect(low).not.toHaveBeenCalled()
    })

    /**
     * `undefined` 는 **"처리하지 않았다"** 입니다. 모델 커맨드가 상태 없이
     * 불렸을 때 이 답을 주고, 그래서 아래 층이 이어받습니다.
     */
    it('처리하지 않으면 아래 층으로 넘어갑니다', () => {
      const registry = new CommandRegistry(ctx)
      const low = vi.fn(() => true)

      registry.register('bold', low, -100)
      registry.register('bold', () => undefined, 100)

      expect(registry.run('bold')).toBe(true)
      expect(low).toHaveBeenCalled()
    })

    it('값 조회도 같은 규약을 씁니다', () => {
      const registry = new CommandRegistry(ctx)

      registry.registerValueQuery('fontSize', () => '15px', 0)
      registry.registerValueQuery('fontSize', () => undefined, 100)

      expect(registry.queryValue('fontSize')).toBe('15px')
    })
  })
})
