import { logger } from '@/core/logger'
import { isBlockedByComposition } from '@/core/composition-guard'
import { createErrorReporter } from '@/core/errors'
import type { Plugin, EditorContext } from '@/core'
import { FindReplaceEvents, CoreEvents } from '@/core'

/**
 * 찾기/바꾸기 플러그인 설정 옵션
 */
export interface FindReplaceOptions {
  /**
   * 찾기 작업을 수신할 이벤트 이름
   * @default 'FIND'
   */
  findEventName?: string

  /**
   * 다음 찾기 작업을 수신할 이벤트 이름
   * @default 'FIND_NEXT'
   */
  findNextEventName?: string

  /**
   * 이전 찾기 작업을 수신할 이벤트 이름
   * @default 'FIND_PREVIOUS'
   */
  findPreviousEventName?: string

  /**
   * 바꾸기 작업을 수신할 이벤트 이름
   * @default 'REPLACE'
   */
  replaceEventName?: string

  /**
   * 모두 바꾸기 작업을 수신할 이벤트 이름
   * @default 'REPLACE_ALL'
   */
  replaceAllEventName?: string

  /**
   * 찾기 지우기 작업을 수신할 이벤트 이름
   * @default 'CLEAR_FIND'
   */
  clearFindEventName?: string

  /**
   * 작업 전에 IME 입력 상태를 확인할지 여부
   * @default true
   */
  checkComposition?: boolean

  /**
   * 일치 항목 강조 색상
   * @default '#ffff00'
   */
  highlightColor?: string

  /**
   * 현재 일치 항목 강조 색상
   * @default '#ff9900'
   */
  currentHighlightColor?: string
}

/**
 * 찾기 작업 데이터 인터페이스
 */
export interface FindData {
  /**
   * 찾을 텍스트
   */
  query: string

  /**
   * 대소문자 구분 검색
   * @default false
   */
  caseSensitive?: boolean

  /**
   * 단어 단위로만 일치
   * @default false
   */
  wholeWord?: boolean
}

/**
 * 바꾸기 작업 데이터 인터페이스
 */
export interface ReplaceData extends FindData {
  /**
   * 바꿀 텍스트
   */
  replacement: string
}

interface Match {
  node: Text
  offset: number
  length: number
  element?: HTMLElement
}

/**
 * `FindData` 타입 가드
 */
function isFindData(data: unknown): data is FindData {
  return (
    data !== null &&
    typeof data === 'object' &&
    'query' in data &&
    typeof (data as FindData).query === 'string' &&
    (data as FindData).query.trim().length > 0
  )
}

/**
 * `ReplaceData` 타입 가드
 */
function isReplaceData(data: unknown): data is ReplaceData {
  return (
    isFindData(data) &&
    'replacement' in data &&
    typeof (data as ReplaceData).replacement === 'string'
  )
}

/**
 * 요소의 모든 텍스트 노드를 가져옵니다
 */
function getTextNodes(element: Node): Text[] {
  const textNodes: Text[] = []
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)

  let node: Node | null

  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      textNodes.push(node as Text)
    }
  }

  return textNodes
}

/**
 * 문자소(grapheme) 경계 오프셋 집합.
 *
 * 정규식은 **코드유닛** 단위로 일치하므로, 질의가 결합 시퀀스의 앞부분과만
 * 같으면 그 중간에서 일치합니다. 예를 들어 `🤦` 는 `🤦🏼‍♂️` 의 앞 두
 * 코드유닛과 같아서, 그 자리를 잘라 강조하면 문자소 하나가 둘로 쪼개집니다.
 * 실제로 그렇게 되는 것을 확인했고, 바꾸기까지 가면
 * `🤦🏼‍♂️` → `X🏼‍♂️` 처럼 피부톤·ZWJ 가 고아로 남습니다.
 *
 * 그래서 일치 지점이 문자소 경계인지 검사합니다.
 * `find-replace-grapheme.browser.test.ts` 참고.
 */
