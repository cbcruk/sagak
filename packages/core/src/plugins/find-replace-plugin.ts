import type { Node as PMNode } from 'prosemirror-model'
import { logger } from '@/core/logger'
import { isBlockedByComposition } from '@/core/composition-guard'
import { createErrorReporter } from '@/core/errors'
import type { Plugin, EditorContext, Highlighter } from '@/core'
import { FindReplaceEvents, CoreEvents } from '@/core'
import { modelHandle } from '@/model/bridge'

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

/**
 * 일치 하나 — **모델 좌표**입니다.
 *
 * 예전에는 `{node: Text, offset, length}` 로 DOM 을 가리켰고, 강조도 그 자리에
 * `<span>` 을 끼워 넣어 만들었습니다. 편집 영역이 문서 모델을 갖게 되면서
 * 그 span 이 **문서의 일부가 됩니다** — 찾기를 한 번 했다고 글에 배경색이
 * 칠해지고 저장물에도 들어갑니다.
 *
 * 정수 둘로 바뀌면서 강조는 데코레이션(화면에만 있는 것)이 되고, 바꾸기는
 * 트랜잭션이 됩니다. 문서가 바뀌어도 남은 일치의 자리는 매핑으로 따라옵니다.
 */
interface Match {
  from: number
  to: number
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
 * 문서에서 일치 항목을 찾습니다.
 *
 * 텍스트 조각 하나 안에서만 찾습니다 — 서식이 바뀌는 자리에서 조각이 갈리므로
 * `<b>사</b>과` 의 "사과" 는 안 잡힙니다. DOM 텍스트 노드를 훑던 예전과 같은
 * 성질이라 동작은 그대로입니다.
 */
function findMatches(
  doc: PMNode,
  query: string,
  options: { caseSensitive?: boolean; wholeWord?: boolean } = {}
): Match[] {
  if (!query) {
    return []
  }

  const { caseSensitive = false, wholeWord = false } = options
  const matches: Match[] = []

  const flags = caseSensitive ? 'g' : 'gi'
  const pattern = buildPattern(query, flags, wholeWord)

  doc.descendants((node, pos) => {
    if (!node.isText) {
      return true
    }

    const text = node.text ?? ''

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

      matches.push({ from: pos + start, to: pos + end })
    }

    return false
  })

  return matches
}

