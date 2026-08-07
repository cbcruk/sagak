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
 * 단어 분절기.
 *
 * 예전에는 `/\b[a-zA-Z가-힣]+\b/g` 였습니다. 두 가지가 걸렸습니다 —
 *
 * **① `\b` 가 한글에서 성립하지 않습니다.** JS 의 `\b` 는 `\w`(ASCII) 기준
 * 이라 한글 앞뒤에서 경계가 잡히지 않고, 그래서 **한국어 자동 완성이 아무
 * 제안도 내놓지 못했습니다.** 찾기의 단어 단위 검색과 같은 원인입니다.
 *
 * **② 문자 클래스가 좁습니다.** 악센트 붙은 라틴(`café`), 숫자 섞인
 * 식별자(`item1`), 일본어·중국어·키릴이 전부 빠졌습니다.
 *
 * `Intl.Segmenter` 의 단어 단위를 씁니다. 공백이 없는 일본어·중국어도
 * 분절해 주므로 `[\p{L}\p{N}]+` 같은 클래스로 직접 자르는 것보다 정확합니다
 * (그렇게 하면 CJK 한 줄이 통째로 한 단어가 됩니다).
 */
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' })

/**
 * Extract all words from text content
 */
function extractWords(text: string): Set<string> {
  const words = new Set<string>()

  for (const segment of wordSegmenter.segment(text)) {
    // 구두점·공백을 걸러 냅니다
    if (!segment.isWordLike) continue
    if (segment.segment.length >= 2) {
      words.add(segment.segment)
    }
  }

  return words
}

/**
 * 편집 영역의 텍스트를 블록 경계를 지켜 모읍니다.
 *
 * `element.textContent` 는 블록을 구분자 없이 이어붙입니다 —
 * `<p>apricot</p><p>banana</p>` 가 `"apricotbanana"` 가 되어 없는 단어가
 * 사전에 들어갔습니다. 텍스트 노드를 줄바꿈으로 이어 그것을 막습니다.
 */
function collectText(element: HTMLElement): string {
  const parts: string[] = []
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)

  let node: Node | null
  while ((node = walker.nextNode())) {
    if (node.textContent) parts.push(node.textContent)
  }

  return parts.join('\n')
}

/**
 * 문자열 끝에 붙어 있는 단어. 끝이 구두점·공백이면 `null` 입니다.
 */
function lastWordBefore(text: string): string | null {
  let last: string | null = null

  for (const segment of wordSegmenter.segment(text)) {
    last = segment.isWordLike ? segment.segment : null
  }

  return last
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

  /*
   * 캐럿 **바로 앞** 에서 끝나는 단어를 찾습니다.
   *
   * 사전(`extractWords`)과 같은 분절기를 써야 합니다. 예전에는 여기만
   * `[a-zA-Z가-힣]+$` 였고 사전은 `\b…\b` 여서 기준이 서로 달랐습니다.
   */
  const prefix = lastWordBefore(beforeCursor)

  if (!prefix) {
    return null
  }

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
    if (
      word.toLowerCase().startsWith(lowerPrefix) &&
      word.toLowerCase() !== lowerPrefix
    ) {
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
  /** 마지막으로 사전을 만든 원문 — 같으면 다시 만들지 않습니다 */
  let lastText: string | null = null

  return {
    name: 'utility:autocomplete',

    initialize(context: EditorContext) {
      const { eventBus, element } = context

      if (!element) {
        return
      }

      /**
       * 사전을 다시 만듭니다 — **글이 바뀌었을 때만.**
       *
       * 키업마다 문서 전체를 분절하면 큰 문서에서 비쌉니다 (1000문단 8.8 ms).
       * 화살표·수식 키처럼 글을 바꾸지 않는 입력에도 키업은 오므로, 모아 온
       * 텍스트가 그대로면 건너뜁니다.
       */
      const updateWords = (): void => {
        const text = collectText(element)

        if (text === lastText) {
          return
        }

        lastText = text
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

        const suggestions = findSuggestions(
          wordInfo.prefix,
          words,
          maxSuggestions
        )

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

          if (
            ['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'].includes(
              event.key
            )
          ) {
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
