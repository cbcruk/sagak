import { useState, useEffect, useMemo } from 'react'
import { HistoryEvents } from 'sagak-core'
import { useEditorContext } from '../context/editor-context'

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
}

export interface HistoryActions {
  undo: () => void
  redo: () => void
}

export interface UseHistoryStateReturn extends HistoryState, HistoryActions {}

const initialState: HistoryState = {
  canUndo: false,
  canRedo: false,
}

function isHistoryState(data: unknown): data is HistoryState {
  if (!data || typeof data !== 'object') {
    return false
  }

  const state = data as HistoryState
  return (
    typeof state.canUndo === 'boolean' && typeof state.canRedo === 'boolean'
  )
}

export function useHistoryState(): UseHistoryStateReturn {
  const editorContext = useEditorContext()
  const [state, setState] = useState<HistoryState>(initialState)

  useEffect(() => {
    const unsubscribe = editorContext.eventBus.on(
      HistoryEvents.HISTORY_STATE_CHANGED,
      'on',
      (data?: unknown) => {
        if (isHistoryState(data)) {
          setState(data)
        }
      }
    )

    return unsubscribe
  }, [editorContext])

  const actions = useMemo<HistoryActions>(
    () => ({
      undo: () => editorContext.eventBus.emit(HistoryEvents.UNDO),
      redo: () => editorContext.eventBus.emit(HistoryEvents.REDO),
    }),
    [editorContext]
  )

  return {
    ...state,
    ...actions,
  }
}