/**
 * 특수 정규식 문자를 이스케이프합니다
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

  let currentMatches: Match[] = []
  let currentMatchIndex = -1
  let highlighter: Highlighter | undefined

  return {
    name: 'utility:find-replace',

    initialize(context: EditorContext) {
      const { eventBus } = context

      const reportError = createErrorReporter(
        eventBus,
        'plugin:utility:find-replace'
      )
      const selectionManager = context.selectionManager

      /**
       * 편집 영역은 **부를 때마다 다시 묻습니다.**
       *
       * 모드를 오가면 영역이 바뀌고, 소스·텍스트 모드에는 문서 모델이 아예
       * 없습니다. 초기화 때 한 번 잡아 두면 그 뒤로 엉뚱한 곳을 가리킵니다.
       */
      const area = () => context.editingAreaManager?.getCurrentArea()
      const state = () => modelHandle(context)?.getState() ?? null

      const paint = (): void => {
        highlighter = area()?.getHighlighter?.() ?? highlighter

        highlighter?.set(
          currentMatches.map((match, i) => ({
            from: match.from,
            to: match.to,
            className: 'find-highlight',
            style: `background-color: ${
              i === currentMatchIndex ? currentHighlightColor : highlightColor
            }`,
          }))
        )
      }

      const clear = (): void => {
        currentMatches = []
        currentMatchIndex = -1
        ;(area()?.getHighlighter?.() ?? highlighter)?.clear()
      }

      const reveal = (): void => {
        if (currentMatchIndex < 0) return

        ;(area()?.getHighlighter?.() ?? highlighter)?.scrollTo(
          currentMatches[currentMatchIndex].from
        )
      }

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

      unsubscribers.push(
        eventBus.on(findEventName, 'before', (data?: unknown) => {
          if (
            isBlockedByComposition(selectionManager, checkComposition, 'Find')
          ) {
            return false
          }

          if (!isFindData(data)) {
            logger.warn('Find blocked: Invalid find data')
            return false
          }

          if (!state()) {
            logger.warn('Find blocked: No document')
            return false
          }

          return true
        })
      )

      unsubscribers.push(
        eventBus.on(findEventName, 'on', (data?: unknown) => {
          try {
            const current = state()

            if (!isFindData(data) || !current) {
              return false
            }

            currentMatches = findMatches(current.doc, data.query, {
              caseSensitive: data.caseSensitive,
              wholeWord: data.wholeWord,
            })
            currentMatchIndex = currentMatches.length > 0 ? 0 : -1

            paint()
            reveal()
            emitFindState('find')

            return true
          } catch (error) {
            reportError(error, 'Failed to find text:')
            return false
          }
        })
      )

      /** 다음·이전은 인덱스만 옮깁니다 — 문서는 그대로입니다 */
      const step = (
        delta: number,
        action: 'next' | 'previous'
      ): (() => boolean) => {
        return () => {
          if (currentMatches.length === 0) {
            return false
          }

          currentMatchIndex =
            (currentMatchIndex + delta + currentMatches.length) %
            currentMatches.length

          paint()
          reveal()
          emitFindState(action)

          return true
        }
      }

      unsubscribers.push(eventBus.on(findNextEventName, 'on', step(1, 'next')))
      unsubscribers.push(
        eventBus.on(findPreviousEventName, 'on', step(-1, 'previous'))
      )

      unsubscribers.push(
        eventBus.on(replaceEventName, 'before', (data?: unknown) => {
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
        })
      )

      unsubscribers.push(
        eventBus.on(replaceEventName, 'on', (data?: unknown) => {
          try {
            const handle = modelHandle(context)
            const current = handle?.getState()

            if (!isReplaceData(data) || !handle || !current) {
              return false
            }

            if (currentMatches.length === 0 || currentMatchIndex < 0) {
              return false
            }

            eventBus.emit(CoreEvents.CAPTURE_SNAPSHOT)

            const target = currentMatches[currentMatchIndex]
            const tr = current.tr.insertText(
              data.replacement,
              target.from,
              target.to
            )

            handle.dispatch(tr)

            /*
             * 남은 일치는 **다시 찾지 않고 자리만 옮깁니다.**
             *
             * 다시 찾으면 바꿔 넣은 글이 질의를 품고 있을 때(`a` → `aa`)
             * 방금 만든 것이 새 일치로 잡혀 끝나지 않습니다.
             */
            currentMatches = currentMatches
              .filter((_, i) => i !== currentMatchIndex)
              .map((match) => ({
                from: tr.mapping.map(match.from),
                to: tr.mapping.map(match.to),
              }))

            if (currentMatchIndex >= currentMatches.length) {
              currentMatchIndex = currentMatches.length - 1
            }

            paint()
            emitFindState('replace')

            return true
          } catch (error) {
            reportError(error, 'Failed to replace text:')
            return false
          }
        })
      )

      unsubscribers.push(
        eventBus.on(replaceAllEventName, 'before', (data?: unknown) => {
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

          if (!state()) {
            logger.warn('Replace all blocked: No document')
            return false
          }

          return true
        })
      )

      unsubscribers.push(
        eventBus.on(replaceAllEventName, 'on', (data?: unknown) => {
          try {
            const handle = modelHandle(context)
            const current = handle?.getState()

            if (!isReplaceData(data) || !handle || !current) {
              return false
            }

            const matches = findMatches(current.doc, data.query, {
              caseSensitive: data.caseSensitive,
              wholeWord: data.wholeWord,
            })

            if (matches.length === 0) {
              clear()
              emitFindState('replaceAll', { replaceCount: 0 })

              return true
            }

            eventBus.emit(CoreEvents.CAPTURE_SNAPSHOT)

            /* 뒤에서부터 갑니다 — 앞쪽 자리가 그대로 유효합니다 */
            const tr = current.tr

            for (let i = matches.length - 1; i >= 0; i -= 1) {
              tr.insertText(data.replacement, matches[i].from, matches[i].to)
            }

            handle.dispatch(tr)
            clear()
            emitFindState('replaceAll', { replaceCount: matches.length })

            return true
          } catch (error) {
            reportError(error, 'Failed to replace all text:')
            return false
          }
        })
      )

      unsubscribers.push(
        eventBus.on(clearFindEventName, 'on', () => {
          try {
            clear()
            emitFindState('clear')

            return true
          } catch (error) {
            reportError(error, 'Failed to clear find highlights:')
            return false
          }
        })
      )
    },

    destroy() {
      unsubscribers.forEach((unsub) => unsub())
      unsubscribers.length = 0

      highlighter?.clear()
      highlighter = undefined
      currentMatches = []
      currentMatchIndex = -1
    },
  }
}

/**
 * 기본 찾기/바꾸기 플러그인 인스턴스
 */
export const FindReplacePlugin = createFindReplacePlugin()
