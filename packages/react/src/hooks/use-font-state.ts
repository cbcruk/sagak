import { useState, useEffect, useCallback } from 'preact/compat'
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
  const context = useEditorContext()
  const { eventBus, selectionManager } = context
  const [state, setState] = useState<FontState>(initialState)

  const isSelectionInEditor = useCallback((): boolean => {
    const element = context.element
    if (!element) return false

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false

    const anchorNode = selection.anchorNode
    if (!anchorNode) return false

    return element.contains(anchorNode)
  }, [context.element])

  const updateFontState = useCallback(() => {
    if (!isSelectionInEditor()) return

    // 커맨드 레지스트리를 통해 조회합니다 (자체 구현 → 레거시 순으로 위임)
    const registry = context.commandRegistry
    const fontFamily = registry
      ? registry.queryValue('fontName')
      : document.queryCommandValue('fontName')
    const fontSize = registry
      ? registry.queryValue('fontSize')
      : document.queryCommandValue('fontSize')

    setState({
      fontFamily: normalizeFontFamily(fontFamily),
      fontSize,
    })
  }, [isSelectionInEditor, context.commandRegistry])

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