function graphemeBoundaries(text: string): Set<number> {
  const boundaries = new Set<number>([0])

  for (const { index, segment } of segmenter.segment(text)) {
    boundaries.add(index + segment.length)
  }

  return boundaries
}

const segmenter = new Intl.Segmenter()

/**
 * 문자소 계산을 건너뛸 수 있는 경우.
 *
 * ASCII 만 있으면 모든 코드유닛 위치가 문자소 경계라 검사할 것이 없습니다.
 * 비-ASCII 를 하나라도 찾으면 세그멘터를 씁니다.
 */
const NON_ASCII = /[^\p{ASCII}]/u

/**
 * 단어 경계 문자류 — `\b` 를 대신합니다.
 *
 * JS 의 `\b` 는 `\w`(= `[A-Za-z0-9_]`) 기준이라 **한글에서 성립하지 않습니다.**
 * `\b사과\b` 는 "사과 사과나무 사과" 에서 하나도 못 찾습니다 — 사용자에게는
 * "일치 없음" 으로 조용히 잘못 답하는 셈입니다. 유니코드 글자류로 바꿉니다.
 */
const WORD_CLASS = '\\p{L}\\p{N}_'

function buildPattern(
  query: string,
  flags: string,
  wholeWord: boolean
): RegExp {
  const escaped = escapeRegExp(query)

  if (!wholeWord) {
    return new RegExp(escaped, flags)
  }

  try {
    return new RegExp(
      `(?<![${WORD_CLASS}])${escaped}(?![${WORD_CLASS}])`,
      `${flags}u`
    )
  } catch {
    // 짝 없는 서로게이트 등으로 `u` 플래그가 거부되면 예전 방식으로 물러섭니다
    return new RegExp(`\\b${escaped}\\b`, flags)
  }
}

/**
 * 텍스트 노드에서 일치 항목을 찾습니다
 */
function findMatches(
  element: HTMLElement,
  query: string,
  options: { caseSensitive?: boolean; wholeWord?: boolean } = {}
): Match[] {
  if (!query) {
    return []
  }

  const { caseSensitive = false, wholeWord = false } = options
  const matches: Match[] = []
  const textNodes = getTextNodes(element)

  const flags = caseSensitive ? 'g' : 'gi'
  const pattern = buildPattern(query, flags, wholeWord)

  for (const node of textNodes) {
    const text = node.textContent || ''

    /*
     * 경계는 **일치가 하나라도 나온 뒤에** 계산합니다.
     *
     * 문서 대부분의 텍스트 노드에는 일치가 없습니다. 노드마다 미리 계산하면
     * 한글 문서에서 찾기가 눈에 띄게 느려집니다 (100문단 3.2 → 12.0 ms).
     * 순수 ASCII 는 모든 위치가 경계이므로 아예 건너뜁니다.
     */
    let boundaries: Set<number> | null | undefined

    let match: RegExpExecArray | null
    pattern.lastIndex = 0

    while ((match = pattern.exec(text)) !== null) {
      if (boundaries === undefined) {
        boundaries = NON_ASCII.test(text) ? graphemeBoundaries(text) : null
      }

      const start = match.index
      const end = start + match[0].length

      // 결합 시퀀스 중간에서 자르지 않습니다
      if (boundaries && (!boundaries.has(start) || !boundaries.has(end))) {
        continue
      }

      matches.push({ node, offset: start, length: match[0].length })
    }
  }

  return matches
}

/**
 * 특수 정규식 문자를 이스케이프합니다
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 일치 항목을 강조 표시합니다
 *
 * **원본 노드에는 앞부분을 남깁니다.** 호출부는 한 노드 안의 여러 일치를
 * 오프셋 역순으로 강조하는데, 이는 앞쪽 오프셋이 그대로 유효하다는 전제입니다.
 * 예전에는 반대로 뒷부분을 남겨서 그 전제가 깨졌습니다 — 두 번째 이후의
 * 강조가 빈 노드를 잘라 **빈 `<span>`** 이 되었고, "3개 일치" 라고 세어 놓고
 * 실제로는 하나만 칠해졌습니다. ASCII 에서도 재현됩니다.
 */
