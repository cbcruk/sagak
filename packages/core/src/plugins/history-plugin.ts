import type { Plugin, EditorContext } from '@/core'
import { HistoryEvents, CoreEvents } from '@/core'
import { HistoryManager } from '@/core'

/**
 * 히스토리 플러그인 옵션 인터페이스
 *
 * @property undoEventName - Undo 이벤트 이름 (기본값: `'UNDO'`)
 * @property redoEventName - Redo 이벤트 이름 (기본값: `'REDO'`)
 * @property stateChangeEventName - 히스토리 상태 변경 이벤트 이름 (기본값: `'HISTORY_STATE_CHANGED'`)
 * @property maxHistorySize - 최대 히스토리 크기 (기본값: `100`)
 * @property debounceDelay - 스냅샷 캡처 디바운스 지연 시간(ms) (기본값: `500`)
 */
export interface HistoryPluginOptions {
  undoEventName?: string
  redoEventName?: string
  stateChangeEventName?: string
  maxHistorySize?: number
  debounceDelay?: number
}

/**
 * 히스토리 플러그인 생성 함수
 *
 * Undo/Redo 기능을 제공하는 플러그인을 생성합니다.
 * 자동 스냅샷 캡처 및 이벤트 기반 히스토리 관리를 제공합니다.
 *
 * @param options - 플러그인 옵션
 * @returns `Plugin` 인스턴스
 *
 * @example
 * ```typescript
 * const historyPlugin = createHistoryPlugin({
 *   undoEventName: 'UNDO',
 *   redoEventName: 'REDO',
 *   maxHistorySize: 50
 * });
 * ```
 */
