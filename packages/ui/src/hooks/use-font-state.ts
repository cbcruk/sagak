import { useCallback } from 'preact/hooks'
import { FontEvents } from 'sagak-core'
import { useEditorContext } from '../context/editor-context'
import { useSelectionDerived } from './use-selection-derived'

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

  /**
   * 커맨드 레지스트리를 통해 조회합니다 (자체 구현 → 레거시 순으로 위임).
   *
   * 폰트 종류와 크기를 따로 끌어옵니다. 한 객체로 묶으면 값이 같아도 매번 새
   * 객체라 리렌더가 걸립니다.
   */
  const query = (name: string): string => {
    const registry = context.commandRegistry
    return registry
      ? registry.queryValue(name)
      : document.queryCommandValue(name)
  }

  const fontFamily = useSelectionDerived(
    () => normalizeFontFamily(query('fontName')),
    initialState.fontFamily
  )
  const fontSize = useSelectionDerived(
    () => query('fontSize'),
    initialState.fontSize
  )

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
    fontFamily,
    fontSize,
    setFontFamily,
    setFontSize,
  }
}
