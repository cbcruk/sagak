import { useState, useEffect, useCallback } from 'react'
import { CoreEvents, FontEvents } from 'sagak-core'
import { useEditorContext } from '../context/editor-context'

export interface FontState {
  fontFamily: string
  fontSize: string
}

const initialState: FontState = {
  fontFamily: '',
  fontSize: '',
}

function normalizeFontFamily(font: string): string {
  return font.replace(/["']/g, '')
}

export interface UseFontStateReturn extends FontState {
  setFontFamily: (fontFamily: string) => void
  setFontSize: (fontSize: string) => void
}

export function useFontState(): UseFontStateReturn {
  const { eventBus, selectionManager } = useEditorContext()
  const [state, setState] = useState<FontState>(initialState)

  const updateFontState = useCallback(() => {
    const fontFamily = document.queryCommandValue('fontName')
    const fontSize = document.queryCommandValue('fontSize')

    setState({
      fontFamily: normalizeFontFamily(fontFamily),
      fontSize,
    })
  }, [])

  useEffect(() => {
    const handleSelectionChange = (): void => {
      if (selectionManager?.getIsComposing()) {
        return
      }
      requestAnimationFrame(updateFontState)
    }

    document.addEventListener('selectionchange', handleSelectionChange)

    const unsubscribeStyle = eventBus.on(
      CoreEvents.STYLE_CHANGED,
      'after',
      updateFontState
    )

    updateFontState()

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      unsubscribeStyle()
    }
  }, [eventBus, selectionManager, updateFontState])

  const setFontFamily = useCallback(
    (fontFamily: string) => {
      selectionManager?.restoreSelection()
      eventBus.emit(FontEvents.FONT_FAMILY_CHANGED, { fontFamily })
    },
    [eventBus, selectionManager]
  )

  const setFontSize = useCallback(
    (fontSize: string) => {
      selectionManager?.restoreSelection()
      eventBus.emit(FontEvents.FONT_SIZE_CHANGED, { fontSize })
    },
    [eventBus, selectionManager]
  )

  return {
    ...state,
    setFontFamily,
    setFontSize,
  }
}
