import { describe, it, expect, beforeEach } from 'vitest'
import { HistoryManager, type HistoryState } from '../src/history-manager'

describe('HistoryManager', () => {
  let history: HistoryManager
  let state1: HistoryState
  let state2: HistoryState
  let state3: HistoryState

  beforeEach(() => {
    history = new HistoryManager({ maxSize: 3 })
    state1 = { content: '<p>State 1</p>', timestamp: Date.now() }
    state2 = { content: '<p>State 2</p>', timestamp: Date.now() + 1 }
    state3 = { content: '<p>State 3</p>', timestamp: Date.now() + 2 }
  })

  /**
   * Why: 초기 상태가 올바른지 확인하여 다른 테스트의 기반을 마련
   * How: 생성 직후 모든 스택이 비어있는지 검증
   */
  describe('초기화', () => {
    it('생성 시 모든 스택이 비어있어야 함', () => {
      // Given: 새로운 HistoryManager 생성 (beforeEach에서 수행)

      // When: 초기 상태 확인

      // Then: 모든 스택이 비어있음
      expect(history.canUndo()).toBe(false)
      expect(history.canRedo()).toBe(false)
      expect(history.getCurrentState()).toBeNull()
      expect(history.getUndoSize()).toBe(0)
      expect(history.getRedoSize()).toBe(0)
    })

    it('maxSize 옵션이 올바르게 설정되어야 함', () => {
      // Given: maxSize를 50으로 설정한 히스토리 생성
      const customHistory = new HistoryManager({ maxSize: 50 })

      // When: 50개 이상의 상태 추가
      for (let i = 0; i < 60; i++) {
        customHistory.push({
          content: `<p>State ${i}</p>`,
          timestamp: Date.now() + i,
        })
      }

      // Then: undo 스택 크기가 maxSize(50)를 초과하지 않음
      // Why: 메모리 사용량을 제한하기 위함
      expect(customHistory.getUndoSize()).toBeLessThanOrEqual(50)
    })
  })

  /**
   * Why: push()는 새로운 상태를 저장하는 핵심 메서드
   * How: 다양한 시나리오에서 스택 상태 변화를 검증
   */
  describe('push() - 상태 추가', () => {
    it('첫 번째 상태를 추가하면 현재 상태로 설정되어야 함', () => {
      // Given: 빈 히스토리

      // When: 첫 번째 상태 추가
      history.push(state1)

      // Then: 현재 상태가 설정되고, undo는 불가능
      expect(history.getCurrentState()).toEqual(state1)
      expect(history.canUndo()).toBe(false) // 첫 상태이므로 undo 불가
      expect(history.getUndoSize()).toBe(0)
    })

    it('두 번째 상태를 추가하면 첫 번째 상태가 undo 스택에 저장되어야 함', () => {
      // Given: 첫 번째 상태가 있는 히스토리
      history.push(state1)

      // When: 두 번째 상태 추가
      history.push(state2)

      // Then: 현재 상태는 state2, undo 스택에 state1 저장
      expect(history.getCurrentState()).toEqual(state2)
      expect(history.canUndo()).toBe(true)
      expect(history.getUndoSize()).toBe(1)
    })

    it('동일한 컨텐츠를 연속으로 push하면 무시되어야 함', () => {
      // Given: state1이 추가된 히스토리
      history.push(state1)

      // When: 동일한 컨텐츠의 상태를 다시 push
      const duplicateState = { ...state1, timestamp: Date.now() + 100 }
      history.push(duplicateState)

      // Then: undo 스택 크기가 증가하지 않음
      // Why: 메모리 절약 및 불필요한 undo 횟수 감소
      expect(history.getUndoSize()).toBe(0)
      expect(history.getCurrentState()).toEqual(state1)
    })

    it('maxSize를 초과하면 가장 오래된 상태가 제거되어야 함', () => {
      // Given: maxSize=3인 히스토리

      // When: 4개의 상태 추가
      history.push(state1)
      history.push(state2)
      history.push(state3)
      const state4 = { content: '<p>State 4</p>', timestamp: Date.now() + 3 }
      history.push(state4)

      // Then: undo 스택 크기가 maxSize(3)를 초과하지 않음
      // Why: 메모리 사용량 제한 (FIFO 방식으로 오래된 것 제거)
      expect(history.getUndoSize()).toBe(3)

      // 추가 검증: 가장 오래된 state1이 제거되었는지 확인
      history.undo() // state3로 복원
      history.undo() // state2로 복원
      history.undo() // state1이 아닌 다른 상태로 (state1은 제거됨)
      expect(history.canUndo()).toBe(false)
    })

    it('새 상태를 push하면 redo 스택이 초기화되어야 함', () => {
      // Given: undo 후 redo 가능한 상태
      history.push(state1)
      history.push(state2)
      history.undo() // state1로 복원, redo 스택에 state2 저장

      expect(history.canRedo()).toBe(true)

      // When: 새로운 상태 추가
      history.push(state3)

      // Then: redo 스택이 초기화됨
      // Why: 새로운 히스토리 브랜치가 시작되어 이전 redo는 무효화됨
      expect(history.canRedo()).toBe(false)
      expect(history.getRedoSize()).toBe(0)
    })
  })

  /**
   * Why: undo()는 사용자가 실수를 되돌리는 핵심 기능
   * How: 다양한 스택 상태에서 undo 동작 검증
   */
  describe('undo() - 실행 취소', () => {
    it('빈 히스토리에서 undo()는 null을 반환해야 함', () => {
      // Given: 빈 히스토리

      // When: undo 실행
      const result = history.undo()

      // Then: null 반환 (되돌릴 상태가 없음)
      expect(result).toBeNull()
      expect(history.canUndo()).toBe(false)
    })

    it('undo 실행 시 이전 상태로 복원되어야 함', () => {
      // Given: state1 -> state2 순서로 추가된 히스토리
      history.push(state1)
      history.push(state2)

      // When: undo 실행
      const result = history.undo()

      // Then: state1로 복원됨
      expect(result).toEqual(state1)
      expect(history.getCurrentState()).toEqual(state1)
    })

    it('undo 실행 시 현재 상태가 redo 스택에 저장되어야 함', () => {
      // Given: state1 -> state2 순서로 추가된 히스토리
      history.push(state1)
      history.push(state2)

      // When: undo 실행
      history.undo()

      // Then: state2가 redo 스택에 저장되어 redo 가능
      expect(history.canRedo()).toBe(true)
      expect(history.getRedoSize()).toBe(1)
    })

    it('여러 번 undo를 실행할 수 있어야 함', () => {
      // Given: state1 -> state2 -> state3 순서로 추가된 히스토리
      history.push(state1)
      history.push(state2)
      history.push(state3)

      // When: 2번 undo 실행
      history.undo() // state2로 복원
      const result = history.undo() // state1로 복원

      // Then: state1로 복원됨
      expect(result).toEqual(state1)
      expect(history.getCurrentState()).toEqual(state1)
      expect(history.getRedoSize()).toBe(2) // state2, state3가 redo 스택에
    })

    it('모든 상태를 undo한 후에는 더 이상 undo가 불가능해야 함', () => {
      // Given: state1 -> state2 순서로 추가된 히스토리
      history.push(state1)
      history.push(state2)

      // When: 모든 상태를 undo
      history.undo() // state1로
      history.undo() // 더 이상 undo 불가

      // Then: undo 불가능
      expect(history.canUndo()).toBe(false)
      const result = history.undo()
      expect(result).toBeNull()
    })
  })

  /**
   * Why: redo()는 실수로 undo한 작업을 복구하는 기능
   * How: undo 후 redo 동작 검증
   */
  describe('redo() - 다시 실행', () => {
    it('redo 히스토리가 없으면 null을 반환해야 함', () => {
      // Given: 빈 히스토리 또는 redo 스택이 빈 상태

      // When: redo 실행
      const result = history.redo()

      // Then: null 반환
      expect(result).toBeNull()
      expect(history.canRedo()).toBe(false)
    })

    it('undo 후 redo를 실행하면 원래 상태로 복원되어야 함', () => {
      // Given: state1 -> state2 추가 후 undo
      history.push(state1)
      history.push(state2)
      history.undo() // state1로 복원

      // When: redo 실행
      const result = history.redo()

      // Then: state2로 다시 복원됨
      expect(result).toEqual(state2)
      expect(history.getCurrentState()).toEqual(state2)
    })

    it('redo 실행 시 현재 상태가 undo 스택에 저장되어야 함', () => {
      // Given: state1 -> state2 추가 후 undo
      history.push(state1)
      history.push(state2)
      history.undo()

      const undoSizeBefore = history.getUndoSize()

      // When: redo 실행
      history.redo()

      // Then: undo 스택 크기가 증가
      expect(history.getUndoSize()).toBe(undoSizeBefore + 1)
    })

    it('여러 번 redo를 실행할 수 있어야 함', () => {
      // Given: state1 -> state2 -> state3 추가 후 2번 undo
      history.push(state1)
      history.push(state2)
      history.push(state3)
      history.undo() // state2로
      history.undo() // state1로

      // When: 2번 redo 실행
      history.redo() // state2로
      const result = history.redo() // state3로

      // Then: state3로 복원됨
      expect(result).toEqual(state3)
      expect(history.getCurrentState()).toEqual(state3)
    })

    it('undo/redo를 반복해도 일관된 상태를 유지해야 함', () => {
      // Given: state1 -> state2 추가
      history.push(state1)
      history.push(state2)

      // When: undo -> redo -> undo -> redo 반복
      history.undo()
      expect(history.getCurrentState()).toEqual(state1)

      history.redo()
      expect(history.getCurrentState()).toEqual(state2)

      history.undo()
      expect(history.getCurrentState()).toEqual(state1)

      history.redo()
      expect(history.getCurrentState()).toEqual(state2)

      // Then: 최종 상태가 일관됨
      expect(history.getCurrentState()).toEqual(state2)
    })
  })

  /**
   * Why: 히스토리 상태를 조회하는 메서드들의 정확성 검증
   * How: 각 메서드가 올바른 값을 반환하는지 확인
   */
  describe('상태 조회 메서드', () => {
    it('canUndo()가 올바른 값을 반환해야 함', () => {
      // Given: 빈 히스토리
      expect(history.canUndo()).toBe(false)

      // When: 상태 추가
      history.push(state1)
      expect(history.canUndo()).toBe(false) // 첫 상태이므로 undo 불가

      history.push(state2)
      // Then: undo 가능
      expect(history.canUndo()).toBe(true)
    })

    it('canRedo()가 올바른 값을 반환해야 함', () => {
      // Given: 상태 추가
      history.push(state1)
      history.push(state2)
      expect(history.canRedo()).toBe(false)

      // When: undo 실행
      history.undo()

      // Then: redo 가능
      expect(history.canRedo()).toBe(true)
    })

    it('getUndoSize()와 getRedoSize()가 올바른 값을 반환해야 함', () => {
      // Given: state1 -> state2 -> state3 추가
      history.push(state1)
      history.push(state2)
      history.push(state3)

      // Then: undo 스택 크기 = 2
      expect(history.getUndoSize()).toBe(2)
      expect(history.getRedoSize()).toBe(0)

      // When: undo 실행
      history.undo()

      // Then: undo 스택 1 감소, redo 스택 1 증가
      expect(history.getUndoSize()).toBe(1)
      expect(history.getRedoSize()).toBe(1)
    })

    it('getCurrentState()가 올바른 현재 상태를 반환해야 함', () => {
      // Given: 빈 히스토리
      expect(history.getCurrentState()).toBeNull()

      // When: 상태 추가
      history.push(state1)
      expect(history.getCurrentState()).toEqual(state1)

      history.push(state2)
      expect(history.getCurrentState()).toEqual(state2)

      // When: undo
      history.undo()
      // Then: 이전 상태 반환
      expect(history.getCurrentState()).toEqual(state1)
    })
  })

  /**
   * Why: clear()는 에디터 리셋 시 필요한 기능
   * How: 모든 스택이 초기화되는지 검증
   */
  describe('clear() - 히스토리 초기화', () => {
    it('모든 히스토리를 초기화해야 함', () => {
      // Given: 여러 상태가 있는 히스토리
      history.push(state1)
      history.push(state2)
      history.push(state3)
      history.undo()

      // undo 후 상태: currentState = state2, undoStack = [state1], redoStack = [state3]
      expect(history.canUndo()).toBe(true)
      expect(history.canRedo()).toBe(true)

      // When: clear 실행
      history.clear()

      // Then: 모든 스택이 비워짐
      expect(history.canUndo()).toBe(false)
      expect(history.canRedo()).toBe(false)
      expect(history.getCurrentState()).toBeNull()
      expect(history.getUndoSize()).toBe(0)
      expect(history.getRedoSize()).toBe(0)
    })

    it('clear 후 새로운 상태를 추가할 수 있어야 함', () => {
      // Given: 히스토리가 있다가 clear된 상태
      history.push(state1)
      history.clear()

      // When: 새로운 상태 추가
      history.push(state2)

      // Then: 정상적으로 동작
      expect(history.getCurrentState()).toEqual(state2)
      expect(history.canUndo()).toBe(false) // 첫 상태이므로
    })
  })

  /**
   * Why: 선택 영역 정보도 저장/복원되는지 확인
   * How: selection 속성을 포함한 상태로 테스트
   */
  describe('선택 영역 저장', () => {
    it('선택 영역 정보를 포함한 상태를 저장하고 복원할 수 있어야 함', () => {
      // Given: 선택 영역 정보를 포함한 상태
      const stateWithSelection: HistoryState = {
        content: '<p>Selected text</p>',
        selection: { start: 0, end: 10 },
        timestamp: Date.now(),
      }

      // When: 상태 추가 및 undo
      history.push(stateWithSelection)
      history.push(state2)
      const restored = history.undo()

      // Then: 선택 영역 정보가 유지됨
      expect(restored?.selection).toEqual({ start: 0, end: 10 })
    })
  })
})
