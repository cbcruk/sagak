import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventBus } from '@/core/event-bus'

describe('EventBus', () => {
  let bus: EventBus

  beforeEach(() => {
    bus = new EventBus()
  })

  /**
   * Why: 이벤트 기반 통신을 위한 핵심 기능 제공
   * How: `on()`으로 구독, `emit()`으로 발행하여 핸들러 실행
   */
  describe('기본 기능 (이벤트 구독과 발행)', () => {
    it('인스턴스를 생성할 수 있어야 함', () => {
      // Given: EventBus 클래스
      // When: 인스턴스 생성
      // Then: EventBus 인스턴스여야 함
      expect(bus).toBeInstanceOf(EventBus)
    })

    it('이벤트를 구독하고 발행할 수 있어야 함', () => {
      // Given: 핸들러 함수
      const handler = vi.fn()

      // When: 이벤트 구독 후 발행
      bus.on('TEST_EVENT', 'on', handler)
      bus.emit('TEST_EVENT')

      // Then: 핸들러가 1번 호출되어야 함
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('핸들러에 인자를 전달할 수 있어야 함', () => {
      // Given: 핸들러가 구독된 상태
      const handler = vi.fn()
      bus.on('TEST_EVENT', 'on', handler)

      // When: 인자와 함께 이벤트 발행
      bus.emit('TEST_EVENT', 'arg1', 'arg2', 123)

      // Then: 핸들러가 인자와 함께 호출되어야 함
      expect(handler).toHaveBeenCalledWith('arg1', 'arg2', 123)
    })

    it('동일한 이벤트에 여러 핸들러를 등록할 수 있어야 함', () => {
      // Given: 두 개의 핸들러
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      // When: 동일 이벤트에 두 핸들러 등록 후 발행
      bus.on('TEST_EVENT', 'on', handler1)
      bus.on('TEST_EVENT', 'on', handler2)
      bus.emit('TEST_EVENT')

      // Then: 모든 핸들러가 호출되어야 함
      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })
  })

  /**
   * Why: 플러그인이 이벤트 전/중/후 시점에 개입할 수 있도록 지원
   * How: before(검증) → on(실행) → after(정리) 3단계로 실행, `false` 반환 시 중단
   */
  describe('이벤트 단계 (3단계 생명주기)', () => {
    it('단계가 순서대로 실행되어야 함: before → on → after', () => {
      // Given: 각 단계에 핸들러 등록
      const calls: string[] = []

      bus.on('TEST_EVENT', 'before', () => {
        calls.push('before')
      })

      bus.on('TEST_EVENT', 'on', () => {
        calls.push('on')
      })

      bus.on('TEST_EVENT', 'after', () => {
        calls.push('after')
      })

      // When: 이벤트 발행
      bus.emit('TEST_EVENT')

      // Then: 순서대로 실행되어야 함
      expect(calls).toEqual(['before', 'on', 'after'])
    })

    it('before 단계에서 false 반환 시 실행을 중단해야 함', () => {
      // Given: 각 단계에 핸들러 등록, before는 false 반환
      const beforeHandler = vi.fn(() => false)
      const onHandler = vi.fn()
      const afterHandler = vi.fn()

      bus.on('TEST_EVENT', 'before', beforeHandler)
      bus.on('TEST_EVENT', 'on', onHandler)
      bus.on('TEST_EVENT', 'after', afterHandler)

      // When: 이벤트 발행
      const result = bus.emit('TEST_EVENT')

      // Then: before만 실행되고 나머지는 중단되어야 함
      expect(beforeHandler).toHaveBeenCalledTimes(1)
      expect(onHandler).not.toHaveBeenCalled()
      expect(afterHandler).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('on 단계에서 false 반환 시 실행을 중단해야 함', () => {
      // Given: 각 단계에 핸들러 등록, on은 false 반환
      const beforeHandler = vi.fn()
      const onHandler = vi.fn(() => false)
      const afterHandler = vi.fn()

      bus.on('TEST_EVENT', 'before', beforeHandler)
      bus.on('TEST_EVENT', 'on', onHandler)
      bus.on('TEST_EVENT', 'after', afterHandler)

      // When: 이벤트 발행
      const result = bus.emit('TEST_EVENT')

      // Then: before와 on만 실행되고 after는 중단되어야 함
      expect(beforeHandler).toHaveBeenCalledTimes(1)
      expect(onHandler).toHaveBeenCalledTimes(1)
      expect(afterHandler).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('after 단계에서 false 반환해도 실행을 계속해야 함', () => {
      // Given: after 핸들러가 false 반환
      const afterHandler = vi.fn(() => false)
      bus.on('TEST_EVENT', 'after', afterHandler)

      // When: 이벤트 발행
      const result = bus.emit('TEST_EVENT')

      // Then: after는 정리 단계이므로 false 반환해도 이벤트는 완료됨
      expect(afterHandler).toHaveBeenCalledTimes(1)
      expect(result).toBe(true)
    })
  })

  /**
   * Why: 메모리 누수 방지 및 핸들러 생명주기 관리
   * How: `unsubscribe()` 함수 반환 또는 `off()` 메서드로 구독 해제
   */
  describe('구독 해제 (리소스 정리)', () => {
    it('반환된 함수로 구독을 해제할 수 있어야 함', () => {
      // Given: 구독된 핸들러
      const handler = vi.fn()
      const unsubscribe = bus.on('TEST_EVENT', 'on', handler)

      // When: 이벤트 발행 후 구독 해제, 다시 발행
      bus.emit('TEST_EVENT')
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()

      bus.emit('TEST_EVENT')

      // Then: 해제 후에는 호출되지 않아야 함
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('off 메서드로 구독을 해제할 수 있어야 함', () => {
      // Given: 구독된 핸들러
      const handler = vi.fn()
      bus.on('TEST_EVENT', 'on', handler)

      // When: 이벤트 발행 후 off로 해제, 다시 발행
      bus.emit('TEST_EVENT')
      expect(handler).toHaveBeenCalledTimes(1)

      bus.off('TEST_EVENT', 'on', handler)

      bus.emit('TEST_EVENT')

      // Then: 해제 후에는 호출되지 않아야 함
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('구독 해제 시 다른 핸들러에 영향을 주지 않아야 함', () => {
      // Given: 동일 이벤트에 두 핸들러 구독
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      const unsubscribe1 = bus.on('TEST_EVENT', 'on', handler1)
      bus.on('TEST_EVENT', 'on', handler2)

      // When: handler1만 구독 해제 후 이벤트 발행
      unsubscribe1()
      bus.emit('TEST_EVENT')

      // Then: handler2만 호출되어야 함
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledTimes(1)
    })
  })

  /**
   * Why: 대량의 핸들러를 효율적으로 정리하여 메모리 관리
   * How: `clear()`로 특정 이벤트 정리, `clearAll()`로 모든 이벤트 정리
   */
  describe('핸들러 정리 (메모리 관리)', () => {
    it('특정 이벤트의 모든 핸들러를 제거할 수 있어야 함', () => {
      // Given: 두 개의 다른 이벤트에 핸들러 등록
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      bus.on('EVENT_1', 'on', handler1)
      bus.on('EVENT_2', 'on', handler2)

      // When: EVENT_1만 정리
      bus.clear('EVENT_1')

      bus.emit('EVENT_1')
      bus.emit('EVENT_2')

      // Then: EVENT_1 핸들러만 제거되어야 함
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('모든 이벤트의 모든 핸들러를 제거할 수 있어야 함', () => {
      // Given: 여러 이벤트에 핸들러 등록
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      bus.on('EVENT_1', 'on', handler1)
      bus.on('EVENT_2', 'on', handler2)

      // When: 모든 핸들러 정리
      bus.clearAll()

      bus.emit('EVENT_1')
      bus.emit('EVENT_2')

      // Then: 모든 핸들러가 제거되어야 함
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })
  })

  /**
   * Why: 등록된 이벤트와 핸들러 상태를 확인하기 위해
   * How: `getEvents()`로 이벤트 목록 조회, `hasHandlers()`로 핸들러 존재 확인
   */
  describe('유틸리티 메서드 (이벤트 조회)', () => {
    it('등록된 모든 이벤트를 가져올 수 있어야 함', () => {
      // Given: 여러 이벤트에 핸들러 등록
      bus.on('EVENT_1', 'on', () => {})
      bus.on('EVENT_2', 'on', () => {})
      bus.on('EVENT_3', 'before', () => {})

      // When: 이벤트 목록 조회
      const events = bus.getEvents()

      // Then: 모든 등록된 이벤트가 반환되어야 함
      expect(events).toContain('EVENT_1')
      expect(events).toContain('EVENT_2')
      expect(events).toContain('EVENT_3')
      expect(events).toHaveLength(3)
    })

    it('이벤트에 핸들러가 있는지 확인할 수 있어야 함', () => {
      // Given: EVENT_1의 on 단계에 핸들러 등록
      bus.on('EVENT_1', 'on', () => {})

      // When: 핸들러 존재 확인
      // Then: 등록된 이벤트와 단계는 true, 나머지는 false
      expect(bus.hasHandlers('EVENT_1')).toBe(true)
      expect(bus.hasHandlers('EVENT_1', 'on')).toBe(true)
      expect(bus.hasHandlers('EVENT_1', 'before')).toBe(false)
      expect(bus.hasHandlers('NON_EXISTENT')).toBe(false)
    })

    it('핸들러 제거 후 hasHandlers가 false를 반환해야 함', () => {
      // Given: 핸들러가 등록된 이벤트
      bus.on('EVENT_1', 'on', () => {})
      expect(bus.hasHandlers('EVENT_1')).toBe(true)

      // When: 핸들러 제거
      bus.clear('EVENT_1')

      // Then: hasHandlers가 false 반환
      expect(bus.hasHandlers('EVENT_1')).toBe(false)
    })
  })

  /**
   * Why: 하나의 핸들러 오류가 전체 이벤트 흐름을 중단하지 않도록 방어
   * How: `try-catch`로 개별 핸들러 에러를 격리하고 로깅 후 계속 실행
   */
  describe('에러 처리 (안정성 보장)', () => {
    it('핸들러에서 에러가 발생해도 실행을 계속해야 함', () => {
      // Given: 에러를 발생시키는 핸들러와 정상 핸들러
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error')
      })
      const normalHandler = vi.fn()

      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      bus.on('TEST_EVENT', 'on', errorHandler)
      bus.on('TEST_EVENT', 'on', normalHandler)

      // When: 이벤트 발행
      const result = bus.emit('TEST_EVENT')

      // Then: 에러 핸들러 이후에도 정상 핸들러가 실행되어야 함
      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect(normalHandler).toHaveBeenCalledTimes(1)
      expect(result).toBe(true)
      expect(consoleError).toHaveBeenCalled()

      consoleError.mockRestore()
    })

    it('존재하지 않는 핸들러 구독 해제를 안전하게 처리해야 함', () => {
      // Given: 등록되지 않은 핸들러
      const handler = vi.fn()

      // When: 존재하지 않는 핸들러 구독 해제
      // Then: 에러 없이 안전하게 처리되어야 함
      expect(() => {
        bus.off('NON_EXISTENT', 'on', handler)
      }).not.toThrow()
    })
  })

  /**
   * Why: 실제 에디터 기능이 EventBus로 올바르게 동작하는지 검증
   * How: Bold, 저장, 다이얼로그 등 실제 워크플로우를 이벤트 체인으로 시뮬레이션
   */
  describe('실제 시나리오 (실무 적용 사례)', () => {
    it('BOLD 기능 워크플로우를 지원해야 함', () => {
      // Given: Bold 기능을 위한 이벤트 체인 설정
      const calls: string[] = []

      // 플러그인이 BOLD_CLICKED 구독
      bus.on('BOLD_CLICKED', 'on', () => {
        calls.push('toggle bold')
        bus.emit('SELECTION_CHANGED')
      })

      // 플러그인이 SELECTION_CHANGED 구독
      bus.on('SELECTION_CHANGED', 'after', () => {
        calls.push('update state')
        bus.emit('BOLD_STATE_CHANGED', { active: true })
      })

      // UI가 BOLD_STATE_CHANGED 구독
      bus.on('BOLD_STATE_CHANGED', 'after', (state) => {
        const active = (state as { active: boolean }).active
        calls.push(`ui update: ${active}`)
      })

      // When: 사용자가 Bold 버튼 클릭
      bus.emit('BOLD_CLICKED')

      // Then: 이벤트 체인이 순서대로 실행되어야 함
      expect(calls).toEqual(['toggle bold', 'update state', 'ui update: true'])
    })

    it('BEFORE 단계에서 검증을 지원해야 함', () => {
      // Given: 저장 가능 여부를 제어하는 플래그
      let canSave = false

      bus.on('SAVE', 'before', () => {
        if (!canSave) return false
      })

      const saveHandler = vi.fn()
      bus.on('SAVE', 'on', saveHandler)

      // When: 첫 번째 저장 시도 (canSave = false)
      let result = bus.emit('SAVE')

      // Then: before 단계에서 취소되어야 함
      expect(result).toBe(false)
      expect(saveHandler).not.toHaveBeenCalled()

      // When: 저장 허용 후 두 번째 시도
      canSave = true
      result = bus.emit('SAVE')

      // Then: 저장이 성공해야 함
      expect(result).toBe(true)
      expect(saveHandler).toHaveBeenCalledTimes(1)
    })

    it('AFTER 단계에서 정리를 지원해야 함', () => {
      // Given: 다이얼로그 닫기 이벤트와 정리 핸들러
      const cleanupHandler = vi.fn()

      bus.on('DIALOG_CLOSE', 'on', () => {
        // 메인 핸들러
      })

      bus.on('DIALOG_CLOSE', 'after', cleanupHandler)

      // When: 다이얼로그 닫기 이벤트 발행
      bus.emit('DIALOG_CLOSE')

      // Then: after 단계에서 정리 핸들러가 실행되어야 함
      expect(cleanupHandler).toHaveBeenCalledTimes(1)
    })
  })
})
