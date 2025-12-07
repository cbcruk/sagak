import { useEffect, useState } from 'preact/hooks'
import { HistoryEvents } from '@sagak/core'
import { useEditorContext } from '../context/editor-context'

/**
 * 히스토리 상태 인터페이스
 */
export interface HistoryState {
  /** `undo` 가능 여부 */
  canUndo: boolean
  /** `redo` 가능 여부 */
  canRedo: boolean
  /** `undo` 엔트리 개수 */
  undoSize: number
  /** `redo` 엔트리 개수 */
  redoSize: number
}

/**
 * `useHistoryState` hook의 반환 타입
 */
export interface UseHistoryStateReturn {
  /** `undo` 가능 여부 */
  canUndo: boolean
  /** `redo` 가능 여부 */
  canRedo: boolean
  /** `undo` 엔트리 개수 */
  undoSize: number
  /** `redo` 엔트리 개수 */
  redoSize: number
  /** `undo` 함수 */
  undo: () => void
  /** `redo` 함수 */
  redo: () => void
}

/**
 * undo/redo 상태를 추적하고 제어하는 Hook
 *
 * @returns 히스토리 상태와 제어 함수
 *
 * @example
 * ```tsx
 * function UndoRedoButtons() {
 *   const { canUndo, canRedo, undo, redo } = useHistoryState();
 *
 *   return (
 *     <>
 *       <button disabled={!canUndo} onClick={undo}>Undo</button>
 *       <button disabled={!canRedo} onClick={redo}>Redo</button>
 *     </>
 *   );
 * }
 * ```
 */
export function useHistoryState(): UseHistoryStateReturn {
  const { eventBus } = useEditorContext()

  const [historyState, setHistoryState] = useState<HistoryState>({
    canUndo: false,
    canRedo: false,
    undoSize: 0,
    redoSize: 0,
  })

  useEffect(() => {
    const unsubscribe = eventBus.on(
      HistoryEvents.HISTORY_STATE_CHANGED,
      'after',
      (data?: any) => {
        if (data) {
          setHistoryState({
            canUndo: data.canUndo ?? false,
            canRedo: data.canRedo ?? false,
            undoSize: data.undoSize ?? 0,
            redoSize: data.redoSize ?? 0,
          })
        }
      }
    )

    return () => {
      unsubscribe()
    }
  }, [eventBus])

  const undo = () => {
    eventBus.emit(HistoryEvents.UNDO)
  }

  const redo = () => {
    eventBus.emit(HistoryEvents.REDO)
  }

  return {
    ...historyState,
    undo,
    redo,
  }
}
