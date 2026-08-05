import type { ComponentChildren } from 'preact'
import { useCallback, useRef, useState } from 'preact/hooks'
import { AutocompleteEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { useEditorEvent } from '../../hooks/use-editor-event'

interface AutocompleteState {
  visible: boolean
  suggestions: string[]
  prefix: string
  position: { x: number; y: number }
  selectedIndex: number
}

export function AutocompletePopover(): ComponentChildren {
  const context = useEditorContext()
  const [state, setState] = useState<AutocompleteState>({
    visible: false,
    suggestions: [],
    prefix: '',
    position: { x: 0, y: 0 },
    selectedIndex: 0,
  })
  const popoverRef = useRef<HTMLDivElement>(null)

  useEditorEvent(
    AutocompleteEvents.AUTOCOMPLETE_SHOW,
    'on',
    ({ suggestions, prefix, position }) => {
      setState({ visible: true, suggestions, prefix, position, selectedIndex: 0 })
    }
  )

  useEditorEvent(AutocompleteEvents.AUTOCOMPLETE_HIDE, 'on', () => {
    setState((prev) => ({
      ...prev,
      visible: false,
      suggestions: [],
      selectedIndex: 0,
    }))
  })

  useEditorEvent(AutocompleteEvents.AUTOCOMPLETE_SELECT, 'on', (payload) => {
    if (!payload || !('direction' in payload)) return
    const { direction } = payload

    setState((prev) => {
      if (!prev.visible || prev.suggestions.length === 0) return prev

      const last = prev.suggestions.length - 1
      const selectedIndex =
        direction === 'next'
          ? (prev.selectedIndex + 1) % prev.suggestions.length
          : prev.selectedIndex === 0
            ? last
            : prev.selectedIndex - 1

      return { ...prev, selectedIndex }
    })
  })

  /**
   * 페이로드가 있으면 이미 적용된 것이라 흘려보냅니다.
   * 없으면(키보드 확정) 지금 고른 단어를 실어 다시 발행합니다.
   */
  useEditorEvent(AutocompleteEvents.AUTOCOMPLETE_APPLY, 'on', (payload) => {
    if (payload && 'word' in payload) return

    setState((prev) => {
      if (!prev.visible || prev.suggestions.length === 0) return prev

      context.eventBus.emit(AutocompleteEvents.AUTOCOMPLETE_APPLY, {
        word: prev.suggestions[prev.selectedIndex],
      })

      return prev
    })
  })

  const handleItemClick = useCallback(
    (word: string) => {
      if (!context?.eventBus) return

      context.eventBus.emit(AutocompleteEvents.AUTOCOMPLETE_APPLY, { word })
    },
    [context?.eventBus]
  )

  const handleMouseEnter = useCallback((index: number) => {
    setState((prev) => ({ ...prev, selectedIndex: index }))
  }, [])

  if (!state.visible || state.suggestions.length === 0) {
    return null
  }

  return (
    <div
      ref={popoverRef}
      data-scope="autocomplete"
      data-part="popover"
      style={{
        position: 'fixed',
        left: state.position.x,
        top: state.position.y,
        zIndex: 1000,
      }}
    >
      <ul data-scope="autocomplete" data-part="list">
        {state.suggestions.map((word, index) => (
          <li
            key={word}
            data-scope="autocomplete"
            data-part="item"
            data-selected={index === state.selectedIndex ? 'true' : undefined}
            onMouseDown={(e) => {
              e.preventDefault()
              handleItemClick(word)
            }}
            onMouseEnter={() => handleMouseEnter(index)}
          >
            <span data-scope="autocomplete" data-part="prefix">
              {state.prefix}
            </span>
            <span data-scope="autocomplete" data-part="completion">
              {word.slice(state.prefix.length)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
