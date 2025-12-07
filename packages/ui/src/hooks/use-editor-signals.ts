import { useMemo } from 'preact/hooks'
import { useEditorContext } from '../context/editor-context'
import { TextStyleEvents, type EditorContext } from '@sagak/core'
import {
  createEditorSignals,
  type EditorSignals,
} from '../state/editor-signals'
import { useOnceWithCleanup } from './use-once'

/**
 * 텍스트 포맷팅을 위한 에디터 액션
 */
export interface EditorActions {
  /** 굵게 포맷팅 토글 */
  toggleBold: () => void
  /** 기울임 포맷팅 토글 */
  toggleItalic: () => void
  /** 밑줄 포맷팅 토글 */
  toggleUnderline: () => void
  /** 취소선 포맷팅 토글 */
  toggleStrikeThrough: () => void
  /** 아래 첨자 포맷팅 토글 */
  toggleSubscript: () => void
  /** 위 첨자 포맷팅 토글 */
  toggleSuperscript: () => void
}

/**
 * 컨텍스트와 액션을 포함한 에디터 signals
 */
export type EditorSignalsWithContext = EditorSignals & {
  editorContext: EditorContext
} & EditorActions

/**
 * 에디터 포맷팅 상태를 Preact signals와 액션으로 사용
 *
 * `EditorContext`에서 자동으로 `editorContext`를 가져와서
 * formatting state를 Signals로 변환하고, formatting actions도 함께 제공합니다
 *
 * @returns 에디터 signals, 컨텍스트, 액션
 * @throws `EditorProvider` 외부에서 사용 시 에러
 *
 * @example
 * ```tsx
 * function Toolbar() {
 *   const { isBold, toggleBold } = useEditorSignals();
 *
 *   return (
 *     <button
 *       class={isBold.value ? 'active' : ''}
 *       onClick={toggleBold}
 *     >
 *       Bold
 *     </button>
 *   );
 * }
 * ```
 */
export function useEditorSignals(): EditorSignalsWithContext {
  const editorContext = useEditorContext()

  const signals = useOnceWithCleanup(() => {
    const created = createEditorSignals(editorContext)

    return {
      value: created,
      cleanup: created.cleanup,
    }
  })

  const actions = useMemo<EditorActions>(
    () => ({
      toggleBold: () =>
        editorContext.eventBus.emit(TextStyleEvents.BOLD_CLICKED),
      toggleItalic: () =>
        editorContext.eventBus.emit(TextStyleEvents.ITALIC_CLICKED),
      toggleUnderline: () =>
        editorContext.eventBus.emit(TextStyleEvents.UNDERLINE_CLICKED),
      toggleStrikeThrough: () =>
        editorContext.eventBus.emit(TextStyleEvents.STRIKE_CLICKED),
      toggleSubscript: () =>
        editorContext.eventBus.emit(TextStyleEvents.TOGGLE_SUBSCRIPT),
      toggleSuperscript: () =>
        editorContext.eventBus.emit(TextStyleEvents.TOGGLE_SUPERSCRIPT),
    }),
    [editorContext]
  )

  return {
    ...signals,
    ...actions,
    editorContext,
  }
}
