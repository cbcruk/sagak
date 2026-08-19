import { Plugin as PMPlugin } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import type { Plugin, EditorContext } from '@/core'
import { AutocompleteEvents } from '@/core'

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
 * 캐럿 앞의 낱말과 팝오버를 띄울 자리.
 *
 * **DOM 선택이 아니라 문서 상태에서 읽습니다.** 예전에는
 * `window.getSelection()` 으로 텍스트 노드와 오프셋을 잡았는데, 그러면 편집
 * 영역이 포커스를 잃었을 때 답이 없어지고 무엇보다 **모델이 진실인 문서에서
 * DOM 을 물어보는 꼴**이었습니다.
 *
 * 화면 좌표만 뷰에 묻습니다 — 그건 문서가 모르는 것이라 맞는 자리입니다.
 */
function currentWordInfo(view: EditorView): {
  prefix: string
  from: number
  to: number
  position: { x: number; y: number }
} | null {
  const { selection } = view.state

  if (!selection.empty) return null

  const { $from } = selection
  const before = $from.parent.textBetween(
    0,
    $from.parentOffset,
    undefined,
    '\ufffc'
  )

  /*
   * 캐럿 **바로 앞** 에서 끝나는 낱말을 찾습니다.
   *
   * 사전(`extractWords`)과 같은 분절기를 써야 합니다. 예전에는 여기만
   * `[a-zA-Z가-힣]+$` 였고 사전은 `\b…\b` 여서 기준이 서로 달랐습니다.
   */
  const prefix = lastWordBefore(before)

  if (!prefix) return null

  const coords = view.coordsAtPos($from.pos)

  return {
    prefix,
    from: $from.pos - prefix.length,
    to: $from.pos,
    position: { x: coords.left, y: coords.bottom + 4 },
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
 * 고른 낱말로 갈아 끼웁니다 — **트랜잭션 하나**입니다.
 *
 * 예전에는 텍스트 노드의 `textContent` 를 직접 잘라 붙이고 DOM 선택을 다시
 * 놓았습니다. 편집 영역이 문서 모델을 갖게 된 뒤로 그 길은 모델을 지나지
 * 않습니다.
 */
function applyAutocomplete(
  view: EditorView,
  from: number,
  to: number,
  suggestion: string
): void {
  view.dispatch(view.state.tr.insertText(suggestion, from, to))
  view.focus()
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
          currentRange = null
          eventBus.emit(AutocompleteEvents.AUTOCOMPLETE_HIDE)
        }
      }

      /** 지금 붙어 있는 뷰 — PM 플러그인 안에서 받습니다 */
      let view: EditorView | null = null
      let currentRange: { from: number; to: number } | null = null

      const showSuggestions = (): void => {
        const wordInfo = view ? currentWordInfo(view) : null

        currentRange = wordInfo
          ? { from: wordInfo.from, to: wordInfo.to }
          : null

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

        eventBus.emit(AutocompleteEvents.AUTOCOMPLETE_SHOW, {
          suggestions,
          prefix: wordInfo.prefix,
          position: wordInfo.position,
        })
      }

      /**
       * **입력을 `prosemirror-view` 의 이음매로 받습니다.**
       *
       * 예전에는 편집 영역이 `keydown`·`keyup`·`blur` 를 버스에 실어 보내고
       * 여기서 풀어 봤습니다. PM 은 그 자리를 이미 갖고 있고, 그쪽이 더
       * 잘합니다 — **조합 중에는 `handleKeyDown` 을 안 부릅니다.** 버스로
       * 받던 때는 한글을 조립하는 중에도 자모마다 제안을 다시 계산했습니다.
       */
      const area = context.editingAreaManager?.getCurrentArea()

      if (area?.addPlugin) {
        unsubscribers.push(
          area.addPlugin(
            new PMPlugin({
              view: (editorView) => {
                view = editorView

                return {
                  destroy: () => {
                    view = null
                  },
                }
              },

              props: {
                handleKeyDown: (_view, event) => {
                  if (!isAutocompleteVisible) return false

                  if (event.key === 'Escape') {
                    hideAutocomplete()
                    return true
                  }

                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    eventBus.emit(AutocompleteEvents.AUTOCOMPLETE_SELECT, {
                      direction: event.key === 'ArrowDown' ? 'next' : 'prev',
                    })
                    return true
                  }

                  if (event.key === 'Enter' || event.key === 'Tab') {
                    eventBus.emit(AutocompleteEvents.AUTOCOMPLETE_APPLY)
                    return true
                  }

                  return false
                },

                handleDOMEvents: {
                  keyup: (_view, event) => {
                    const key = (event as KeyboardEvent).key

                    if (
                      [
                        'ArrowUp',
                        'ArrowDown',
                        'Enter',
                        'Escape',
                        'Tab',
                      ].includes(key)
                    ) {
                      return false
                    }

                    if (timeoutId) clearTimeout(timeoutId)

                    timeoutId = setTimeout(() => {
                      updateWords()
                      showSuggestions()
                    }, delay)

                    return false
                  },

                  blur: () => {
                    /* 제안을 누르는 중일 수 있어 한 박자 기다립니다 */
                    setTimeout(() => {
                      hideAutocomplete()
                    }, 150)

                    return false
                  },
                },
              },
            })
          )
        )
      }



      const unsubApply = eventBus.on(
        AutocompleteEvents.AUTOCOMPLETE_APPLY, (data?: unknown) => {
          if (!data || typeof data !== 'object' || !('word' in data)) {
            return
          }

          const { word } = data as { word: string }

          if (view && currentRange) {
            applyAutocomplete(view, currentRange.from, currentRange.to, word)
          }

          hideAutocomplete()
        }
      )


      updateWords()

      unsubscribers.push(unsubApply)
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
