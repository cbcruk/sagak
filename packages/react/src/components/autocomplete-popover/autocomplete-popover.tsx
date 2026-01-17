import { useState, useEffect, useCallback, useRef } from 'react'
import { AutocompleteEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

interface AutocompleteState {
  visible: boolean
  suggestions: string[]
  prefix: string
  position: { x: number; y: number }
  selectedIndex: number
}

export function AutocompletePopover(): React.ReactNode {
  const context = useEditorContext()
  const [state, setState] = useState<AutocompleteState>({
    visible: false,
    suggestions: [],
    prefix: '',
    position: { x: 0, y: 0 },
    selectedIndex: 0,
  })
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!context?.eventBus) return

    const { eventBus } = context

    const unsubShow = eventBus.on(
      AutocompleteEvents.AUTOCOMPLETE_SHOW,
      'on',
      (data?: unknown) => {
        if (!data || typeof data !== 'object') return

        const { suggestions, prefix, position } = data as {
          suggestions: string[]
          prefix: string
          position: { x: number; y: number }
        }

        setState({
          visible: true,
          suggestions,
          prefix,
          position,
          selectedIndex: 0,
        })
      }
    )

    const unsubHide = eventBus.on(
      AutocompleteEvents.AUTOCOMPLETE_HIDE,
      'on',
      () => {
        setState((prev) => ({
          ...prev,
          visible: false,
          suggestions: [],
          selectedIndex: 0,
        }))
      }
    )

    const unsubSelect = eventBus.on(
      AutocompleteEvents.AUTOCOMPLETE_SELECT,
      'on',
      (data?: unknown) => {
        if (!data || typeof data !== 'object' || !('direction' in data)) return

        const { direction } = data as { direction: 'next' | 'prev' }

        setState((prev) => {
          if (!prev.visible || prev.suggestions.length === 0) return prev

          let newIndex: number

          if (direction === 'next') {
            newIndex = (prev.selectedIndex + 1) % prev.suggestions.length
          } else {
            newIndex =
              prev.selectedIndex === 0
                ? prev.suggestions.length - 1
                : prev.selectedIndex - 1
          }

          return { ...prev, selectedIndex: newIndex }
        })
      }
    )

    const unsubApply = eventBus.on(
      AutocompleteEvents.AUTOCOMPLETE_APPLY,
      'on',
      (data?: unknown) => {
        if (data && typeof data === 'object' && 'word' in data) {
          return
        }

        setState((prev) => {
          if (!prev.visible || prev.suggestions.length === 0) return prev

          const selectedWord = prev.suggestions[prev.selectedIndex]
          eventBus.emit(AutocompleteEvents.AUTOCOMPLETE_APPLY, {
            word: selectedWord,
          })

          return prev
        })
      }
    )

    return () => {
      unsubShow()
      unsubHide()
      unsubSelect()
      unsubApply()
    }
  }, [context?.eventBus])

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