function highlightMatch(match: Match, color: string): void {
  const { node, offset, length } = match

  if (!node.parentNode) return

  const text = node.textContent!
  const before = text.substring(0, offset)
  const matchText = text.substring(offset, offset + length)
  const after = text.substring(offset + length)

  const highlight = document.createElement('span')
  highlight.style.backgroundColor = color
  highlight.className = 'find-highlight'
  highlight.textContent = matchText

  const parent = node.parentNode
  const next = node.nextSibling

  node.textContent = before
  parent.insertBefore(highlight, next)

  if (after) {
    parent.insertBefore(document.createTextNode(after), next)
  }

  match.element = highlight
}

/**
 * 모든 강조 표시를 제거합니다
 */
function clearHighlights(element: HTMLElement): void {
  const highlights = element.querySelectorAll('.find-highlight')
  highlights.forEach((highlight) => {
    const parent = highlight.parentNode

    if (parent) {
      const text = document.createTextNode(highlight.textContent || '')
      parent.replaceChild(text, highlight)

      parent.normalize()
    }
  })
}

/**
 * 찾기/바꾸기 플러그인 인스턴스를 생성합니다
 *
 * 텍스트 검색 및 바꾸기 기능을 제공합니다.
 *
 * @param options - 플러그인 설정 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const findReplacePlugin = createFindReplacePlugin({
 *   highlightColor: '#ffff00',
 *   currentHighlightColor: '#ff9900'
 * });
 *
 * await pluginManager.register(findReplacePlugin);
 *
 * // Find text
 * eventBus.emit('FIND', {
 *   query: 'hello',
 *   caseSensitive: false,
 *   wholeWord: false
 * });
 *
 * // Navigate to next match
 * eventBus.emit('FIND_NEXT');
 *
 * // Replace current match
 * eventBus.emit('REPLACE', {
 *   query: 'hello',
 *   replacement: 'hi'
 * });
 *
 * // Replace all matches
 * eventBus.emit('REPLACE_ALL', {
 *   query: 'hello',
 *   replacement: 'hi'
 * });
 *
 * // Clear highlights
 * eventBus.emit('CLEAR_FIND');
 * ```
 */
