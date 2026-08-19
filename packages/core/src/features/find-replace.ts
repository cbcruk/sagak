import type { Node as PMNode } from 'prosemirror-model'
import type { EditorContext, Highlighter } from '@/core'
import { modelHandle, runModelCommand } from '@/model/bridge'

/**
 * 찾기/바꾸기 — **모듈 API 입니다.**
 *
 * ## 왜 플러그인이 아닌가
 *
 * 예전에는 이벤트 여섯(`FIND`·`FIND_NEXT`·`FIND_PREVIOUS`·`REPLACE`·
 * `REPLACE_ALL`·`CLEAR_FIND`)을 받는 플러그인이었고, 상태(일치 목록·현재
 * 번호)는 `STYLE_CHANGED` 에 `style: 'find'` 를 실어 되쏘았습니다.
 *
 * 그 여섯은 **객체 하나의 메서드**입니다. 이름을 문자열로 주고받는 동안
 * 오타는 조용히 아무 일도 안 하는 것이 됐고, 되쏘는 상태는 서식 알림에
 * 얹혀 갔습니다 — 남의 봉투에 편지를 넣는 꼴입니다.
 *
 * ## 상태는 부른 자리에서 돌아옵니다
 *
 * 일치 개수와 현재 번호는 **메서드의 반환값**입니다. 버스로 오갈 때는 요청과
 * 답이 서로 다른 이름으로 갈라져 있어서, 부르는 쪽이 답이 올 때까지 구독을
 * 걸어 두고 기다려야 했습니다. 그럴 이유가 없습니다 — 이 일은 동기입니다.
 */
export interface FindOptions {
  caseSensitive?: boolean
  wholeWord?: boolean
}

export interface FindState {
  /** 찾은 개수 */
  matches: number
  /** 지금 몇 번째인가 — 없으면 `-1` */
  index: number
  /**
   * 방금 `replaceAll` 이 바꾼 개수.
   *
   * **없으면 바꾸기가 돌지 않았다는 뜻입니다** — 조합 중이라 막혔거나
   * 질의가 비었거나, 애초에 다른 메서드를 부른 것입니다. 0 과 구분됩니다.
   */
  replaced?: number
}

export interface FindReplace {
  find(query: string, options?: FindOptions): FindState
  next(): FindState
  previous(): FindState
  replace(replacement: string): FindState
  replaceAll(query: string, replacement: string, options?: FindOptions): FindState
  clear(): FindState
}

const HIGHLIGHT = '#ffff00'
const CURRENT = '#ff9900'

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
 * 에디터 하나당 하나입니다 — 일치 목록이 그 에디터의 상태이기 때문입니다.
 */
const modules = new WeakMap<EditorContext, FindReplace>()

export function findReplace(context: EditorContext): FindReplace {
  const existing = modules.get(context)

  if (existing) return existing

  const module = create(context)

  modules.set(context, module)

  return module
}

function create(context: EditorContext): FindReplace {
  let matches: Match[] = []
  let index = -1
  let lastHighlighter: Highlighter | undefined

  /**
   * 편집 영역은 **부를 때마다 다시 묻습니다.**
   *
   * 모드를 오가면 영역이 바뀌고, 소스·텍스트 모드에는 문서 모델이 아예
   * 없습니다. 한 번 잡아 두면 그 뒤로 엉뚱한 곳을 가리킵니다.
   */
  const highlighter = (): Highlighter | undefined => {
    lastHighlighter =
      context.editingAreaManager?.getCurrentArea()?.getHighlighter?.() ??
      lastHighlighter

    return lastHighlighter
  }

  const paint = (): void => {
    highlighter()?.set(
      matches.map((match, i) => ({
        from: match.from,
        to: match.to,
        className: 'find-highlight',
        style: `background-color: ${i === index ? CURRENT : HIGHLIGHT}`,
      }))
    )
  }

  const reveal = (): void => {
    if (index < 0) return

    highlighter()?.scrollTo(matches[index].from)
  }

  const snapshot = (replaced?: number): FindState => ({
    matches: matches.length,
    index,
    ...(replaced === undefined ? {} : { replaced }),
  })

  const step = (delta: number): FindState => {
    if (matches.length === 0) return snapshot()

    index = (index + delta + matches.length) % matches.length

    paint()
    reveal()

    return snapshot()
  }

  return {
    find(query, options = {}) {
      const state = modelHandle(context)?.getState()

      if (!state || !query.trim()) return this.clear()

      matches = findMatches(state.doc, query, options)
      index = matches.length > 0 ? 0 : -1

      paint()
      reveal()

      return snapshot()
    },

    next: () => step(1),
    previous: () => step(-1),

    replace(replacement) {
      const handle = modelHandle(context)

      if (!handle?.getState() || matches.length === 0 || index < 0) {
        return snapshot()
      }

      const target = matches[index]
      let mapped = matches

      /* 문서를 고치므로 조합 가드를 지납니다 */
      const done = runModelCommand(context, (state, dispatch) => {
        const tr = state.tr.insertText(replacement, target.from, target.to)

        /*
         * 남은 일치는 **다시 찾지 않고 자리만 옮깁니다.**
         *
         * 다시 찾으면 바꿔 넣은 글이 질의를 품고 있을 때(`a` → `aa`) 방금
         * 만든 것이 새 일치로 잡혀 끝나지 않습니다.
         */
        mapped = matches
          .filter((_, i) => i !== index)
          .map((match) => ({
            from: tr.mapping.map(match.from),
            to: tr.mapping.map(match.to),
          }))

        dispatch?.(tr)

        return true
      })

      if (!done) return snapshot()

      matches = mapped

      if (index >= matches.length) index = matches.length - 1

      paint()

      return snapshot()
    },

    replaceAll(query, replacement, options = {}) {
      const state = modelHandle(context)?.getState()

      if (!state || !query.trim()) return this.clear()

      const found = findMatches(state.doc, query, options)

      if (found.length === 0) {
        this.clear()

        return snapshot(0)
      }

      const done = runModelCommand(context, (current, dispatch) => {
        /* 뒤에서부터 갑니다 — 앞쪽 자리가 그대로 유효합니다 */
        const tr = current.tr

        for (let i = found.length - 1; i >= 0; i -= 1) {
          tr.insertText(replacement, found[i].from, found[i].to)
        }

        dispatch?.(tr)

        return true
      })

      if (!done) return snapshot()

      matches = []
      index = -1
      highlighter()?.clear()

      return snapshot(found.length)
    },

    clear() {
      matches = []
      index = -1
      highlighter()?.clear()

      return snapshot()
    },
  }
}
