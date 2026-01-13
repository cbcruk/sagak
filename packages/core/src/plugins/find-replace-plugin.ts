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
  const pattern = wholeWord
    ? new RegExp(`\\b${escapeRegExp(query)}\\b`, flags)
    : new RegExp(escapeRegExp(query), flags)

  for (const node of textNodes) {
    const text = node.textContent || ''

    let match: RegExpExecArray | null

    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        node,
        offset: match.index,
        length: match[0].length,
      })
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
 */
function highlightMatch(match: Match, color: string): void {
  const { node, offset, length } = match

  if (!node.parentNode) return

  const before = node.textContent!.substring(0, offset)
  const matchText = node.textContent!.substring(offset, offset + length)
  const after = node.textContent!.substring(offset + length)

  const highlight = document.createElement('span')
  highlight.style.backgroundColor = color
  highlight.className = 'find-highlight'
  highlight.textContent = matchText

  const parent = node.parentNode

  if (before) {
    parent.insertBefore(document.createTextNode(before), node)
  }
  parent.insertBefore(highlight, node)

  node.textContent = after

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
          if (checkComposition && selectionManager?.getIsComposing()) {
            console.warn('Find blocked: IME composition in progress')
            return false
          }

          if (!isFindData(data)) {
            console.warn('Find blocked: Invalid find data')
            return false
          }

          if (!editorElement) {
            console.warn('Find blocked: No editor element')
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

          eventBus.emit(CoreEvents.STYLE_CHANGED, {
            style: 'find',
            action: 'find',
            matchCount: currentMatches.length,
          })

          return true
        } catch (error) {
          console.error('Failed to find text:', error)
          return false
        }
      })

      unsubscribers.push(unsubFindOn)

      const unsubFindAfter = eventBus.on(findEventName, 'after', () => {})

      unsubscribers.push(unsubFindAfter)

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

        return true
      })
      unsubscribers.push(unsubFindPrevious)

      const unsubReplaceBefore = eventBus.on(
        replaceEventName,
        'before',
        (data?: unknown) => {
          if (checkComposition && selectionManager?.getIsComposing()) {
            console.warn('Replace blocked: IME composition in progress')
            return false
          }

          if (!isReplaceData(data)) {
            console.warn('Replace blocked: Invalid replace data')
            return false
          }

          if (currentMatches.length === 0 || currentMatchIndex < 0) {
            console.warn('Replace blocked: No current match')
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

            eventBus.emit(CoreEvents.STYLE_CHANGED, {
              style: 'find',
              action: 'replace',
              matchCount: currentMatches.length,
            })

            return true
          } catch (error) {
            console.error('Failed to replace text:', error)
            return false
          }
        }
      )

      unsubscribers.push(unsubReplaceOn)

      const unsubReplaceAfter = eventBus.on(replaceEventName, 'after', () => {})

      unsubscribers.push(unsubReplaceAfter)

      const unsubReplaceAllBefore = eventBus.on(
        replaceAllEventName,
        'before',
        (data?: unknown) => {
          if (checkComposition && selectionManager?.getIsComposing()) {
            console.warn('Replace all blocked: IME composition in progress')
            return false
          }

          if (!isReplaceData(data)) {
            console.warn('Replace all blocked: Invalid replace data')
            return false
          }

          if (!editorElement) {
            console.warn('Replace all blocked: No editor element')
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

            eventBus.emit(CoreEvents.STYLE_CHANGED, {
              style: 'find',
              action: 'replaceAll',
              replaceCount,
            })

            return true
          } catch (error) {
            console.error('Failed to replace all text:', error)
            return false
          }
        }
      )

      unsubscribers.push(unsubReplaceAllOn)

      const unsubReplaceAllAfter = eventBus.on(
        replaceAllEventName,
        'after',
        () => {}
      )

      unsubscribers.push(unsubReplaceAllAfter)

      const unsubClearFind = eventBus.on(clearFindEventName, 'on', () => {
        try {
          if (!editorElement) {
            return false
          }

          clearHighlights(editorElement)

          currentMatches = []
          currentMatchIndex = -1

          eventBus.emit(CoreEvents.STYLE_CHANGED, {
            style: 'find',
            action: 'clear',
          })

          return true
        } catch (error) {
          console.error('Failed to clear find highlights:', error)
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
