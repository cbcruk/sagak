import type { CommandRegistry } from '../command-registry'

/**
 * **화면에 실제로 그려진 값**을 묻는 조회.
 *
 * 커맨드 레지스트리에 남은 마지막 DOM 층입니다. 나머지는 전부 모델이 답하는데
 * 이것만 못 합니다 — 서식 없는 글의 크기는 스타일시트가 정하고, 문서에는 그런
 * 마크가 없기 때문입니다.
 *
 * ```
 * <p>서식 없는 글</p>
 *   모델    → 없음        (마크가 안 걸려 있음)
 *   화면    → 15px        (스타일시트)
 * ```
 *
 * 모델 조회가 `undefined` 를 주면 precedence 체인이 여기로 넘어옵니다. 툴바가
 * 기본값을 가리키는 대신 진짜 크기를 보여 주는 이유이고, **가장 흔한 경우**가
 * 이쪽입니다.
 *
 * 반대로 글에 크기가 걸려 있으면 모델이 먼저 답하므로 여기까지 안 옵니다.
 */
export const COMPUTED_PRECEDENCE = 0

/**
 * 범위가 실제로 시작하는 노드를 찾습니다.
 *
 * `startContainer` 가 늘 내용은 아닙니다. 범위가 **요소 경계에서** 시작하면
 * 컨테이너는 그 요소 자신이고, 첫 글자는 `childNodes[startOffset]` 안에
 * 있습니다. 전체 선택(⌘A)이 그런 모양입니다.
 *
 * 그걸 그대로 기준으로 삼으면 계산된 스타일이 편집 영역의 기본값을 읽습니다 —
 * 굵은 글만 든 문단을 ⌘A 해도 편집 영역의 글꼴 크기가 나옵니다.
 */
function descend(node: Node, edge: 'first' | 'last'): Node {
  let current = node

  while (current.nodeType === Node.ELEMENT_NODE) {
    const next = edge === 'first' ? current.firstChild : current.lastChild
    if (!next) break
    current = next
  }

  return current
}

function rangeStartNode(range: Range): Node {
  const container = range.startContainer

  if (container.nodeType !== Node.ELEMENT_NODE) return container

  const after = container.childNodes[range.startOffset]
  if (after) return descend(after, 'first')

  /* 뒤에 아무것도 없으면 앞의 것이 기준입니다 — 문단 끝의 캐럿이 그렇습니다 */
  const before = container.childNodes[range.startOffset - 1]
  if (before) return descend(before, 'last')

  return container
}

/** 편집 가능한 조상 — 선택이 에디터 밖이면 답하지 않기 위해서입니다 */
function isInsideEditable(node: Node | null): boolean {
  let current: Node | null = node

  while (current) {
    if (current instanceof HTMLElement && current.isContentEditable) {
      return true
    }
    current = current.parentNode
  }

  return false
}

function nearestElement(node: Node): HTMLElement | null {
  let current: Node | null = node

  while (current && current.nodeType !== Node.ELEMENT_NODE) {
    current = current.parentNode
  }

  return current instanceof HTMLElement ? current : null
}

/** 상속을 포함해 계산된 CSS 값 — 없으면 `undefined` 로 답하지 않습니다 */
function computed(prop: 'fontFamily' | 'fontSize'): string | undefined {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) return undefined

  const node = rangeStartNode(selection.getRangeAt(0))

  if (!isInsideEditable(node)) return undefined

  const element = nearestElement(node)

  return element ? window.getComputedStyle(element)[prop] || undefined : undefined
}

/**
 * 화면 값을 묻는 조회를 등록합니다.
 *
 * `fontSize` 와 `fontSizeCss` 가 **같은 답**을 줍니다. 예전에는 앞의 것이
 * `execCommand` 시절의 1–7 스케일로 눌러 답해서 15px 과 16px 을 구분하지
 * 못했고, 그래서 손실 없는 이름을 하나 더 뒀습니다. 눌러 답할 이유가
 * 없어졌으니 둘 다 CSS 를 줍니다 — 이름 둘은 부르는 쪽이 있어 남깁니다.
 */
export function registerComputedQueries(registry: CommandRegistry): () => void {
  const unsubs: Array<() => void> = []

  const value = (name: string, prop: 'fontFamily' | 'fontSize'): void => {
    unsubs.push(
      registry.registerValueQuery(name, () => computed(prop), COMPUTED_PRECEDENCE)
    )
  }

  value('fontName', 'fontFamily')
  value('fontSize', 'fontSize')
  value('fontSizeCss', 'fontSize')

  return () => {
    for (const unsub of unsubs) unsub()
  }
}
