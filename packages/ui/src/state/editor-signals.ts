import { signal } from '@preact/signals'
import { CoreEvents, type EditorContext } from '@sagak/core'

/**
 * 포맷팅 상태 인터페이스
 */
export interface FormattingState {
  /** 볼드 상태 */
  isBold: boolean
  /** 이탤릭 상태 */
  isItalic: boolean
  /** 밑줄 상태 */
  isUnderline: boolean
  /** 취소선 상태 */
  isStrikeThrough: boolean
  /** 아래 첨자 상태 */
  isSubscript: boolean
  /** 위 첨자 상태 */
  isSuperscript: boolean
}

/**
 * `createEditorSignals`가 반환하는 에디터 signals
 */
export interface EditorSignals {
  /** 볼드 signal */
  isBold: ReturnType<typeof signal<boolean>>
  /** 이탤릭 signal */
  isItalic: ReturnType<typeof signal<boolean>>
  /** 밑줄 signal */
  isUnderline: ReturnType<typeof signal<boolean>>
  /** 취소선 signal */
  isStrikeThrough: ReturnType<typeof signal<boolean>>
  /** 아래 첨자 signal */
  isSubscript: ReturnType<typeof signal<boolean>>
  /** 위 첨자 signal */
  isSuperscript: ReturnType<typeof signal<boolean>>
  /** 정리 함수 */
  cleanup: () => void
}

/**
 * `FormattingState` 타입 가드
 *
 * @param data - 확인할 데이터
 * @returns 데이터가 `FormattingState`인 경우 `true`
 */
function isFormattingState(data: unknown): data is FormattingState {
  if (!data || typeof data !== 'object') {
    return false
  }

  const state = data as FormattingState
  return (
    typeof state.isBold === 'boolean' &&
    typeof state.isItalic === 'boolean' &&
    typeof state.isUnderline === 'boolean' &&
    typeof state.isStrikeThrough === 'boolean' &&
    typeof state.isSubscript === 'boolean' &&
    typeof state.isSuperscript === 'boolean'
  )
}

/**
 * `EditorContext`에서 Preact Signals 생성
 *
 * `EventBus`의 `FORMATTING_STATE_CHANGED` 이벤트를 구독하여 Signal 기반 상태로 변환합니다
 *
 * @param editorContext - `@sagak/core`의 `EditorContext`
 * @returns 에디터 signals와 정리 함수
 *
 * @example
 * ```tsx
 * function Toolbar({ editorContext }: ToolbarProps) {
 *   const signals = createEditorSignals(editorContext);
 *
 *   useEffect(() => {
 *     return signals.cleanup;
 *   }, []);
 *
 *   return (
 *     <button class={signals.isBold.value ? 'active' : ''}>
 *       Bold
 *     </button>
 *   );
 * }
 * ```
 */
export function createEditorSignals(
  editorContext: EditorContext
): EditorSignals {
  const isBold = signal(false)
  const isItalic = signal(false)
  const isUnderline = signal(false)
  const isStrikeThrough = signal(false)
  const isSubscript = signal(false)
  const isSuperscript = signal(false)

  const unsubscribe = editorContext.eventBus.on(
    CoreEvents.FORMATTING_STATE_CHANGED,
    'on',
    (state?: unknown) => {
      if (!isFormattingState(state)) {
        console.warn('Invalid formatting state received')
        return
      }

      isBold.value = state.isBold
      isItalic.value = state.isItalic
      isUnderline.value = state.isUnderline
      isStrikeThrough.value = state.isStrikeThrough
      isSubscript.value = state.isSubscript
      isSuperscript.value = state.isSuperscript
    }
  )

  return {
    isBold,
    isItalic,
    isUnderline,
    isStrikeThrough,
    isSubscript,
    isSuperscript,
    cleanup: unsubscribe,
  }
}
