import { useState, useEffect, useMemo } from 'react'
import { CoreEvents, TextStyleEvents, type FormattingState } from 'sagak-core'
import { useEditorContext } from '../context/editor-context'

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

const initialState: FormattingState = {
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrikeThrough: false,
  isSubscript: false,
  isSuperscript: false,
}

export interface FormattingActions {
  toggleBold: () => void
  toggleItalic: () => void
  toggleUnderline: () => void
  toggleStrikeThrough: () => void
  toggleSubscript: () => void
  toggleSuperscript: () => void
}

export interface UseFormattingStateReturn
  extends FormattingState, FormattingActions {}

export function useFormattingState(): UseFormattingStateReturn {
  const editorContext = useEditorContext()
  const [state, setState] = useState<FormattingState>(initialState)

  useEffect(() => {
    const unsubscribe = editorContext.eventBus.on(
      CoreEvents.FORMATTING_STATE_CHANGED,
      'on',
      (data?: unknown) => {
        if (isFormattingState(data)) {
          setState(data)
        }
      }
    )

    return unsubscribe
  }, [editorContext])

  const actions = useMemo<FormattingActions>(
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
    ...state,
    ...actions,
  }
}
