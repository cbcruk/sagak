import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PluginManager } from '../src/plugin-manager'
import { EventBus } from '../src/event-bus'
import type { Plugin, EditorContext } from '../src/types'

/**
 * PluginManager 테스트
 *
 * Why: 플러그인 기반 아키텍처로 확장 가능한 에디터 구현
 * How: 플러그인 등록(`register`), 의존성 해결, 생명주기 관리(`destroy`)
 */
describe('PluginManager', () => {
  let context: EditorContext
  let manager: PluginManager

  beforeEach(() => {
    context = {
      eventBus: new EventBus(),
      config: {},
    }
    manager = new PluginManager(context)
  })

  /**
   * Why: 플러그인 등록과 조회 기능 제공
   * How: `register()`로 플러그인 등록, `get()`/`has()`로 조회, context에 자기 참조 추가
   */
  describe('기본 기능 (플러그인 등록과 관리)', () => {
    it('인스턴스를 생성할 수 있어야 함', () => {
      // Given: PluginManager 클래스
      // When: 인스턴스 생성
      // Then: PluginManager 인스턴스여야 함
      expect(manager).toBeInstanceOf(PluginManager)
    })

    it('context에 자기 참조를 추가해야 함', () => {
      // Given: PluginManager 인스턴스
      // When: 생성 시점
      // Then: context.pluginManager가 자기 자신을 참조해야 함
      expect(context.pluginManager).toBe(manager)
    })

    it('간단한 플러그인을 등록할 수 있어야 함', async () => {
      // Given: 간단한 플러그인
      const plugin: Plugin = {
        name: 'test-plugin',
        initialize: vi.fn(),
      }

      // When: 플러그인 등록
      await manager.register(plugin)

      // Then: 초기화되고 조회 가능해야 함
      expect(plugin.initialize).toHaveBeenCalledWith(context)
      expect(manager.has('test-plugin')).toBe(true)
      expect(manager.get('test-plugin')).toBe(plugin)
    })

    it('여러 플러그인을 등록할 수 있어야 함', async () => {
      // Given: 두 개의 플러그인
      const plugin1: Plugin = {
        name: 'plugin-1',
        initialize: vi.fn(),
      }
      const plugin2: Plugin = {
        name: 'plugin-2',
        initialize: vi.fn(),
      }

      // When: 순차적으로 등록
      await manager.register(plugin1)
      await manager.register(plugin2)

      // Then: 모두 등록되어야 함
      expect(manager.size).toBe(2)
      expect(manager.getPluginNames()).toEqual(['plugin-1', 'plugin-2'])
    })

    it('중복 플러그인 등록 시 에러를 발생시켜야 함', async () => {
      // Given: 이미 등록된 플러그인
      const plugin: Plugin = {
        name: 'duplicate',
        initialize: vi.fn(),
      }
      await manager.register(plugin)

      // When: 동일한 플러그인 재등록 시도
      // Then: 에러가 발생해야 함
      await expect(manager.register(plugin)).rejects.toThrow(
        'Plugin "duplicate" is already registered'
      )
    })
  })

  /**
   * Why: 외부 리소스 로딩 등 비동기 초기화가 필요한 플러그인 지원
   * How: `Promise` 반환하는 `initialize()` 지원, 에러 발생 시 플러그인 등록 취소
   */
  describe('비동기 초기화 (유연한 플러그인 로딩)', () => {
    it('비동기 플러그인 초기화를 지원해야 함', async () => {
      // Given: 비동기 initialize를 가진 플러그인
      const plugin: Plugin = {
        name: 'async-plugin',
        async initialize() {
          await new Promise((resolve) => setTimeout(resolve, 10))
        },
      }

      // When: 플러그인 등록
      await manager.register(plugin)

      // Then: 비동기 초기화 완료 후 등록되어야 함
      expect(manager.has('async-plugin')).toBe(true)
    })

    it('초기화 에러를 처리해야 함', async () => {
      // Given: 초기화 시 에러를 발생시키는 플러그인
      const plugin: Plugin = {
        name: 'error-plugin',
        initialize() {
          throw new Error('Init failed')
        },
      }

      // When: 플러그인 등록 시도
      // Then: 에러가 발생하고 플러그인이 등록되지 않아야 함
      await expect(manager.register(plugin)).rejects.toThrow(
        'Failed to initialize plugin "error-plugin": Init failed'
      )

      expect(manager.has('error-plugin')).toBe(false)
    })

    it('비동기 초기화 에러를 처리해야 함', async () => {
      // Given: 비동기 초기화 시 에러를 발생시키는 플러그인
      const plugin: Plugin = {
        name: 'async-error-plugin',
        async initialize() {
          throw new Error('Async init failed')
        },
      }

      // When: 플러그인 등록 시도
      // Then: 에러가 발생하고 플러그인이 등록되지 않아야 함
      await expect(manager.register(plugin)).rejects.toThrow(
        'Failed to initialize plugin "async-error-plugin": Async init failed'
      )

      expect(manager.has('async-error-plugin')).toBe(false)
    })
  })

  /**
   * Why: 플러그인 간 의존 관계를 자동으로 해결하여 올바른 초기화 순서 보장
   * How: `dependencies` 배열로 의존성 선언, 등록 시 자동으로 의존성 확인 및 검증
   */
  describe('의존성 관리 (플러그인 간 관계 해결)', () => {
    it('의존성이 있는 플러그인을 등록할 수 있어야 함', async () => {
      // Given: 의존성 관계가 있는 두 플러그인
      const pluginA: Plugin = {
        name: 'plugin-a',
        initialize: vi.fn(),
      }

      const pluginB: Plugin = {
        name: 'plugin-b',
        dependencies: ['plugin-a'],
        initialize: vi.fn(),
      }

      // When: 의존성 순서대로 등록
      await manager.register(pluginA)
      await manager.register(pluginB)

      // Then: 모두 등록되고 초기화되어야 함
      expect(manager.size).toBe(2)
      expect(pluginB.initialize).toHaveBeenCalled()
    })

    it('누락된 의존성에 대해 에러를 발생시켜야 함', async () => {
      // Given: 존재하지 않는 의존성을 가진 플러그인
      const plugin: Plugin = {
        name: 'dependent-plugin',
        dependencies: ['non-existent'],
        initialize: vi.fn(),
      }

      // When: 플러그인 등록 시도
      // Then: 누락된 의존성 에러가 발생해야 함
      await expect(manager.register(plugin)).rejects.toThrow(
        'Plugin "dependent-plugin" has missing dependencies: non-existent'
      )
    })

    it('여러 의존성을 처리할 수 있어야 함', async () => {
      // Given: 여러 의존성을 가진 플러그인
      const pluginA: Plugin = {
        name: 'plugin-a',
        initialize: vi.fn(),
      }

      const pluginB: Plugin = {
        name: 'plugin-b',
        initialize: vi.fn(),
      }

      const pluginC: Plugin = {
        name: 'plugin-c',
        dependencies: ['plugin-a', 'plugin-b'],
        initialize: vi.fn(),
      }

      // When: 모든 플러그인 등록
      await manager.register(pluginA)
      await manager.register(pluginB)
      await manager.register(pluginC)

      // Then: 모두 등록되고 초기화되어야 함
      expect(manager.size).toBe(3)
      expect(pluginC.initialize).toHaveBeenCalled()
    })

    it('일부 의존성이 누락된 경우 에러를 발생시켜야 함', async () => {
      // Given: 일부 의존성만 등록된 상태
      const pluginA: Plugin = {
        name: 'plugin-a',
        initialize: vi.fn(),
      }

      const pluginB: Plugin = {
        name: 'plugin-b',
        dependencies: ['plugin-a', 'non-existent'],
        initialize: vi.fn(),
      }

      await manager.register(pluginA)

      // When: 누락된 의존성을 가진 플러그인 등록 시도
      // Then: 에러가 발생해야 함
      await expect(manager.register(pluginB)).rejects.toThrow(
        'missing dependencies: non-existent'
      )
    })
  })

  /**
   * Why: 순환 의존성으로 인한 무한 루프나 초기화 실패 방지
   * How: `DFS` 알고리즘으로 의존성 그래프 탐색, 순환 감지 시 에러 발생
   */
  describe('순환 의존성 감지 (안정성 보장)', () => {
    it('의존성 체인을 통한 순환 의존성을 방지해야 함', async () => {
      // Given: 순환이 없는 의존성 체인 (A → B → C, C also depends on A)
      const pluginA: Plugin = {
        name: 'plugin-a',
        initialize: vi.fn(),
      }

      const pluginB: Plugin = {
        name: 'plugin-b',
        dependencies: ['plugin-a'],
        initialize: vi.fn(),
      }

      const pluginC: Plugin = {
        name: 'plugin-c',
        dependencies: ['plugin-b', 'plugin-a'],
        initialize: vi.fn(),
      }

      // When: 모든 플러그인 등록
      await manager.register(pluginA)
      await manager.register(pluginB)
      await manager.register(pluginC)

      // Then: 순환이 아니므로 모두 등록되어야 함
      expect(manager.size).toBe(3)
    })

    it('복잡한 의존성 체인을 처리할 수 있어야 함', async () => {
      // Given: 복잡한 의존성 체인 (A → B → C → D, D also depends on A)
      const pluginA: Plugin = {
        name: 'plugin-a',
        initialize: vi.fn(),
      }

      const pluginB: Plugin = {
        name: 'plugin-b',
        dependencies: ['plugin-a'],
        initialize: vi.fn(),
      }

      const pluginC: Plugin = {
        name: 'plugin-c',
        dependencies: ['plugin-b'],
        initialize: vi.fn(),
      }

      const pluginD: Plugin = {
        name: 'plugin-d',
        dependencies: ['plugin-c', 'plugin-a'],
        initialize: vi.fn(),
      }

      // When: 모든 플러그인 등록
      await manager.register(pluginA)
      await manager.register(pluginB)
      await manager.register(pluginC)
      await manager.register(pluginD)

      // Then: 순환이 없으므로 모두 등록되어야 함
      expect(manager.size).toBe(4)
    })
  })

  /**
   * Why: 메모리 누수 방지 및 안정적인 플러그인 제거를 위한 생명주기 관리
   * How: `remove()` 시 `destroy()` 호출, `destroyAll()` 시 역순으로 모든 플러그인 정리
   */
  describe('플러그인 생명주기 (리소스 관리)', () => {
    it('플러그인 제거 시 destroy를 호출해야 함', () => {
      // Given: destroy 메서드를 가진 플러그인
      const destroyFn = vi.fn()
      const plugin: Plugin = {
        name: 'removable-plugin',
        initialize: vi.fn(),
        destroy: destroyFn,
      }
      manager.register(plugin)

      // When: 플러그인 제거
      manager.remove('removable-plugin')

      // Then: destroy가 호출되고 플러그인이 제거되어야 함
      expect(destroyFn).toHaveBeenCalledTimes(1)
      expect(manager.has('removable-plugin')).toBe(false)
    })

    it('존재하지 않는 플러그인 제거를 안전하게 처리해야 함', () => {
      // Given: 빈 PluginManager
      // When: 존재하지 않는 플러그인 제거 시도
      // Then: 에러가 발생하지 않아야 함
      expect(() => {
        manager.remove('non-existent')
      }).not.toThrow()
    })

    it('destroy 에러를 안전하게 처리해야 함', () => {
      // Given: destroy 시 에러를 발생시키는 플러그인
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const plugin: Plugin = {
        name: 'error-plugin',
        initialize: vi.fn(),
        destroy() {
          throw new Error('Destroy failed')
        },
      }
      manager.register(plugin)

      // When: 플러그인 제거
      manager.remove('error-plugin')

      // Then: 에러가 로깅되고 플러그인이 제거되어야 함
      expect(consoleError).toHaveBeenCalled()
      expect(manager.has('error-plugin')).toBe(false)

      consoleError.mockRestore()
    })

    it('모든 플러그인을 정리할 수 있어야 함', async () => {
      // Given: destroy 메서드를 가진 세 개의 플러그인
      const destroy1 = vi.fn()
      const destroy2 = vi.fn()
      const destroy3 = vi.fn()

      const plugin1: Plugin = {
        name: 'plugin-1',
        initialize: vi.fn(),
        destroy: destroy1,
      }

      const plugin2: Plugin = {
        name: 'plugin-2',
        initialize: vi.fn(),
        destroy: destroy2,
      }

      const plugin3: Plugin = {
        name: 'plugin-3',
        initialize: vi.fn(),
        destroy: destroy3,
      }

      await manager.register(plugin1)
      await manager.register(plugin2)
      await manager.register(plugin3)

      // When: destroyAll 호출
      manager.destroyAll()

      // Then: 모든 destroy 메서드가 호출되고 플러그인이 제거되어야 함
      expect(destroy1).toHaveBeenCalledTimes(1)
      expect(destroy2).toHaveBeenCalledTimes(1)
      expect(destroy3).toHaveBeenCalledTimes(1)
      expect(manager.size).toBe(0)
    })

    it('플러그인을 역순으로 정리해야 함', async () => {
      // Given: destroy 순서를 추적하는 세 개의 플러그인
      const order: string[] = []

      const plugin1: Plugin = {
        name: 'plugin-1',
        initialize: vi.fn(),
        destroy() {
          order.push('plugin-1')
        },
      }

      const plugin2: Plugin = {
        name: 'plugin-2',
        initialize: vi.fn(),
        destroy() {
          order.push('plugin-2')
        },
      }

      const plugin3: Plugin = {
        name: 'plugin-3',
        initialize: vi.fn(),
        destroy() {
          order.push('plugin-3')
        },
      }

      await manager.register(plugin1)
      await manager.register(plugin2)
      await manager.register(plugin3)

      // When: destroyAll 호출
      manager.destroyAll()

      // Then: 역순(3, 2, 1)으로 정리되어야 함
      expect(order).toEqual(['plugin-3', 'plugin-2', 'plugin-1'])
    })
  })

  /**
   * Why: 등록된 플러그인을 검색하고 확인하는 편리한 방법 제공
   * How: `getPluginNames()`, `getPlugins()`, `get()`, `has()`, `size`로 플러그인 정보 조회
   */
  describe('유틸리티 메서드 (플러그인 조회)', () => {
    it('모든 플러그인 이름을 가져올 수 있어야 함', async () => {
      // Given: 두 개의 등록된 플러그인
      const plugin1: Plugin = { name: 'plugin-1', initialize: vi.fn() }
      const plugin2: Plugin = { name: 'plugin-2', initialize: vi.fn() }
      await manager.register(plugin1)
      await manager.register(plugin2)

      // When: 플러그인 이름 조회
      const names = manager.getPluginNames()

      // Then: 모든 플러그인 이름이 배열로 반환되어야 함
      expect(names).toEqual(['plugin-1', 'plugin-2'])
    })

    it('모든 플러그인을 가져올 수 있어야 함', async () => {
      // Given: 두 개의 등록된 플러그인
      const plugin1: Plugin = { name: 'plugin-1', initialize: vi.fn() }
      const plugin2: Plugin = { name: 'plugin-2', initialize: vi.fn() }
      await manager.register(plugin1)
      await manager.register(plugin2)

      // When: 모든 플러그인 조회
      const plugins = manager.getPlugins()

      // Then: 모든 플러그인이 배열로 반환되어야 함
      expect(plugins).toHaveLength(2)
      expect(plugins).toContain(plugin1)
      expect(plugins).toContain(plugin2)
    })

    it('존재하지 않는 플러그인에 대해 undefined를 반환해야 함', () => {
      // Given: 빈 PluginManager
      // When: 존재하지 않는 플러그인 조회
      // Then: undefined를 반환해야 함
      expect(manager.get('non-existent')).toBeUndefined()
    })

    it('존재하지 않는 플러그인에 대해 has()가 false를 반환해야 함', () => {
      // Given: 빈 PluginManager
      // When: 존재하지 않는 플러그인 확인
      // Then: false를 반환해야 함
      expect(manager.has('non-existent')).toBe(false)
    })

    it('플러그인 개수를 추적해야 함', async () => {
      // Given: 빈 PluginManager
      expect(manager.size).toBe(0)

      // When: 플러그인 추가
      const plugin1: Plugin = { name: 'plugin-1', initialize: vi.fn() }
      await manager.register(plugin1)

      // Then: 개수가 증가해야 함
      expect(manager.size).toBe(1)

      // When: 플러그인 추가
      const plugin2: Plugin = { name: 'plugin-2', initialize: vi.fn() }
      await manager.register(plugin2)

      // Then: 개수가 증가해야 함
      expect(manager.size).toBe(2)

      // When: 플러그인 제거
      manager.remove('plugin-1')

      // Then: 개수가 감소해야 함
      expect(manager.size).toBe(1)

      // When: 모든 플러그인 제거
      manager.destroyAll()

      // Then: 개수가 0이 되어야 함
      expect(manager.size).toBe(0)
    })
  })

  /**
   * Why: 실제 에디터 환경에서의 복잡한 플러그인 사용 패턴 검증
   * How: `EventBus` 통합, 의존성 체인, 리소스 정리 등 실무 사용 사례 테스트
   */
  describe('실제 시나리오 (실무 적용 사례)', () => {
    it('EventBus 통합 플러그인을 지원해야 함', async () => {
      // Given: EventBus를 사용하는 플러그인
      const calls: string[] = []

      const plugin: Plugin = {
        name: 'event-plugin',
        initialize(ctx) {
          ctx.eventBus.on('TEST', 'on', () => {
            calls.push('handled')
          })
        },
      }

      // When: 플러그인 등록 후 이벤트 발행
      await manager.register(plugin)
      context.eventBus.emit('TEST')

      // Then: 이벤트가 처리되어야 함
      expect(calls).toEqual(['handled'])
    })

    it('의존성이 있는 플러그인 체인을 지원해야 함', async () => {
      // Given: 의존성 체인을 가진 플러그인들 (core → ui → feature)
      const initOrder: string[] = []

      const corePlugin: Plugin = {
        name: 'core',
        initialize() {
          initOrder.push('core')
        },
      }

      const uiPlugin: Plugin = {
        name: 'ui',
        dependencies: ['core'],
        initialize() {
          initOrder.push('ui')
        },
      }

      const featurePlugin: Plugin = {
        name: 'feature',
        dependencies: ['core', 'ui'],
        initialize() {
          initOrder.push('feature')
        },
      }

      // When: 모든 플러그인 등록
      await manager.register(corePlugin)
      await manager.register(uiPlugin)
      await manager.register(featurePlugin)

      // Then: 의존성 순서대로 초기화되어야 함
      expect(initOrder).toEqual(['core', 'ui', 'feature'])
    })

    it('destroy 시 플러그인 리소스를 정리해야 함', async () => {
      // Given: 이벤트 핸들러를 등록하고 정리하는 플러그인
      const unsubscribes: Array<() => void> = []

      const plugin: Plugin = {
        name: 'cleanup-plugin',
        initialize(ctx) {
          const unsub = ctx.eventBus.on('EVENT', 'on', () => {})
          unsubscribes.push(unsub)
        },
        destroy() {
          unsubscribes.forEach((unsub) => unsub())
        },
      }

      await manager.register(plugin)
      expect(context.eventBus.hasHandlers('EVENT')).toBe(true)

      // When: 플러그인 제거
      manager.remove('cleanup-plugin')

      // Then: 이벤트 핸들러가 정리되어야 함
      expect(context.eventBus.hasHandlers('EVENT')).toBe(false)
    })
  })
})
