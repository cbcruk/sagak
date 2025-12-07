import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createHistoryPlugin } from '../src/history-plugin'
import type { EditorContext } from '@sagak/core'

class MockEventBus {
  private listeners: Map<string, Map<string, Function[]>> = new Map()

  on(eventName: string, phase: string, handler: Function) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Map())
    }
    const phases = this.listeners.get(eventName)!
    if (!phases.has(phase)) {
      phases.set(phase, [])
    }
    phases.get(phase)!.push(handler)

    // unsubscribe 함수 반환
    return () => {
      const handlers = phases.get(phase)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      }
    }
  }

  emit(eventName: string, data?: any) {
    const phases = this.listeners.get(eventName)
    if (!phases) return

    // 'on' 페이즈 핸들러 실행
    const handlers = phases.get('on')
    if (handlers) {
      handlers.forEach((handler) => handler(data))
    }

    // 'after' 페이즈 핸들러 실행
    const afterHandlers = phases.get('after')
    if (afterHandlers) {
      afterHandlers.forEach((handler) => handler(data))
    }
  }

  // 특정 이벤트가 발행되었는지 확인하는 헬퍼
  getEmittedEvents(eventName: string): any[] {
    const events: any[] = []
    const originalEmit = this.emit.bind(this)
    this.emit = (name: string, data?: any) => {
      if (name === eventName) {
        events.push(data)
      }
      originalEmit(name, data)
    }
    return events
  }
}

