import type { Plugin, EditorContext } from '@/core'
import { WysiwygEvents, AutocompleteEvents } from '@/core'

/**
 * Autocomplete suggestion data
 */
export interface AutocompleteSuggestion {
  word: string
  prefix: string
  position: { x: number; y: number }
}

/**
 * Autocomplete plugin options
 */
export interface AutocompletePluginOptions {
  /**
   * Minimum characters to trigger autocomplete
   * @default 2
   */
  minChars?: number

  /**
   * Maximum number of suggestions to show
   * @default 5
   */
  maxSuggestions?: number

  /**
   * Delay in ms before showing suggestions
   * @default 100
   */
  delay?: number
}

/**
 * Extract all words from text content
 */
function extractWords(text: string): Set<string> {
  const words = new Set<string>()
  const matches = text.match(/\b[a-zA-Z가-힣]+\b/g)

  if (matches) {
    for (const word of matches) {
      if (word.length >= 2) {
        words.add(word)
      }
    }
  }

  return words
}

/**
 * Get the current word being typed and its position
 */
function getCurrentWordInfo(element: HTMLElement): {
  prefix: string
  range: Range | null
  position: { x: number; y: number }
} | null {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const range = selection.getRangeAt(0)

  if (!range.collapsed) {
    return null
  }

  const node = range.startContainer

  if (node.nodeType !== Node.TEXT_NODE) {
    return null
  }

  if (!element.contains(node)) {
    return null
  }

  const text = node.textContent || ''
  const offset = range.startOffset
  const beforeCursor = text.slice(0, offset)
  const match = beforeCursor.match(/[a-zA-Z가-힣]+$/)

  if (!match) {
    return null
  }

  const prefix = match[0]
  const rect = range.getBoundingClientRect()

  return {
    prefix,
    range,
    position: {
      x: rect.left,
      y: rect.bottom + 4,
    },
  }
}

/**
 * Find matching suggestions for a prefix
 */
function findSuggestions(
  prefix: string,
  words: Set<string>,
  maxSuggestions: number
): string[] {
  const lowerPrefix = prefix.toLowerCase()
  const suggestions: string[] = []

  for (const word of words) {
    if (word.toLowerCase().startsWith(lowerPrefix) && word.toLowerCase() !== lowerPrefix) {
      suggestions.push(word)

      if (suggestions.length >= maxSuggestions) {
        break
      }
    }
  }

  return suggestions.sort((a, b) => a.length - b.length)
}

/**
 * Replace the current word prefix with the selected suggestion
 */
function applyAutocomplete(
  element: HTMLElement,
  prefix: string,
  suggestion: string
): void {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) {
    return
  }

  const range = selection.getRangeAt(0)
  const node = range.startContainer

  if (node.nodeType !== Node.TEXT_NODE || !element.contains(node)) {
    return
  }

  const text = node.textContent || ''
  const offset = range.startOffset
  const startPos = offset - prefix.length

  if (startPos < 0) {
    return
  }

  const before = text.slice(0, startPos)
  const after = text.slice(offset)
  node.textContent = before + suggestion + after

  const newRange = document.createRange()
  newRange.setStart(node, startPos + suggestion.length)
  newRange.collapse(true)
  selection.removeAllRanges()
  selection.addRange(newRange)
}

/**
 * Create autocomplete plugin
 */
export function createAutocompletePlugin(
  options: AutocompletePluginOptions = {}
): Plugin {
  const { minChars = 2, maxSuggestions = 5, delay = 100 } = options

  const unsubscribers: Array<() => void> = []
  let words = new Set<string>()
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let isAutocompleteVisible = false
  let currentPrefix = ''

  return {
    name: 'utility:autocomplete',

    initialize(context: EditorContext) {
      const { eventBus, element } = context

      if (!element) {
        return
      }

      const updateWords = (): void => {
        const text = element.textContent || ''
        words = extractWords(text)
      }

      const hideAutocomplete = (): void => {
        if (isAutocompleteVisible) {
          isAutocompleteVisible = false
          currentPrefix = ''
          eventBus.emit(AutocompleteEvents.AUTOCOMPLETE_HIDE)
        }
      }

      const showSuggestions = (): void => {
        const wordInfo = getCurrentWordInfo(element)

        if (!wordInfo || wordInfo.prefix.length < minChars) {
          hideAutocomplete()
          return
        }

        const suggestions = findSuggestions(wordInfo.prefix, words, maxSuggestions)

        if (suggestions.length === 0) {
          hideAutocomplete()
          return
        }

        isAutocompleteVisible = true
        currentPrefix = wordInfo.prefix

        eventBus.emit(AutocompleteEvents.AUTOCOMPLETE_SHOW, {
          suggestions,
          prefix: wordInfo.prefix,
          position: wordInfo.position,
        })
      }

      const unsubKeyup = eventBus.on(
        WysiwygEvents.WYSIWYG_KEYUP,
        'on',
        (data?: unknown) => {
          if (!data || typeof data !== 'object' || !('event' in data)) {
            return
          }

          const event = (data as { event: KeyboardEvent }).event

          if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'].includes(event.key)) {
            return
          }

          if (timeoutId) {
            clearTimeout(timeoutId)
          }

          timeoutId = setTimeout(() => {
            updateWords()
            showSuggestions()
          }, delay)
        }
      )

      const unsubKeydown = eventBus.on(
        WysiwygEvents.WYSIWYG_KEYDOWN,
        'on',
        (data?: unknown) => {
          if (!isAutocompleteVisible) {
            return
          }

          if (!data || typeof data !== 'object' || !('event' in data)) {
            return
          }

          const event = (data as { event: KeyboardEvent }).event

          if (event.key === 'Escape') {
            event.preventDefault()
            hideAutocomplete()
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            eventBus.emit(AutocompleteEvents.AUTOCOMPLETE_SELECT, {
              direction: event.key === 'ArrowDown' ? 'next' : 'prev',
            })
          } else if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault()
            eventBus.emit(AutocompleteEvents.AUTOCOMPLETE_APPLY)
          }
        }
      )

      const unsubApply = eventBus.on(
        AutocompleteEvents.AUTOCOMPLETE_APPLY,
        'on',
        (data?: unknown) => {
          if (!data || typeof data !== 'object' || !('word' in data)) {
            return
          }

          const { word } = data as { word: string }
          applyAutocomplete(element, currentPrefix, word)
          hideAutocomplete()
        }
      )

      const unsubBlur = eventBus.on(WysiwygEvents.WYSIWYG_BLURRED, 'on', () => {
        setTimeout(() => {
          hideAutocomplete()
        }, 150)
      })

      updateWords()

      unsubscribers.push(unsubKeyup, unsubKeydown, unsubApply, unsubBlur)
    },

    destroy() {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      unsubscribers.forEach((unsub) => unsub())
      unsubscribers.length = 0
    },
  }
}
