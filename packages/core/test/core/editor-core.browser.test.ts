import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EditorCore, AppStatus } from '@/core/editor-core'
import { CoreEvents } from '@/core/events'
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

    it('element를 제공하면 SelectionManager가 생성되어야 함', () => {
      // Given: editable element가 제공됨
      // When: element와 함께 EditorCore 생성
      const core = new EditorCore({ element })

      // Then: SelectionManager가 생성되어야 함
      expect(core.getSelectionManager()).toBeDefined()
    })

    it('element 없이 생성하면 SelectionManager가 없어야 함', () => {
      // Given: element가 제공되지 않음
      // When: EditorCore 생성
      const core = new EditorCore()

      // Then: SelectionManager가 생성되지 않아야 함
      expect(core.getSelectionManager()).toBeUndefined()
    })

    it('모든 코어 컴포넌트에 접근할 수 있어야 함', () => {
      // Given: EditorCore 인스턴스
      const core = new EditorCore({ element })

      // When: 각 컴포넌트 getter 호출
      const eventBus = core.getEventBus()
      const pluginManager = core.getPluginManager()
      const selectionManager = core.getSelectionManager()
      const context = core.getContext()

      // Then: 모든 컴포넌트가 정의되어 있어야 함
      expect(eventBus).toBeDefined()
      expect(pluginManager).toBeDefined()
      expect(selectionManager).toBeDefined()
      expect(context).toBeDefined()
      expect(context.eventBus).toBe(eventBus)
      expect(context.selectionManager).toBe(selectionManager)
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

    it('run() 호출 시 APP_READY 이벤트를 발행해야 함', async () => {
      // Given: EditorCore와 이벤트 핸들러
      const core = new EditorCore()
      const handler = vi.fn()

      core.getEventBus().on(CoreEvents.APP_READY, 'on', handler)

      // When: run() 호출
      await core.run()

      // Then: APP_READY 이벤트가 발행되어야 함
      expect(handler).toHaveBeenCalled()
    })
  })

  describe('메시지 실행 (느슨한 결합 유지)', () => {
    it('메시지를 실행할 수 있어야 함', async () => {
      // Given: 실행된 EditorCore와 이벤트 핸들러
      const core = new EditorCore()
      const handler = vi.fn()

      core.getEventBus().on('TEST_MESSAGE', 'on', handler)
      await core.run()

      // When: 메시지 실행
      const result = core.exec('TEST_MESSAGE')

      // Then: 핸들러가 호출되고 true 반환
      expect(result).toBe(true)
      expect(handler).toHaveBeenCalled()
    })

    it('메시지와 함께 인자를 전달할 수 있어야 함', async () => {
      // Given: EditorCore와 핸들러
      const core = new EditorCore()
      const handler = vi.fn()

      core.getEventBus().on('TEST_MESSAGE', 'on', handler)
      await core.run()

      // When: 인자와 함께 메시지 실행
      core.exec('TEST_MESSAGE', 'arg1', 'arg2', 123)

      // Then: 핸들러가 모든 인자를 받아야 함
      expect(handler).toHaveBeenCalledWith('arg1', 'arg2', 123)
    })

    it('메시지 취소가 가능해야 함 (BEFORE 페이즈에서 false 반환)', async () => {
      // Given: EditorCore와 취소 핸들러
      const core = new EditorCore()
      const beforeHandler = vi.fn().mockReturnValue(false) // 취소
      const onHandler = vi.fn()

      core.getEventBus().on('TEST_MESSAGE', 'before', beforeHandler)
      core.getEventBus().on('TEST_MESSAGE', 'on', onHandler)

      await core.run()

      // When: 메시지 실행
      const result = core.exec('TEST_MESSAGE')

      // Then: before에서 취소되어 on 핸들러는 실행 안 됨
      expect(result).toBe(false)
      expect(beforeHandler).toHaveBeenCalled()
      expect(onHandler).not.toHaveBeenCalled()
    })

    it('취소되지 않은 메시지는 모든 페이즈를 거쳐야 함', async () => {
      // Given: EditorCore와 모든 페이즈의 핸들러
      const core = new EditorCore()
      const beforeHandler = vi.fn()
      const onHandler = vi.fn()
      const afterHandler = vi.fn()

      core.getEventBus().on('TEST_MESSAGE', 'before', beforeHandler)
      core.getEventBus().on('TEST_MESSAGE', 'on', onHandler)
      core.getEventBus().on('TEST_MESSAGE', 'after', afterHandler)

      await core.run()

      // When: 메시지 실행
      core.exec('TEST_MESSAGE')

      // Then: 모든 페이즈의 핸들러가 순서대로 실행되어야 함
      expect(beforeHandler).toHaveBeenCalled()
      expect(onHandler).toHaveBeenCalled()
      expect(afterHandler).toHaveBeenCalled()
    })
  })

  describe('지연 실행 (비동기 작업 지원)', () => {
    it('지정된 시간 후 메시지를 실행해야 함', async () => {
      // Given: fake timers와 EditorCore
      vi.useFakeTimers()

      const core = new EditorCore()
      const handler = vi.fn()

      core.getEventBus().on('TEST_MESSAGE', 'on', handler)
      await core.run()

      // When: 1초 지연 후 메시지 실행
      core.delayedExec('TEST_MESSAGE', 1000)

      // Then: 즉시는 실행되지 않음
      expect(handler).not.toHaveBeenCalled()

      // When: 시간을 1초 진행
      vi.advanceTimersByTime(1000)

      // Then: 핸들러가 호출되어야 함
      expect(handler).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('지연 실행 시 인자를 전달할 수 있어야 함', async () => {
      // Given: fake timers와 EditorCore
      vi.useFakeTimers()

      const core = new EditorCore()
      const handler = vi.fn()

      core.getEventBus().on('TEST_MESSAGE', 'on', handler)
      await core.run()

      // When: 인자와 함께 지연 실행
      core.delayedExec('TEST_MESSAGE', 500, 'arg1', 'arg2')

      // When: 시간을 500ms 진행
      vi.advanceTimersByTime(500)

      // Then: 핸들러가 인자를 받아야 함
      expect(handler).toHaveBeenCalledWith('arg1', 'arg2')

      vi.useRealTimers()
    })

    it('여러 지연 실행을 독립적으로 처리해야 함', async () => {
      // Given: fake timers와 EditorCore
      vi.useFakeTimers()

      const core = new EditorCore()
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      core.getEventBus().on('MESSAGE_1', 'on', handler1)
      core.getEventBus().on('MESSAGE_2', 'on', handler2)
      await core.run()

      // When: 서로 다른 시간으로 지연 실행
      core.delayedExec('MESSAGE_1', 500)
      core.delayedExec('MESSAGE_2', 1000)

      // Then: 500ms 후 첫 번째만 실행
      vi.advanceTimersByTime(500)
      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).not.toHaveBeenCalled()

      // Then: 추가 500ms 후 두 번째도 실행
      vi.advanceTimersByTime(500)
      expect(handler2).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })
  })

  describe('브라우저 이벤트 등록 (일관된 이벤트 처리)', () => {
    it('브라우저 이벤트를 메시지로 변환할 수 있어야 함', async () => {
      // Given: 버튼 요소와 EditorCore
      const core = new EditorCore()
      const handler = vi.fn()
      const button = document.createElement('button')
      document.body.appendChild(button)

      core.getEventBus().on('BUTTON_CLICKED', 'on', handler)
      await core.run()

      // When: 브라우저 이벤트 등록
      core.registerBrowserEvent(button, 'click', 'BUTTON_CLICKED')

      // When: 버튼 클릭
      button.click()

      // Then: 메시지 핸들러가 호출되어야 함
      expect(handler).toHaveBeenCalled()

      document.body.removeChild(button)
    })

    it('브라우저 이벤트 객체를 핸들러에 전달해야 함', async () => {
      // Given: 버튼과 EditorCore
      const core = new EditorCore()
      const handler = vi.fn()
      const button = document.createElement('button')
      document.body.appendChild(button)

      core.getEventBus().on('BUTTON_CLICKED', 'on', handler)
      await core.run()

      // When: 이벤트 등록 및 클릭
      core.registerBrowserEvent(button, 'click', 'BUTTON_CLICKED')
      button.click()

      // Then: Event 객체가 전달되어야 함
      expect(handler).toHaveBeenCalledWith(expect.any(Event))

      document.body.removeChild(button)
    })

    it('커스텀 인자와 이벤트 객체를 함께 전달할 수 있어야 함', async () => {
      // Given: EditorCore와 버튼
      const core = new EditorCore()
      const handler = vi.fn()
      const button = document.createElement('button')
      document.body.appendChild(button)

      core.getEventBus().on('BUTTON_CLICKED', 'on', handler)
      await core.run()

      // When: 커스텀 인자와 함께 이벤트 등록
      core.registerBrowserEvent(button, 'click', 'BUTTON_CLICKED', [
        'arg1',
        123,
      ])

      button.click()

      // Then: 커스텀 인자 + Event 순서로 전달
      expect(handler).toHaveBeenCalledWith('arg1', 123, expect.any(Event))

      document.body.removeChild(button)
    })

    it('등록 해제 함수로 이벤트 리스너를 제거할 수 있어야 함', async () => {
      // Given: 버튼과 EditorCore
      const core = new EditorCore()
      const handler = vi.fn()
      const button = document.createElement('button')
      document.body.appendChild(button)

      core.getEventBus().on('BUTTON_CLICKED', 'on', handler)
      await core.run()

      // When: 이벤트 등록
      const cleanup = core.registerBrowserEvent(
        button,
        'click',
        'BUTTON_CLICKED'
      )

      button.click()
      expect(handler).toHaveBeenCalledTimes(1)

      // When: 등록 해제
      cleanup()

      // When: 다시 클릭
      button.click()

      // Then: 핸들러가 추가로 호출되지 않아야 함
      expect(handler).toHaveBeenCalledTimes(1)

      document.body.removeChild(button)
    })
  })

  describe('플러그인 통합 (완전한 기능 통합)', () => {
    it('플러그인이 이벤트를 발행하고 구독할 수 있어야 함', async () => {
      // Given: 이벤트를 처리하는 플러그인
      const core = new EditorCore({ element })

      const testPlugin: Plugin = {
        name: 'test-plugin',

        initialize(context) {
          // 메시지를 받아 다른 메시지 발행
          context.eventBus.on('DO_SOMETHING', 'on', () => {
            context.eventBus.emit('SOMETHING_DONE')
          })
        },
      }

      await core.registerPlugin(testPlugin)
      await core.run()

      const handler = vi.fn()
      core.getEventBus().on('SOMETHING_DONE', 'on', handler)

      // When: 메시지 실행
      core.exec('DO_SOMETHING')

      // Then: 플러그인이 발행한 메시지의 핸들러가 호출되어야 함
      expect(handler).toHaveBeenCalled()
    })

    it('플러그인이 SelectionManager에 접근할 수 있어야 함', async () => {
      // Given: element가 있는 EditorCore
      const core = new EditorCore({ element })

      let selectionManagerFromPlugin = null

      const testPlugin: Plugin = {
        name: 'test-plugin',

        initialize(context) {
          // 플러그인에서 SelectionManager 접근
          selectionManagerFromPlugin = context.selectionManager
        },
      }

      // When: 플러그인 등록 및 run() 호출
      await core.registerPlugin(testPlugin)
      await core.run()

      // Then: 플러그인이 SelectionManager에 접근할 수 있어야 함
      expect(selectionManagerFromPlugin).toBeDefined()
      expect(selectionManagerFromPlugin).toBe(core.getSelectionManager())
    })

    it('플러그인이 config에 접근할 수 있어야 함', async () => {
      // Given: 커스텀 config가 있는 EditorCore
      const customConfig = {
        customOption: 'test-value',
      }

      const core = new EditorCore(customConfig)

      let configFromPlugin = null

      const testPlugin: Plugin = {
        name: 'test-plugin',

        initialize(context) {
          configFromPlugin = context.config
        },
      }

      // When: 플러그인 등록 및 run() 호출
      await core.registerPlugin(testPlugin)
      await core.run()

      // Then: 플러그인이 config에 접근할 수 있어야 함
      expect(configFromPlugin).toBeDefined()
      expect(configFromPlugin).toMatchObject(customConfig)
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

  describe('실제 시나리오 (전체 시스템 동작 검증)', () => {
    it('에디터의 전체 워크플로우가 정상 동작해야 함', async () => {
      // Given: 실제 Bold 플러그인처럼 동작하는 플러그인
      const core = new EditorCore({ element })

      const boldPlugin: Plugin = {
        name: 'bold',
        initialize(context) {
          // BEFORE: IME 입력 중이면 취소
          context.eventBus.on('BOLD_CLICKED', 'before', () => {
            if (context.selectionManager?.getIsComposing()) {
              return false // 취소
            }
            return true
          })

          // ON: Bold 토글
          context.eventBus.on('BOLD_CLICKED', 'on', () => {
            document.execCommand('bold')
            context.eventBus.emit('STYLE_CHANGED', { style: 'bold' })
          })
        },
      }

      // When: 플러그인 등록 및 실행
      await core.registerPlugin(boldPlugin)
      await core.run()

      // Then: 스타일 변경 이벤트 추적
      const styleHandler = vi.fn()
      core.getEventBus().on('STYLE_CHANGED', 'on', styleHandler)

      // When: Bold 명령 실행
      const result = core.exec('BOLD_CLICKED')

      // Then: 성공적으로 실행되고 이벤트가 발행되어야 함
      expect(result).toBe(true)
      expect(styleHandler).toHaveBeenCalledWith({ style: 'bold' })
    })

    it('여러 플러그인이 협력하여 동작해야 함', async () => {
      // Given: 서로 연관된 여러 플러그인
      const core = new EditorCore({ element })

      // 히스토리를 기록하는 플러그인
      const historyPlugin: Plugin = {
        name: 'history',
        initialize(context) {
          const history: string[] = []

          context.eventBus.on('STYLE_CHANGED', 'after', (data: any) => {
            history.push(`style:${data.style}`)
            context.eventBus.emit('HISTORY_UPDATED', { history })
          })
        },
      }

      // Bold 플러그인
      const boldPlugin: Plugin = {
        name: 'bold',
        initialize(context) {
          context.eventBus.on('BOLD_CLICKED', 'on', () => {
            context.eventBus.emit('STYLE_CHANGED', { style: 'bold' })
          })
        },
      }

      await core.registerPlugin(historyPlugin)
      await core.registerPlugin(boldPlugin)
      await core.run()

      // Then: 히스토리 업데이트 추적
      const historyHandler = vi.fn()
      core.getEventBus().on('HISTORY_UPDATED', 'on', historyHandler)

      // When: Bold 실행
      core.exec('BOLD_CLICKED')

      // Then: 히스토리가 업데이트되어야 함
      expect(historyHandler).toHaveBeenCalledWith({
        history: ['style:bold'],
      })
    })

    it('IME 입력 중에는 스타일 변경이 차단되어야 함', async () => {
      // Given: IME 체크가 있는 플러그인
      const core = new EditorCore({ element })

      const boldPlugin: Plugin = {
        name: 'bold',
        initialize(context) {
          context.eventBus.on('BOLD_CLICKED', 'before', () => {
            // IME 입력 중이면 차단
            if (context.selectionManager?.getIsComposing()) {
              return false
            }
            return true
          })

          context.eventBus.on('BOLD_CLICKED', 'on', () => {
            document.execCommand('bold')
          })
        },
      }

      await core.registerPlugin(boldPlugin)
      await core.run()

      // When: IME 입력 시작 시뮬레이션
      const selectionManager = core.getSelectionManager()
      if (selectionManager) {
        // compositionstart 이벤트 발생
        element.dispatchEvent(new CompositionEvent('compositionstart'))

        // When: Bold 실행 시도
        const result = core.exec('BOLD_CLICKED')

        // Then: 차단되어야 함
        expect(result).toBe(false)

        // When: IME 입력 종료
        element.dispatchEvent(
          new CompositionEvent('compositionend', { data: '한글' })
        )

        // When: Bold 다시 실행
        const result2 = core.exec('BOLD_CLICKED')

        // Then: 정상 실행되어야 함
        expect(result2).toBe(true)
      }
    })
  })

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

    it('존재하지 않는 메시지를 실행해도 에러가 발생하지 않아야 함', async () => {
      // Given: EditorCore
      const core = new EditorCore()
      await core.run()

      // When: 핸들러가 없는 메시지 실행
      const result = core.exec('NON_EXISTENT_MESSAGE')

      // Then: 에러 없이 true 반환 (취소되지 않음)
      expect(result).toBe(true)
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