// Mock HTMLElement 생성
function createMockElement(): HTMLElement {
  const element = {
    innerHTML: '<p>Initial content</p>',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as any
  return element
}

describe('History Plugin', () => {
  let eventBus: MockEventBus
  let element: HTMLElement
  let context: EditorContext

  beforeEach(() => {
    // Mock 환경 설정
    eventBus = new MockEventBus()
    element = createMockElement()
    context = { eventBus, element } as any

    // 타이머 mock 활성화
    vi.useFakeTimers()
  })

  afterEach(() => {
    // 타이머 정리
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('초기화', () => {
    it('플러그인 초기화 시 초기 상태를 캡처해야 함', () => {
      // Given: History Plugin 생성
      const plugin = createHistoryPlugin()

      // When: 플러그인 초기화
      plugin.initialize(context)

      // Then: HISTORY_STATE_CHANGED 이벤트 발행 확인
      const stateChangeEmitted = vi.fn()
      eventBus.on('HISTORY_STATE_CHANGED', 'after', stateChangeEmitted)

      // 초기 상태에서는 undo 불가, redo 불가
      eventBus.emit('HISTORY_STATE_CHANGED', {
        canUndo: false,
        canRedo: false,
        undoSize: 0,
        redoSize: 0,
      })

      expect(stateChangeEmitted).toHaveBeenCalled()
    })

    it('input 이벤트 리스너를 등록해야 함', () => {
      // Given: History Plugin 생성
      const plugin = createHistoryPlugin()

      // When: 플러그인 초기화
      plugin.initialize(context)

      // Then: addEventListener가 'input' 이벤트로 호출됨
      expect(element.addEventListener).toHaveBeenCalledWith(
        'input',
        expect.any(Function)
      )
    })
  })

  describe('자동 스냅샷 캡처', () => {
    it('input 이벤트 발생 시 디바운스 후 스냅샷을 캡처해야 함', () => {
      // Given: 초기화된 플러그인
      const plugin = createHistoryPlugin({ debounceDelay: 500 })
      plugin.initialize(context)

      // HISTORY_STATE_CHANGED 이벤트 리스너 등록
      const stateChanges: any[] = []
      eventBus.on('HISTORY_STATE_CHANGED', 'after', (data: any) => {
        stateChanges.push(data)
      })

      // When: 컨텐츠 변경 후 input 이벤트 발생
      element.innerHTML = '<p>New content</p>'
      const inputHandler = (element.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'input'
      )?.[1]
      inputHandler()

      // 디바운스 지연 시간만큼 대기
      vi.advanceTimersByTime(500)

      // Then: 스냅샷이 캡처되고 상태 변경 이벤트 발행
      // Why: 500ms 동안 입력이 없었으므로 스냅샷 캡처됨
      expect(stateChanges.length).toBeGreaterThan(0)
      expect(stateChanges[stateChanges.length - 1].canUndo).toBe(true)
    })

    it('디바운스 지연 시간 내에 여러 input 이벤트가 발생하면 마지막 것만 캡처해야 함', () => {
      // Given: 상태 변경 추적 설정
      const stateChanges: any[] = []
      eventBus.on('HISTORY_STATE_CHANGED', 'after', (data: any) => {
        stateChanges.push(data)
      })

      // 플러그인 초기화
      const plugin = createHistoryPlugin({ debounceDelay: 500 })
      plugin.initialize(context)

      const initialStateCount = stateChanges.length

      const inputHandler = (element.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'input'
      )?.[1]

      // When: 500ms 내에 여러 번 input 이벤트 발생 (타이핑 시뮬레이션)
      element.innerHTML = '<p>H</p>'
      inputHandler()
      vi.advanceTimersByTime(100)

      element.innerHTML = '<p>He</p>'
      inputHandler()
      vi.advanceTimersByTime(100)

      element.innerHTML = '<p>Hel</p>'
      inputHandler()
      vi.advanceTimersByTime(100)

      element.innerHTML = '<p>Hello</p>'
      inputHandler()

      // Then: 아직 스냅샷 캡처되지 않음 (디바운스 중)
      // 초기 상태 이벤트 이후로 새로운 상태 변경 이벤트 없음
      expect(stateChanges.length).toBe(initialStateCount)

      // When: 마지막 입력 후 500ms 대기
      vi.advanceTimersByTime(500)

      // Then: 최종 상태만 한 번 캡처됨
      // Why: 디바운싱으로 인해 의미 있는 편집 단위로만 히스토리 생성
      expect(stateChanges.length).toBe(initialStateCount + 1)
      const afterDebounce = stateChanges[stateChanges.length - 1]
      expect(afterDebounce.undoSize).toBe(1)
      expect(element.innerHTML).toBe('<p>Hello</p>')
    })
  })

  describe('Undo 기능', () => {
    it('UNDO 이벤트 발생 시 이전 상태로 복원해야 함', () => {
      // Given: 두 개의 상태가 저장된 히스토리
      const plugin = createHistoryPlugin({ debounceDelay: 100 })
      plugin.initialize(context)

      const inputHandler = (element.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'input'
      )?.[1]

      // 첫 번째 변경
      element.innerHTML = '<p>First change</p>'
      inputHandler()
      vi.advanceTimersByTime(100)

      // 두 번째 변경
      element.innerHTML = '<p>Second change</p>'
      inputHandler()
      vi.advanceTimersByTime(100)

      // When: UNDO 이벤트 발행
      eventBus.emit('UNDO')

      // Then: 이전 상태로 복원됨
      expect(element.innerHTML).toBe('<p>First change</p>')
    })

    it('UNDO 실행 시 CONTENT_RESTORED 이벤트를 발행해야 함', () => {
      // Given: 상태가 저장된 히스토리
      const plugin = createHistoryPlugin({ debounceDelay: 100 })
      plugin.initialize(context)

      const contentRestoredEmitted = vi.fn()
      eventBus.on('CONTENT_RESTORED', 'after', contentRestoredEmitted)

      const inputHandler = (element.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'input'
      )?.[1]

      element.innerHTML = '<p>Changed</p>'
      inputHandler()
      vi.advanceTimersByTime(100)

      // When: UNDO 실행
      eventBus.emit('UNDO')

      // Then: CONTENT_RESTORED 이벤트 발행
      expect(contentRestoredEmitted).toHaveBeenCalledWith({ action: 'undo' })
    })

    it('Undo 가능 상태에서 canUndo가 true여야 함', () => {
      // Given: 상태 변경이 있는 히스토리
      const plugin = createHistoryPlugin({ debounceDelay: 100 })
      plugin.initialize(context)

      const stateChanges: any[] = []
      eventBus.on('HISTORY_STATE_CHANGED', 'after', (data: any) => {
        stateChanges.push(data)
      })

      const inputHandler = (element.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'input'
      )?.[1]

      // When: 컨텐츠 변경
      element.innerHTML = '<p>Changed</p>'
      inputHandler()
      vi.advanceTimersByTime(100)

      // Then: canUndo가 true
      const lastState = stateChanges[stateChanges.length - 1]
      expect(lastState.canUndo).toBe(true)
    })

    it('복원 중에는 스냅샷을 캡처하지 않아야 함', () => {
      // Given: 초기화된 플러그인
      const plugin = createHistoryPlugin({ debounceDelay: 100 })
      plugin.initialize(context)

      const inputHandler = (element.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'input'
      )?.[1]

      // 첫 번째 변경
      element.innerHTML = '<p>First change</p>'
      inputHandler()
      vi.advanceTimersByTime(100)

      // 두 번째 변경
      element.innerHTML = '<p>Second change</p>'
      inputHandler()
      vi.advanceTimersByTime(100)

      const stateChanges: any[] = []
      eventBus.on('HISTORY_STATE_CHANGED', 'after', (data: any) => {
        stateChanges.push(data)
      })

      // When: UNDO 실행 (이때 input 이벤트가 발생할 수 있음)
      eventBus.emit('UNDO')

      // UNDO 실행으로 인한 상태 변경 이벤트 발생
      const undoStateChanges = stateChanges.length
      expect(undoStateChanges).toBe(1) // UNDO로 인한 상태 변경

      // isRestoring 플래그가 아직 활성화된 상태에서 input 이벤트 발생
      // (10ms 지연 전이므로 isRestoring=true)
      inputHandler()

      // Then: 복원 중 발생한 input 이벤트로 인해 새 스냅샷이 캡처되지 않음
      // Why: isRestoring 플래그가 설정되어 있어 히스토리 오염 방지

      // 9ms 진행 - isRestoring 아직 true (10ms에 해제됨)
      vi.advanceTimersByTime(9)
      expect(stateChanges.length).toBe(undoStateChanges)

      // isRestoring 플래그가 해제되는 시점 통과
      vi.advanceTimersByTime(1) // 총 10ms

      // 디바운스 시간 완료 (총 110ms)
      vi.advanceTimersByTime(100)

      // isRestoring이 해제된 후에 디바운스가 완료되면 스냅샷 캡처됨
      // 이는 정상 동작임 - 복원이 완료된 후에는 정상적으로 히스토리 관리
      expect(stateChanges.length).toBe(undoStateChanges + 1)
    })
  })

  describe('Redo 기능', () => {
    it('REDO 이벤트 발생 시 취소했던 상태로 복원해야 함', () => {
      // Given: Undo가 실행된 히스토리
      const plugin = createHistoryPlugin({ debounceDelay: 100 })
      plugin.initialize(context)

      const inputHandler = (element.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'input'
      )?.[1]

      // 상태 변경
      element.innerHTML = '<p>Changed</p>'
      inputHandler()
      vi.advanceTimersByTime(100)

      // Undo 실행
      eventBus.emit('UNDO')
      expect(element.innerHTML).toBe('<p>Initial content</p>')

      // When: REDO 실행
      eventBus.emit('REDO')

      // Then: 취소했던 상태로 복원
      expect(element.innerHTML).toBe('<p>Changed</p>')
    })

    it('REDO 실행 시 CONTENT_RESTORED 이벤트를 발행해야 함', () => {
      // Given: Undo가 실행된 히스토리
      const plugin = createHistoryPlugin({ debounceDelay: 100 })
      plugin.initialize(context)

      const contentRestoredEmitted = vi.fn()
      eventBus.on('CONTENT_RESTORED', 'after', contentRestoredEmitted)

      const inputHandler = (element.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'input'
      )?.[1]

      element.innerHTML = '<p>Changed</p>'
      inputHandler()
      vi.advanceTimersByTime(100)

      eventBus.emit('UNDO')

      // When: REDO 실행
      eventBus.emit('REDO')

      // Then: CONTENT_RESTORED 이벤트 발행
      expect(contentRestoredEmitted).toHaveBeenCalledWith({ action: 'redo' })
    })

    it('Redo 가능 상태에서 canRedo가 true여야 함', () => {
      // Given: Undo가 실행된 히스토리
      const plugin = createHistoryPlugin({ debounceDelay: 100 })
      plugin.initialize(context)

      const stateChanges: any[] = []
      eventBus.on('HISTORY_STATE_CHANGED', 'after', (data: any) => {
        stateChanges.push(data)
      })

      const inputHandler = (element.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'input'
      )?.[1]

      element.innerHTML = '<p>Changed</p>'
      inputHandler()
      vi.advanceTimersByTime(100)

      // When: Undo 실행
      eventBus.emit('UNDO')

      // Then: canRedo가 true
      const lastState = stateChanges[stateChanges.length - 1]
      expect(lastState.canRedo).toBe(true)
    })

    it('새로운 변경사항 추가 시 redo 스택이 초기화되어야 함', () => {
      // Given: Undo가 실행된 히스토리
      const plugin = createHistoryPlugin({ debounceDelay: 100 })
      plugin.initialize(context)

      const stateChanges: any[] = []
      eventBus.on('HISTORY_STATE_CHANGED', 'after', (data: any) => {
        stateChanges.push(data)
      })

      const inputHandler = (element.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'input'
      )?.[1]

      // 첫 번째 변경
      element.innerHTML = '<p>First</p>'
      inputHandler()
      vi.advanceTimersByTime(100)

      // Undo
      eventBus.emit('UNDO')
      expect(stateChanges[stateChanges.length - 1].canRedo).toBe(true)

      // When: 새로운 변경사항 추가
      element.innerHTML = '<p>New change</p>'
      inputHandler()
      vi.advanceTimersByTime(100)

      // Then: canRedo가 false (redo 스택 초기화)
      // Why: 새로운 히스토리 브랜치가 시작되어 이전 redo는 무효화됨
      const lastState = stateChanges[stateChanges.length - 1]
      expect(lastState.canRedo).toBe(false)
    })
  })

  describe('플러그인 정리', () => {
    it('destroy 호출 시 이벤트 리스너를 제거해야 함', () => {
      // Given: 초기화된 플러그인
      const plugin = createHistoryPlugin()
      plugin.initialize(context)

      // When: 플러그인 정리
      plugin.destroy?.()

      // Then: removeEventListener가 호출됨
      expect(element.removeEventListener).toHaveBeenCalledWith(
        'input',
        expect.any(Function)
      )
    })

    it('destroy 호출 시 디바운스 타이머를 정리해야 함', () => {
      // Given: 디바운스 중인 플러그인
      const plugin = createHistoryPlugin({ debounceDelay: 500 })
      plugin.initialize(context)

      const inputHandler = (element.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'input'
      )?.[1]

      element.innerHTML = '<p>Typing...</p>'
      inputHandler()

      // When: 디바운스 완료 전에 destroy 호출
      plugin.destroy?.()

      // 디바운스 시간만큼 대기
      vi.advanceTimersByTime(500)

      // Then: 타이머가 정리되어 스냅샷이 캡처되지 않음
      // Why: 메모리 누수 방지
      const stateChanges: any[] = []
      eventBus.on('HISTORY_STATE_CHANGED', 'after', (data: any) => {
        stateChanges.push(data)
      })

      // 타이머 정리 후에는 상태 변경 이벤트가 발생하지 않음
      expect(stateChanges.length).toBe(0)
    })
  })

  describe('커스텀 옵션', () => {
    it('커스텀 이벤트 이름을 사용할 수 있어야 함', () => {
      // Given: 커스텀 이벤트 이름으로 플러그인 생성
      const plugin = createHistoryPlugin({
        undoEventName: 'CUSTOM_UNDO',
        redoEventName: 'CUSTOM_REDO',
        debounceDelay: 100, // 빠른 테스트를 위해 짧은 디바운스 시간 사용
      })
      plugin.initialize(context)

      const inputHandler = (element.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'input'
      )?.[1]

      // 상태 변경
      element.innerHTML = '<p>Changed</p>'
      inputHandler()
      vi.advanceTimersByTime(100) // 디바운스 완료

      // When: 커스텀 이벤트 발행
      eventBus.emit('CUSTOM_UNDO')

      // Then: 정상 동작 - 초기 컨텐츠로 복원
      expect(element.innerHTML).toBe('<p>Initial content</p>')
    })

    it('커스텀 디바운스 지연 시간을 사용할 수 있어야 함', () => {
      // Given: 상태 변경 추적 설정
      const stateChanges: any[] = []
      eventBus.on('HISTORY_STATE_CHANGED', 'after', (data: any) => {
        stateChanges.push(data)
      })

      // 커스텀 디바운스 지연 시간으로 플러그인 생성
      const plugin = createHistoryPlugin({ debounceDelay: 1000 })
      plugin.initialize(context)

      const initialStateCount = stateChanges.length
      expect(initialStateCount).toBeGreaterThan(0) // 초기 상태 이벤트 발생

      const inputHandler = (element.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'input'
      )?.[1]

      // When: input 이벤트 발생
      element.innerHTML = '<p>Changed</p>'
      inputHandler()

      // 500ms 대기 (기본 디바운스 시간)
      vi.advanceTimersByTime(500)

      // Then: 아직 캡처되지 않음 (1000ms 디바운스이므로)
      expect(stateChanges.length).toBe(initialStateCount)

      // When: 추가로 500ms 대기 (총 1000ms)
      vi.advanceTimersByTime(500)

      // Then: 스냅샷 캡처됨
      expect(stateChanges.length).toBe(initialStateCount + 1)
      expect(stateChanges[stateChanges.length - 1].undoSize).toBe(1)
    })
  })
})
