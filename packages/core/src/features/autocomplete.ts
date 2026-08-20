import { Plugin as PMPlugin } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import type { Plugin, EditorContext } from '@/core'

/**
 * 자동 완성 — **모듈 API 입니다.**
 *
 * ## 찾기와 반대 방향입니다
 *
 * 찾기/바꾸기는 UI 가 먼저 말을 겁니다 — 그래서 메서드를 부르고 답을 그 자리
 * 에서 받으면 끝났습니다. 자동 완성은 **코어가 먼저 말을 겁니다.** 사용자가
 * 치는 것을 보다가 "지금 이 낱말들을 띄워라" 라고 알려야 합니다. 그래서 여기는
 * `subscribe` 가 있습니다.
 *
 * 그것이 이벤트여야 한다는 뜻은 아닙니다. 듣는 쪽은 팝오버 하나이고, 무엇을
 * 띄울지 정하는 쪽도 하나입니다.
 *
 * ## 고른 항목이 코어에 있습니다
 *
 * 예전에는 **몇 번째가 강조되어 있는가를 팝오버가 들고 있었습니다.** 그래서
 * 키보드로 확정할 때 —
 *
 * 1. 코어가 `AUTOCOMPLETE_APPLY` 를 빈 채로 쏘고,
 * 2. 팝오버가 그것을 받아 지금 고른 단어를 실어 **같은 이름으로 다시** 쏘고,
 * 3. 코어가 그것을 받아 문서에 넣었습니다.
 *
 * 한 이름이 양쪽 방향으로 쓰였고, 그래서 자기가 보낸 것을 자기가 다시 받는
 * 것을 막는 가드(`페이로드가 있으면 흘려보냅니다`)가 필요했습니다. 그 가드를
 * 지우면 마우스로 고른 순간 확정이 두 번 나갑니다 — 검사가 그것을 못 박아
 * 두고 있었습니다.
 *
 * 목록의 주인이 코어이므로 **번호의 주인도 코어**입니다. 왕복이 없어지고
 * 가드도 함께 없어집니다.
 */
export interface AutocompleteOptions {
  /**
   * 제안을 띄우기 시작하는 글자 수
   * @default 2
   */
  minChars?: number

  /**
   * 최대 몇 개까지
   * @default 5
   */
  maxSuggestions?: number

  /**
   * 마지막 입력 뒤 몇 ms 를 기다렸다가
   * @default 100
   */
  delay?: number
}

/** 지금 떠 있는 제안. 안 떠 있으면 `null` 입니다 */
export interface AutocompleteState {
  suggestions: string[]
  /** 사용자가 여기까지 쳤습니다 */
  prefix: string
  /** 팝오버를 띄울 화면 좌표 */
  position: { x: number; y: number }
  /** 지금 고른 것 */
  index: number
}