export function createHistoryPlugin(
  options: HistoryPluginOptions = {}
): Plugin {
  const {
    undoEventName = HistoryEvents.UNDO,
    redoEventName = HistoryEvents.REDO,
    maxHistorySize = 100,
    debounceDelay = 500,
  } = options

  const unsubscribers: Array<() => void> = []
  let historyManager: HistoryManager
  let debounceTimer: number | null = null
  let isRestoring = false

  return {
    name: 'editing:history',

    /**
     * 플러그인 초기화
     *
     * **동작 과정:**
     * 1. `HistoryManager` 인스턴스 생성
     * 2. 초기 상태 캡처 및 이벤트 발행
     * 3. `input` 이벤트 리스너 등록 (자동 스냅샷 캡처)
     * 4. Undo/Redo 이벤트 핸들러 등록
     *
     * @param context - 에디터 컨텍스트
     */
    initialize(context: EditorContext) {
      const { eventBus } = context
      const element = context.element as HTMLElement

      historyManager = new HistoryManager({ maxSize: maxHistorySize })

      captureSnapshot(element)
      emitStateChange(eventBus)

      /**
       * 현재 에디터 상태의 스냅샷 캡처
       *
       * 복원 중(`isRestoring`)일 때는 캡처하지 않습니다.
       * 복원 중에 캡처하지 않는 이유: Undo/Redo 시 발생하는 `input` 이벤트로 인한 히스토리 오염 방지
       *
       * @param el - 에디터 요소
       */
      function captureSnapshot(el: HTMLElement) {
        if (isRestoring) return

        const content = el.innerHTML

        historyManager.push({
          content,
          timestamp: Date.now(),
        })

        emitStateChange(eventBus)
      }

      /**
       * 히스토리 상태 변경 이벤트 발행
       *
       * UI 컴포넌트가 이 이벤트를 구독하여 `undo`/`redo` 버튼의
       * 활성화/비활성화 상태를 업데이트합니다.
       *
       * @param bus - 이벤트 버스
       */
      function emitStateChange(bus: any) {
        bus.emit(HistoryEvents.HISTORY_STATE_CHANGED, {
          canUndo: historyManager.canUndo(),
          canRedo: historyManager.canRedo(),
          undoSize: historyManager.getUndoSize(),
          redoSize: historyManager.getRedoSize(),
        })
      }

      /**
       * 디바운스된 스냅샷 캡처
       *
       * **디바운싱이 필요한 이유:**
       * 사용자가 타이핑할 때마다 스냅샷을 저장하면:
       * - 성능 저하: 매 키 입력마다 `innerHTML` 복사 및 저장
       * - 메모리 낭비: 수백 개의 중간 상태가 저장됨
       * - 나쁜 UX: `Undo` 시 한 글자씩만 되돌려짐
       *
       * **디바운싱 동작 방식:**
       * 1. 타이핑 시작 → 타이머 시작
       * 2. 500ms 이내에 다시 타이핑 → 타이머 리셋
       * 3. 500ms 동안 입력 없음 → 스냅샷 캡처
       *
       * 결과: 의미 있는 편집 단위로만 히스토리가 생성됨
       */
      function debouncedCapture() {
        if (debounceTimer !== null) {
          clearTimeout(debounceTimer)
        }

        debounceTimer = window.setTimeout(() => {
          captureSnapshot(element)
          debounceTimer = null
        }, debounceDelay)
      }

      /**
       * `input` 이벤트 핸들러
       *
       * 사용자가 에디터 컨텐츠를 변경할 때마다 호출됩니다.
       * 디바운싱을 통해 적절한 시점에만 스냅샷을 캡처합니다.
       */
      const handleInput = () => {
        debouncedCapture()
      }

      element.addEventListener('input', handleInput)

      unsubscribers.push(() => {
        element.removeEventListener('input', handleInput)
      })

      /**
       * 스냅샷 캡처 요청 핸들러
       *
       * 스타일 명령(Bold, Italic 등) 실행 전에 플러그인들이 이 이벤트를 발행합니다.
       * 항상 현재 상태를 캡처하여 스타일 적용 전 상태를 보존합니다.
       *
       * **핵심 로직:**
       * - 디바운스 타이머가 있으면 취소 (중복 캡처 방지)
       * - 항상 현재 상태를 캡처 (동일 컨텐츠는 HistoryManager에서 무시됨)
       *
       * **시나리오 1:** 텍스트 입력 후 스타일 적용
       * 1. 텍스트 입력 → 디바운스 대기 중
       * 2. Bold 클릭 → CAPTURE_SNAPSHOT → 입력 상태 저장 (타이머 취소)
       * 3. Undo → Bold 적용 전 상태로 복원
       *
       * **시나리오 2:** 기존 텍스트 선택 후 스타일 적용
       * 1. 기존 텍스트 선택 (입력 없음, 디바운스 타이머 없음)
       * 2. Bold 클릭 → CAPTURE_SNAPSHOT → 현재 상태 저장
       * 3. Undo → Bold 적용 전 상태로 복원
       */
      const unsubCaptureSnapshot = eventBus.on(
        CoreEvents.CAPTURE_SNAPSHOT,
        'on',
        () => {
          if (debounceTimer !== null) {
            clearTimeout(debounceTimer)
            debounceTimer = null
          }
          captureSnapshot(element)
        }
      )

      unsubscribers.push(unsubCaptureSnapshot)

      /**
       * 스타일 변경 이벤트 핸들러
       *
       * 스타일 명령(Bold, Italic 등) 실행 후 발행되는 이벤트를 감지합니다.
       * 스타일 적용 후 상태를 즉시 캡처하여, Undo 시 스타일만 제거되도록 합니다.
       *
       * **동작 시나리오:**
       * 1. 텍스트 입력 → debounce 대기 중
       * 2. Bold 클릭 → CAPTURE_SNAPSHOT으로 입력 상태 저장
       * 3. execCommand 실행 → DOM 변경
       * 4. STYLE_CHANGED 발행 → 스타일 적용 후 상태 저장
       * 5. Undo → 스타일 적용 전 상태(텍스트만 있는 상태)로 복원
       */
      const unsubStyleChanged = eventBus.on(
        CoreEvents.STYLE_CHANGED,
        'on',
        () => {
          if (debounceTimer !== null) {
            clearTimeout(debounceTimer)
            debounceTimer = null
          }
          captureSnapshot(element)
        }
      )

      unsubscribers.push(unsubStyleChanged)

      /**
       * Undo 이벤트 핸들러
       *
       * **동작 과정:**
       * 1. `HistoryManager`에서 이전 상태 가져오기
       * 2. 이전 상태가 있으면:
       *    a. `isRestoring` 플래그 설정 (스냅샷 캡처 방지)
       *    b. 에디터 컨텐츠를 이전 상태로 복원
       *    c. `CONTENT_RESTORED` 이벤트 발행
       *    d. 히스토리 상태 변경 이벤트 발행
       *    e. 10ms 후 `isRestoring` 플래그 해제
       * 3. 성공 여부 반환
       */
      const unsubUndo = eventBus.on(undoEventName, 'on', () => {
        const previousState = historyManager.undo()

        if (previousState) {
          isRestoring = true
          element.innerHTML = previousState.content

          eventBus.emit(CoreEvents.CONTENT_RESTORED, { action: 'undo' })
          emitStateChange(eventBus)

          setTimeout(() => {
            isRestoring = false
          }, 10)

          return true
        }

        return false
      })

      unsubscribers.push(unsubUndo)

      /**
       * Redo 이벤트 핸들러
       *
       * **동작 과정:**
       * Undo와 동일하지만 `HistoryManager`의 `redo()` 메서드를 사용하여
       * 다음 상태(취소했던 상태)로 복원합니다.
       */
      const unsubRedo = eventBus.on(redoEventName, 'on', () => {
        const nextState = historyManager.redo()

        if (nextState) {
          isRestoring = true
          element.innerHTML = nextState.content

          eventBus.emit(CoreEvents.CONTENT_RESTORED, { action: 'redo' })
          emitStateChange(eventBus)

          setTimeout(() => {
            isRestoring = false
          }, 10)

          return true
        }

        return false
      })

      unsubscribers.push(unsubRedo)
    },

    /**
     * 플러그인 정리
     *
     * 메모리 누수 방지를 위해 다음을 정리합니다:
     * - 디바운스 타이머 취소
     * - 모든 이벤트 리스너 제거
     */
    destroy() {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }

      unsubscribers.forEach((unsub) => unsub())
      unsubscribers.length = 0
    },
  }
}