export function createFindReplacePlugin(
  options: FindReplaceOptions = {}
): Plugin {
  const {
    findEventName = FindReplaceEvents.FIND,
    findNextEventName = FindReplaceEvents.FIND_NEXT,
    findPreviousEventName = FindReplaceEvents.FIND_PREVIOUS,
    replaceEventName = FindReplaceEvents.REPLACE,
    replaceAllEventName = FindReplaceEvents.REPLACE_ALL,
    clearFindEventName = FindReplaceEvents.CLEAR_FIND,
    checkComposition = true,
    highlightColor = '#ffff00',
    currentHighlightColor = '#ff9900',
  } = options

  const unsubscribers: Array<() => void> = []

  let editorElement: HTMLElement | null = null
  let currentMatches: Match[] = []
  let currentMatchIndex = -1

  return {
    name: 'utility:find-replace',

    initialize(context: EditorContext) {
      const { eventBus, config } = context

      /**
       * 찾기 상태를 한 곳에서 알립니다.
       *
       * 이전에는 `FIND_NEXT`/`FIND_PREVIOUS` 가 내부 인덱스만 바꾸고 아무것도
       * 되쏘지 않아서, UI 가 표시용 번호를 직접 같은 산술로 계산했습니다.
       * 인덱스의 주인은 여기이므로 여기서 실어 보냅니다.
       */
      const emitFindState = (
        action:
          | 'find'
          | 'next'
          | 'previous'
          | 'replace'
          | 'replaceAll'
          | 'clear',
        extra?: { replaceCount?: number }
      ): void => {
        eventBus.emit(CoreEvents.STYLE_CHANGED, {
          style: 'find',
          action,
          matchCount: currentMatches.length,
          matchIndex: currentMatchIndex,
          ...extra,
        })
      }

      const reportError = createErrorReporter(
        eventBus,
        'plugin:utility:find-replace'
      )
      const selectionManager = context.selectionManager

      editorElement =
        ('element' in config && config.element instanceof HTMLElement
          ? config.element
          : null) ||
        selectionManager?.getElement() ||
        null

      const unsubFindBefore = eventBus.on(
        findEventName,
        'before',
        (data?: unknown) => {
          if (
            isBlockedByComposition(selectionManager, checkComposition, 'Find')
          ) {
            return false
          }
          if (!isFindData(data)) {
            logger.warn('Find blocked: Invalid find data')
            return false
          }

          if (!editorElement) {
            logger.warn('Find blocked: No editor element')
            return false
          }

          return true
        }
      )

      unsubscribers.push(unsubFindBefore)

      const unsubFindOn = eventBus.on(findEventName, 'on', (data?: unknown) => {
        try {
          if (!isFindData(data) || !editorElement) {
            return false
          }

          clearHighlights(editorElement)
          currentMatches = []
          currentMatchIndex = -1

          currentMatches = findMatches(editorElement, data.query, {
            caseSensitive: data.caseSensitive,
            wholeWord: data.wholeWord,
          })

          for (let i = currentMatches.length - 1; i >= 0; i--) {
            const color = i === 0 ? currentHighlightColor : highlightColor
            highlightMatch(currentMatches[i], color)
          }

          if (currentMatches.length > 0) {
            currentMatchIndex = 0

            if (
              currentMatches[0].element &&
              typeof currentMatches[0].element.scrollIntoView === 'function'
            ) {
              currentMatches[0].element.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              })
            }
          }

          emitFindState('find')

          return true
        } catch (error) {
          reportError(error, 'Failed to find text:')
          return false
        }
      })

      unsubscribers.push(unsubFindOn)

      const unsubFindNext = eventBus.on(findNextEventName, 'on', () => {
        if (currentMatches.length === 0) {
          return false
        }

        if (
          currentMatchIndex >= 0 &&
          currentMatches[currentMatchIndex].element
        ) {
          currentMatches[currentMatchIndex].element!.style.backgroundColor =
            highlightColor
        }

        currentMatchIndex = (currentMatchIndex + 1) % currentMatches.length

        if (currentMatches[currentMatchIndex].element) {
          currentMatches[currentMatchIndex].element!.style.backgroundColor =
            currentHighlightColor

          if (
            typeof currentMatches[currentMatchIndex].element!.scrollIntoView ===
            'function'
          ) {
            currentMatches[currentMatchIndex].element!.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            })
          }
        }

        emitFindState('next')

        return true
      })
      unsubscribers.push(unsubFindNext)

      const unsubFindPrevious = eventBus.on(findPreviousEventName, 'on', () => {
        if (currentMatches.length === 0) {
          return false
        }

        if (
          currentMatchIndex >= 0 &&
          currentMatches[currentMatchIndex].element
        ) {
          currentMatches[currentMatchIndex].element!.style.backgroundColor =
            highlightColor
        }

        currentMatchIndex = currentMatchIndex - 1
        if (currentMatchIndex < 0) {
          currentMatchIndex = currentMatches.length - 1
        }

        if (currentMatches[currentMatchIndex].element) {
          currentMatches[currentMatchIndex].element!.style.backgroundColor =
            currentHighlightColor

          if (
            typeof currentMatches[currentMatchIndex].element!.scrollIntoView ===
            'function'
          ) {
            currentMatches[currentMatchIndex].element!.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            })
          }
        }

        emitFindState('previous')

        return true
      })
      unsubscribers.push(unsubFindPrevious)

      const unsubReplaceBefore = eventBus.on(
        replaceEventName,
        'before',
        (data?: unknown) => {
          if (
            isBlockedByComposition(
              selectionManager,
              checkComposition,
              'Replace'
            )
          ) {
            return false
          }
          if (!isReplaceData(data)) {
            logger.warn('Replace blocked: Invalid replace data')
            return false
          }

          if (currentMatches.length === 0 || currentMatchIndex < 0) {
            logger.warn('Replace blocked: No current match')
            return false
          }

          return true
        }
      )

      unsubscribers.push(unsubReplaceBefore)

      const unsubReplaceOn = eventBus.on(
        replaceEventName,
        'on',
        (data?: unknown) => {
          try {
            if (!isReplaceData(data)) {
              return false
            }

            if (currentMatches.length === 0 || currentMatchIndex < 0) {
              return false
            }

            const currentMatch = currentMatches[currentMatchIndex]
            if (currentMatch.element) {
              currentMatch.element.textContent = data.replacement
              currentMatch.element.style.backgroundColor = ''
              currentMatch.element.className = ''
            }

            currentMatches.splice(currentMatchIndex, 1)

            if (currentMatchIndex >= currentMatches.length) {
              currentMatchIndex = currentMatches.length - 1
            }

            if (
              currentMatchIndex >= 0 &&
              currentMatches[currentMatchIndex].element
            ) {
              currentMatches[currentMatchIndex].element!.style.backgroundColor =
                currentHighlightColor
            }

            emitFindState('replace')

            return true
          } catch (error) {
            reportError(error, 'Failed to replace text:')
            return false
          }
        }
      )

      unsubscribers.push(unsubReplaceOn)

      const unsubReplaceAllBefore = eventBus.on(
        replaceAllEventName,
        'before',
        (data?: unknown) => {
          if (
            isBlockedByComposition(
              selectionManager,
              checkComposition,
              'Replace all'
            )
          ) {
            return false
          }
          if (!isReplaceData(data)) {
            logger.warn('Replace all blocked: Invalid replace data')
            return false
          }

          if (!editorElement) {
            logger.warn('Replace all blocked: No editor element')
            return false
          }

          return true
        }
      )

      unsubscribers.push(unsubReplaceAllBefore)

      const unsubReplaceAllOn = eventBus.on(
        replaceAllEventName,
        'on',
        (data?: unknown) => {
          try {
            if (!isReplaceData(data) || !editorElement) {
              return false
            }

            clearHighlights(editorElement)

            const matches = findMatches(editorElement, data.query, {
              caseSensitive: data.caseSensitive,
              wholeWord: data.wholeWord,
            })

            const replaceCount = matches.length

            for (let i = matches.length - 1; i >= 0; i--) {
              const match = matches[i]
              const { node, offset, length } = match

              const before = node.textContent!.substring(0, offset)
              const after = node.textContent!.substring(offset + length)

              node.textContent = before + data.replacement + after
            }

            currentMatches = []
            currentMatchIndex = -1

            emitFindState('replaceAll', { replaceCount })

            return true
          } catch (error) {
            reportError(error, 'Failed to replace all text:')
            return false
          }
        }
      )

      unsubscribers.push(unsubReplaceAllOn)

      const unsubClearFind = eventBus.on(clearFindEventName, 'on', () => {
        try {
          if (!editorElement) {
            return false
          }

          clearHighlights(editorElement)

          currentMatches = []
          currentMatchIndex = -1

          emitFindState('clear')

          return true
        } catch (error) {
          reportError(error, 'Failed to clear find highlights:')
          return false
        }
      })

      unsubscribers.push(unsubClearFind)
    },

    destroy() {
      unsubscribers.forEach((unsub) => unsub())
      unsubscribers.length = 0

      if (editorElement) {
        clearHighlights(editorElement)
      }

      currentMatches = []
      currentMatchIndex = -1
      editorElement = null
    },
  }
}

/**
 * 기본 찾기/바꾸기 플러그인 인스턴스
 */
export const FindReplacePlugin = createFindReplacePlugin()