export interface Autocomplete {
  /** 위아래로 옮깁니다 — 끝에서 돌아옵니다 */
  move(delta: number): void
  /** 마우스가 지나간 항목을 고릅니다 */
  highlight(index: number): void
  /** 넣습니다. 번호를 주면 그것을, 안 주면 지금 고른 것을 */
  apply(index?: number): boolean
  /** 닫습니다 */
  dismiss(): void
  /** 떴다 · 바뀌었다 · 닫혔다 — 지금 값을 곧바로 한 번 줍니다 */
  subscribe(listener: (state: AutocompleteState | null) => void): () => void
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
 * 에디터 하나에 하나입니다.
 *
 * 팝오버(`subscribe`)와 플러그인(입력을 보는 쪽)이 **같은 것**을 잡아야
 * 하는데 둘의 순서가 정해져 있지 않아, 어느 쪽이 먼저 부르든 만들어 줍니다.
 */
interface Session {
  state: AutocompleteState | null
  listeners: Set<(state: AutocompleteState | null) => void>
  /** 붙어 있는 뷰 — 플러그인이 돌 때만 있습니다 */
  view: EditorView | null
  /** 갈아 끼울 자리 */
  range: { from: number; to: number } | null
}

const sessions = new WeakMap<EditorContext, Session>()

function sessionOf(context: EditorContext): Session {
  const existing = sessions.get(context)

  if (existing) return existing

  const session: Session = {
    state: null,
    listeners: new Set(),
    view: null,
    range: null,
  }

  sessions.set(context, session)

  return session
}

function publish(session: Session, next: AutocompleteState | null): void {
  session.state = next

  for (const listener of session.listeners) listener(next)
}

const modules = new WeakMap<EditorContext, Autocomplete>()

export function autocomplete(context: EditorContext): Autocomplete {
  const existing = modules.get(context)

  if (existing) return existing

  const session = sessionOf(context)

  const module: Autocomplete = {
    move(delta) {
      const { state } = session

      if (!state || state.suggestions.length === 0) return

      const count = state.suggestions.length

      publish(session, {
        ...state,
        index: (state.index + delta + count) % count,
      })
    },

    highlight(index) {
      const { state } = session

      if (!state || index < 0 || index >= state.suggestions.length) return
      if (index === state.index) return

      publish(session, { ...state, index })
    },

    apply(index) {
      const { state, view, range } = session

      if (!state || !view || !range) return false

      const at = index ?? state.index
      const word = state.suggestions[at]

      if (!word) return false

      applyAutocomplete(view, range.from, range.to, word)
      publish(session, null)

      return true
    },

    dismiss() {
      if (session.state === null) return

      publish(session, null)
    },

    subscribe(listener) {
      session.listeners.add(listener)
      listener(session.state)

      return () => {
        session.listeners.delete(listener)
      }
    },
  }

  modules.set(context, module)

  return module
}

/**
 * 입력을 보는 쪽.
 *
 * 이쪽은 **에디터와 생사를 같이하는 일꾼**이라 플러그인 자리가 맞습니다 —
 * 바깥 UI 와의 대화가 아닙니다. `replaceDefaultPlugins` 로 통째로 끌 수 있는
 * 것도 그대로입니다.
 */
export function createAutocompletePlugin(
  options: AutocompleteOptions = {}
): Plugin {
  const { minChars = 2, maxSuggestions = 5, delay = 100 } = options

  const unsubscribers: Array<() => void> = []
  let words = new Set<string>()
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  /** 마지막으로 사전을 만든 원문 — 같으면 다시 만들지 않습니다 */
  let lastText: string | null = null

  return {
    name: 'utility:autocomplete',

    initialize(context: EditorContext) {
      const { element } = context

      if (!element) {
        return
      }

      const session = sessionOf(context)
      const module = autocomplete(context)

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

      const showSuggestions = (): void => {
        const wordInfo = session.view ? currentWordInfo(session.view) : null

        session.range = wordInfo
          ? { from: wordInfo.from, to: wordInfo.to }
          : null

        if (!wordInfo || wordInfo.prefix.length < minChars) {
          module.dismiss()
          return
        }

        const suggestions = findSuggestions(
          wordInfo.prefix,
          words,
          maxSuggestions
        )

        if (suggestions.length === 0) {
          module.dismiss()
          return
        }

        publish(session, {
          suggestions,
          prefix: wordInfo.prefix,
          position: wordInfo.position,
          index: 0,
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
                session.view = editorView

                return {
                  destroy: () => {
                    session.view = null
                  },
                }
              },

              props: {
                handleKeyDown: (_view, event) => {
                  if (session.state === null) return false

                  if (event.key === 'Escape') {
                    module.dismiss()
                    return true
                  }

                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    module.move(event.key === 'ArrowDown' ? 1 : -1)
                    return true
                  }

                  /*
                   * 곧바로 넣습니다 — 예전에는 여기서 팝오버에게 "지금 고른
                   * 것이 무엇이냐" 를 물어야 했습니다.
                   */
                  if (event.key === 'Enter' || event.key === 'Tab') {
                    return module.apply()
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
                      module.dismiss()
                    }, 150)

                    return false
                  },
                },
              },
            })
          )
        )
      }

      updateWords()

      unsubscribers.push(() => {
        module.dismiss()
      })
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
