import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CommandRegistry,
  runCommand,
  type CommandContext,
} from '@/core/command-registry'
import { registerLegacyExecCommands } from '@/core/legacy-exec-command'
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
      registry.register('foo', () => true)

      expect(registry.run('foo')).toBe(true)
    })

    it('핸들러가 없으면 false를 반환해야 함', () => {
      const registry = new CommandRegistry(ctx)
      expect(registry.run('missing')).toBe(false)
    })

    it('높은 precedence 핸들러를 먼저 시도해야 함', () => {
      const registry = new CommandRegistry(ctx)
      const order: string[] = []
      registry.register(
        'foo',
        () => {
          order.push('low')
          return true
        },
        0
      )
      registry.register(
        'foo',
        () => {
          order.push('high')
          return true
        },
        100
      )

      registry.run('foo')
      expect(order).toEqual(['high'])
    })

    it('undefined를 반환하면 다음 핸들러로 위임해야 함', () => {
      const registry = new CommandRegistry(ctx)
      const order: string[] = []
      registry.register(
        'foo',
        () => {
          order.push('high')
          return undefined
        },
        100
      )
      registry.register(
        'foo',
        () => {
          order.push('low')
          return true
        },
        0
      )

      expect(registry.run('foo')).toBe(true)
      expect(order).toEqual(['high', 'low'])
    })

    it('핸들러의 false는 결과로 사용되어 다음으로 넘어가지 않아야 함', () => {
      const registry = new CommandRegistry(ctx)
      const lower = vi.fn(() => true)
      registry.register('foo', () => false, 100)
      registry.register('foo', lower, 0)

      expect(registry.run('foo')).toBe(false)
      expect(lower).not.toHaveBeenCalled()
    })

    it('값 인자를 핸들러에 전달해야 함', () => {
      const registry = new CommandRegistry(ctx)
      const handler = vi.fn(() => true)
      registry.register('foo', handler)

      registry.run('foo', 'bar')
      expect(handler).toHaveBeenCalledWith(ctx, 'bar')
    })

    it('등록 해제 후에는 핸들러가 실행되지 않아야 함', () => {
      const registry = new CommandRegistry(ctx)
      const handler = vi.fn(() => true)
      const unsub = registry.register('foo', handler)

      unsub()
      expect(registry.run('foo')).toBe(false)
      expect(handler).not.toHaveBeenCalled()
      expect(registry.has('foo')).toBe(false)
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
      registry.register('foo', () => {
        order.push('command')
        return true
      })

      const result = runCommand(registry, eventBus, 'foo')
      expect(result).toBe(true)
      expect(order).toEqual(['snapshot', 'command'])
    })

    it('커맨드가 성공하면 실행 뒤에 FOCUS_REQUESTED를 발행해야 함', () => {
      const registry = new CommandRegistry(ctx)
      const order: string[] = []
      eventBus.on(CoreEvents.FOCUS_REQUESTED, 'on', () => {
        order.push('focus')
      })
      registry.register('foo', () => {
        order.push('command')
        return true
      })

      runCommand(registry, eventBus, 'foo')
      expect(order).toEqual(['command', 'focus'])
    })

    it('커맨드가 실패하면 FOCUS_REQUESTED를 발행하지 않아야 함', () => {
      const registry = new CommandRegistry(ctx)
      let focusCount = 0
      eventBus.on(CoreEvents.FOCUS_REQUESTED, 'on', () => {
        focusCount += 1
      })
      registry.register('foo', () => false)

      expect(runCommand(registry, eventBus, 'foo')).toBe(false)
      expect(focusCount).toBe(0)
    })

    it('등록되지 않은 커맨드에는 FOCUS_REQUESTED를 발행하지 않아야 함', () => {
      const registry = new CommandRegistry(ctx)
      let focusCount = 0
      eventBus.on(CoreEvents.FOCUS_REQUESTED, 'on', () => {
        focusCount += 1
      })

      expect(runCommand(registry, eventBus, 'nope')).toBe(false)
      expect(focusCount).toBe(0)
    })
  })

  describe('registerLegacyExecCommands', () => {
    it('run은 document.execCommand에 위임해야 함', () => {
      const spy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)
      const registry = new CommandRegistry(ctx)
      registerLegacyExecCommands(registry)

      expect(registry.run('bold')).toBe(true)
      expect(spy).toHaveBeenCalledWith('bold', false)
    })

    it('값이 있으면 execCommand 3번째 인자로 전달해야 함', () => {
      const spy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)
      const registry = new CommandRegistry(ctx)
      registerLegacyExecCommands(registry)

      registry.run('foreColor', '#ff0000')
      expect(spy).toHaveBeenCalledWith('foreColor', false, '#ff0000')
    })

    it('queryState는 document.queryCommandState에 위임해야 함', () => {
      const spy = vi
        .spyOn(document, 'queryCommandState')
        .mockReturnValue(true)
      const registry = new CommandRegistry(ctx)
      registerLegacyExecCommands(registry)

      expect(registry.queryState('italic')).toBe(true)
      expect(spy).toHaveBeenCalledWith('italic')
    })

    it('자체 구현이 더 높은 precedence로 레거시를 오버라이드해야 함', () => {
      const spy = vi.spyOn(document, 'execCommand').mockReturnValue(true)
      const registry = new CommandRegistry(ctx)
      registerLegacyExecCommands(registry)
      registry.register('bold', () => true, 0) // 레거시(-100)보다 높음

      registry.run('bold')
      expect(spy).not.toHaveBeenCalled()
    })
  })
})
