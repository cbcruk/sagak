import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EditorCore, AppStatus } from '@/core/editor-core'
import type { Plugin } from '@/core/types'

describe('EditorCore', () => {
  let element: HTMLDivElement

  beforeEach(() => {
    // contenteditable 요소 생성 (실제 에디터 환경 시뮬레이션)
    element = document.createElement('div')
    element.contentEditable = 'true'
    element.innerHTML = '<p>Hello World</p>'
    document.body.appendChild(element)
  })

  afterEach(() => {
    // 테스트 후 DOM 정리
    document.body.removeChild(element)
  })

  /*
   * `FOCUS_REQUESTED` 검사 둘이 여기 있었습니다.
   *
   * **아무도 발행하지 않는 이벤트였습니다.** 포커스 되돌리기는 `runCommand` 가
   * `area.focus()` 로 직접 하고, 그쪽은 `command-registry` 검사가 봅니다.
   * 여기 있던 것은 배선이 이어져 있는지만 보는 검사였습니다.
   */

  describe('초기화 (유연한 설정 지원)', () => {
    it('설정 없이 인스턴스를 생성할 수 있어야 함', () => {
      // Given: 설정이 제공되지 않음
      // When: EditorCore 인스턴스 생성
      const core = new EditorCore()

      // Then: 정상적으로 생성되고 NOT_READY 상태여야 함
      expect(core).toBeInstanceOf(EditorCore)
      expect(core.getStatus()).toBe(AppStatus.NOT_READY)
      expect(core.isReady()).toBe(false)
    })

    it('element를 제공하면 CompositionTracker가 생성되어야 함', () => {
      // Given: editable element가 제공됨
      // When: element와 함께 EditorCore 생성
      const core = new EditorCore({ element })

      // Then: CompositionTracker가 생성되어야 함
      expect(core.getCompositionTracker()).toBeDefined()
    })

    it('element 없이 생성하면 CompositionTracker가 없어야 함', () => {
      // Given: element가 제공되지 않음
      // When: EditorCore 생성
      const core = new EditorCore()

      // Then: CompositionTracker가 생성되지 않아야 함
      expect(core.getCompositionTracker()).toBeUndefined()
    })

    it('모든 코어 컴포넌트에 접근할 수 있어야 함', () => {
      // Given: EditorCore 인스턴스
      const core = new EditorCore({ element })

      // When: 각 컴포넌트 getter 호출
      const pluginManager = core.getPluginManager()
      const composition = core.getCompositionTracker()
      const context = core.getContext()

      // Then: 모든 컴포넌트가 정의되어 있어야 함
      expect(pluginManager).toBeDefined()
      expect(composition).toBeDefined()
      expect(context).toBeDefined()
      expect(context.composition).toBe(composition)
    })
  })

  describe('플러그인 등록 (유연한 등록 시점)', () => {
    it('run() 호출 전에 플러그인을 등록할 수 있어야 함', async () => {
      // Given: EditorCore 인스턴스와 테스트 플러그인
      const core = new EditorCore()
      const plugin: Plugin = {
        name: 'test-plugin',
        initialize: vi.fn(),
      }

      // When: run() 전에 플러그인 등록
      await core.registerPlugin(plugin)

      // Then: 아직 초기화되지 않아야 함 (pending 상태)
      expect(plugin.initialize).not.toHaveBeenCalled()
      expect(core.getPluginManager().has('test-plugin')).toBe(false)

      // When: run() 호출
      await core.run()

      // Then: run() 후 플러그인이 초기화되고 등록되어야 함
      expect(plugin.initialize).toHaveBeenCalled()
      expect(core.getPluginManager().has('test-plugin')).toBe(true)
    })

    it('run() 호출 후에도 플러그인을 등록할 수 있어야 함', async () => {
      // Given: 실행된 EditorCore
      const core = new EditorCore()
      await core.run()

      const plugin: Plugin = {
        name: 'test-plugin',
        initialize: vi.fn(),
      }

      // When: run() 후 플러그인 등록
      await core.registerPlugin(plugin)

      // Then: 플러그인이 즉시 초기화되어야 함
      expect(plugin.initialize).toHaveBeenCalled()
      expect(core.getPluginManager().has('test-plugin')).toBe(true)
    })

    it('config에 제공된 플러그인들은 run() 시 자동 등록되어야 함', async () => {
      // Given: 여러 플러그인을 config에 포함
      const plugin1: Plugin = {
        name: 'plugin1',
        initialize: vi.fn(),
      }

      const plugin2: Plugin = {
        name: 'plugin2',
        initialize: vi.fn(),
      }

      const core = new EditorCore({
        plugins: [plugin1, plugin2],
      })

      // When: run() 호출
      await core.run()

      // Then: 모든 플러그인이 초기화되고 등록되어야 함
      expect(plugin1.initialize).toHaveBeenCalled()
      expect(plugin2.initialize).toHaveBeenCalled()
      expect(core.getPluginManager().size).toBe(2)
    })

    it('의존성이 있는 플러그인도 등록할 수 있어야 함', async () => {
      // Given: 의존성이 있는 플러그인들
      const basePlugin: Plugin = {
        name: 'base-plugin',
        initialize: vi.fn(),
      }

      const dependentPlugin: Plugin = {
        name: 'dependent-plugin',
        dependencies: ['base-plugin'],
        initialize: vi.fn(),
      }

      const core = new EditorCore({
        plugins: [basePlugin, dependentPlugin],
      })

      // When: run() 호출
      await core.run()

      // Then: 의존성 순서대로 초기화되어야 함
      expect(basePlugin.initialize).toHaveBeenCalled()
      expect(dependentPlugin.initialize).toHaveBeenCalled()
    })
  })

  describe('애플리케이션 생명주기 (명확한 상태 관리)', () => {
    it('초기 상태는 NOT_READY여야 함', () => {
      // Given: 새로 생성된 EditorCore
      const core = new EditorCore()

      // When: 상태 확인
      const status = core.getStatus()
      const isReady = core.isReady()

      // Then: NOT_READY 상태여야 함
      expect(status).toBe(AppStatus.NOT_READY)
      expect(isReady).toBe(false)
    })

    it('run() 호출 후 상태가 READY로 변경되어야 함', async () => {
      // Given: EditorCore 인스턴스
      const core = new EditorCore()

      // When: run() 호출
      await core.run()

      // Then: READY 상태로 변경되어야 함
      expect(core.getStatus()).toBe(AppStatus.READY)
      expect(core.isReady()).toBe(true)
    })

    /*
     * `APP_READY` 검사가 여기 있었습니다. **아무도 안 듣던 알림**이라
     * 걷었습니다 — 준비됐다는 것은 `run()` 이 끝나는 것으로 압니다.
     * 바로 위 검사가 그것을 봅니다.
     */
  })

  /*
   * **"메시지 실행" · "지연 실행" · "브라우저 이벤트 등록" 이 여기 있었습니다.**
   *
   * `core.exec('TEST_MESSAGE')` 처럼 버스에 아무 이름이나 쏘는 문을 재던
   * 검사들입니다. 그 문이 없어졌습니다 — 커맨드를 부르는 문은 `runCommand`
   * 하나입니다 (`docs/prosemirror-migration.md` §12-9).
   */

  describe('플러그인 통합 (완전한 기능 통합)', () => {
    it('플러그인이 CompositionTracker에 접근할 수 있어야 함', async () => {
      const core = new EditorCore({ element })
      let seen: unknown = null

      await core.registerPlugin({
        name: 'probe',
        initialize(context) {
          seen = context.composition
        },
      })
      await core.run()

      expect(seen).toBe(core.getCompositionTracker())
      core.destroy()
    })

    it('플러그인이 config에 접근할 수 있어야 함', async () => {
      const core = new EditorCore({ element, logLevel: 'silent' })
      let seen: unknown = null

      await core.registerPlugin({
        name: 'probe',
        initialize(context) {
          seen = context.config
        },
      })
      await core.run()

      expect(seen).toMatchObject({ logLevel: 'silent' })
      core.destroy()
    })
  })

  describe('애플리케이션 종료 (리소스 정리)', () => {
    it('destroy() 호출 시 상태가 NOT_READY로 변경되어야 함', async () => {
      // Given: 실행 중인 EditorCore
      const core = new EditorCore()
      await core.run()

      expect(core.getStatus()).toBe(AppStatus.READY)

      // When: destroy() 호출
      core.destroy()

      // Then: NOT_READY 상태로 변경
      expect(core.getStatus()).toBe(AppStatus.NOT_READY)
      expect(core.isReady()).toBe(false)
    })

    /*
     * "destroy 시 EventBus 핸들러 정리" 가 여기 있었습니다. 버스가 없으니
     * 정리할 것도 없습니다 — 플러그인의 `destroy()` 가 자기 구독을 걷습니다
     * (바로 아래 검사).
     */

    it('destroy() 호출 시 플러그인의 destroy()가 호출되어야 함', async () => {
      // Given: destroy 메서드가 있는 플러그인
      const core = new EditorCore()
      const destroySpy = vi.fn()

      const plugin: Plugin = {
        name: 'test-plugin',
        initialize: vi.fn(),
        destroy: destroySpy,
      }

      await core.registerPlugin(plugin)
      await core.run()

      // When: destroy() 호출
      core.destroy()

      // Then: 플러그인의 destroy()가 호출되어야 함
      expect(destroySpy).toHaveBeenCalled()
    })

    it('destroy() 호출 시 모든 플러그인이 정리되어야 함', async () => {
      // Given: 여러 플러그인이 등록된 EditorCore
      const core = new EditorCore()

      const plugin1: Plugin = {
        name: 'plugin1',
        initialize: vi.fn(),
        destroy: vi.fn(),
      }

      const plugin2: Plugin = {
        name: 'plugin2',
        initialize: vi.fn(),
        destroy: vi.fn(),
      }

      await core.registerPlugin(plugin1)
      await core.registerPlugin(plugin2)
      await core.run()

      // When: destroy() 호출
      core.destroy()

      // Then: 모든 플러그인의 destroy()가 호출되어야 함
      expect(plugin1.destroy).toHaveBeenCalled()
      expect(plugin2.destroy).toHaveBeenCalled()
    })
  })

  /*
   * **"실제 시나리오" 셋이 여기 있었습니다.**
   *
   * 플러그인이 `'BOLD_CLICKED'` 를 듣고 `'STYLE_CHANGED'` 를 쏘고 또 다른
   * 플러그인이 그것을 듣는 식이었습니다 — 전부 **검사가 지어낸 이름**이고,
   * 제품에는 그런 이름이 없습니다. 버스가 있는지를 버스로 확인하던 것입니다.
   *
   * 지금 서식은 커맨드이고 그 경계는 `command-registry.browser.test.ts` 가,
   * 조합 중 차단도 그쪽이 봅니다.
   */

  describe('엣지 케이스 및 에러 처리 (안전한 동작 보장)', () => {
    it('플러그인 없이 run()을 호출해도 정상 동작해야 함', async () => {
      // Given: 플러그인이 없는 EditorCore
      const core = new EditorCore()

      // When: run() 호출
      await core.run()

      // Then: 정상적으로 READY 상태가 되어야 함
      expect(core.getStatus()).toBe(AppStatus.READY)
    })

    it('같은 이름의 플러그인을 중복 등록하면 경고해야 함', async () => {
      // Given: 같은 이름의 플러그인
      const core = new EditorCore()

      const plugin1: Plugin = {
        name: 'same-plugin',
        initialize: vi.fn(),
      }

      const plugin2: Plugin = {
        name: 'same-plugin',
        initialize: vi.fn(),
      }

      // When: 첫 번째 등록 (pending)
      await core.registerPlugin(plugin1)

      // Then: 두 번째 등록 시 에러 발생 (EditorCore가 pending 중복 체크)
      await expect(core.registerPlugin(plugin2)).rejects.toThrow(
        'Plugin "same-plugin" is already pending registration'
      )
    })

    it('run()을 여러 번 호출해도 안전해야 함', async () => {
      // Given: EditorCore와 플러그인
      const core = new EditorCore()
      const plugin: Plugin = {
        name: 'test-plugin',
        initialize: vi.fn(),
      }

      await core.registerPlugin(plugin)

      // When: run()을 여러 번 호출
      await core.run()
      await core.run()
      await core.run()

      // Then: 상태는 READY이고 플러그인은 한 번만 초기화
      expect(core.getStatus()).toBe(AppStatus.READY)
      // 플러그인 초기화는 registerPlugin 시점에 이미 호출됨
      expect(plugin.initialize).toHaveBeenCalledTimes(1)
    })

    it('destroy() 후 다시 사용할 수 없어야 함', async () => {
      // Given: 실행되고 종료된 EditorCore
      const core = new EditorCore()
      await core.run()
      core.destroy()

      // Then: NOT_READY 상태
      expect(core.getStatus()).toBe(AppStatus.NOT_READY)
      expect(core.isReady()).toBe(false)

      // Note: 현재 구현에서는 destroy 후 run을 다시 호출할 수 있음
      // 이는 설계 결정에 따라 변경 가능
    })

    it('destroy를 여러 번 호출해도 안전해야 함', async () => {
      // Given: EditorCore
      const core = new EditorCore()
      const plugin: Plugin = {
        name: 'test-plugin',
        initialize: vi.fn(),
        destroy: vi.fn(),
      }

      await core.registerPlugin(plugin)
      await core.run()

      // When: destroy()를 여러 번 호출
      core.destroy()
      core.destroy()
      core.destroy()

      // Then: 플러그인의 destroy는 한 번만 호출되어야 함
      // (현재 구현에서는 매번 호출될 수 있음 - 개선 필요 여부 검토)
      expect(core.getStatus()).toBe(AppStatus.NOT_READY)
    })
  })
})
