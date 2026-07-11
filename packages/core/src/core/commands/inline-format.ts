import { closestEditableHost } from './selection-blocks'

/**
 * 인라인 서식 정의
 */
export interface InlineFormat {
  /** 적용 시 생성할 태그 */
  tag: string
  /** 이 서식으로 인정되는 태그 목록 (소문자) */
  matchTags: string[]
}

/**
 * 토글형 인라인 서식 테이블 (커맨드 이름 → 서식)
 *
 * 정규형 원칙: 적용 시 항상 `tag`의 요소를 생성하고, 인접한 동일 서식
 * 요소는 병합합니다. 기존 콘텐츠의 별칭 태그(`b`, `i` 등)도 서식으로
 * 인식·해제할 수 있습니다.
 */
export const INLINE_FORMATS: Record<string, InlineFormat> = {
  bold: { tag: 'strong', matchTags: ['strong', 'b'] },
  italic: { tag: 'em', matchTags: ['em', 'i'] },
  underline: { tag: 'u', matchTags: ['u'] },
  strikeThrough: { tag: 's', matchTags: ['s', 'strike', 'del'] },
  subscript: { tag: 'sub', matchTags: ['sub'] },
  superscript: { tag: 'sup', matchTags: ['sup'] },
}

/**
 * 서로 배타적인 서식 쌍 (한쪽 적용 시 다른 쪽 해제)
 */
const EXCLUSIVE_PAIRS: Record<string, string> = {
  subscript: 'superscript',
  superscript: 'subscript',
}

/**
 * 노드에서 호스트까지 조상 중 서식 요소를 찾습니다
 */
export function findFormatAncestor(
  node: Node,
  format: InlineFormat,
  host: HTMLElement
): HTMLElement | null {
  let current: Node | null = node

  while (current && current !== host) {
    if (
      current instanceof HTMLElement &&
      format.matchTags.includes(current.tagName.toLowerCase())
    ) {
      return current
    }
    current = current.parentNode
  }

  return null
}

/**
 * 범위 경계가 텍스트 노드 중간이면 분할하여 노드 경계에 맞춥니다
 */
export function splitBoundaries(range: Range): void {
  const { endContainer, endOffset } = range
  if (
    endContainer.nodeType === Node.TEXT_NODE &&
    endOffset > 0 &&
    endOffset < (endContainer as Text).length
  ) {
    ;(endContainer as Text).splitText(endOffset)
    range.setEnd(endContainer, endOffset)
  }

  const { startContainer, startOffset } = range
  if (
    startContainer.nodeType === Node.TEXT_NODE &&
    startOffset > 0 &&
    startOffset < (startContainer as Text).length
  ) {
    const second = (startContainer as Text).splitText(startOffset)
    range.setStart(second, 0)
  }
}

/**
 * 범위와 겹치는(비어있지 않은) 텍스트 노드를 수집합니다
 *
 * `splitBoundaries` 이후에 호출하면 모든 노드가 범위에 완전히 포함됩니다.
 */
export function textNodesInRange(range: Range, host: HTMLElement): Text[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)

  let current = walker.nextNode()
  while (current) {
    const text = current as Text
    if (text.length > 0 && range.intersectsNode(text)) {
      // 경계에 닿기만 한(겹침 없는) 노드는 제외합니다
      const nodeRange = document.createRange()
      nodeRange.selectNodeContents(text)
      if (
        range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
        range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0
      ) {
        nodes.push(text)
      }
    }
    current = walker.nextNode()
  }

  return nodes
}

/**
 * 조상을 분할하여 `node`의 가지만 담은 `ancestor` 레벨 요소를 만듭니다
 *
 * `ancestor` 안에서 `node`의 형제(및 중간 조상들의 형제)를 앞뒤 복제본으로
 * 분리해, 반환되는 `ancestor`가 `node`로 이어지는 가지만 담게 합니다.
 * 중간 래퍼(예: 제거 대상이 아닌 다른 서식)는 보존됩니다.
 */
export function isolateBranch(node: Node, ancestor: HTMLElement): HTMLElement {
  let current: Node = node

  while (current.parentNode !== ancestor.parentNode) {
    const parent = current.parentNode as HTMLElement

    if (current.previousSibling) {
      const before = parent.cloneNode(false) as HTMLElement
      while (current.previousSibling) {
        before.insertBefore(current.previousSibling, before.firstChild)
      }
      parent.parentNode!.insertBefore(before, parent)
    }

    if (current.nextSibling) {
      const after = parent.cloneNode(false) as HTMLElement
      while (current.nextSibling) {
        after.appendChild(current.nextSibling)
      }
      parent.parentNode!.insertBefore(after, parent.nextSibling)
    }

    current = parent
  }

  return current as HTMLElement
}

/**
 * 요소를 제거하고 자식을 그 자리에 남깁니다
 */
export function unwrapElement(el: HTMLElement): void {
  const parent = el.parentNode
  if (!parent) return

  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el)
  }
  parent.removeChild(el)
}

/**
 * 인접한 동일 서식 요소를 병합합니다 (정규형 유지)
 *
 * 속성이 없는 동일 태그 형제만 병합합니다.
 */
function mergeAdjacent(el: HTMLElement): void {
  const prev = el.previousSibling
  if (
    prev instanceof HTMLElement &&
    prev.tagName === el.tagName &&
    prev.attributes.length === 0 &&
    el.attributes.length === 0
  ) {
    while (prev.firstChild) {
      el.insertBefore(prev.firstChild, el.firstChild)
    }
    prev.remove()
  }

  const next = el.nextSibling
  if (
    next instanceof HTMLElement &&
    next.tagName === el.tagName &&
    next.attributes.length === 0 &&
    el.attributes.length === 0
  ) {
    while (next.firstChild) {
      el.appendChild(next.firstChild)
    }
    next.remove()
  }
}

/**
 * 텍스트 노드들 위로 선택 영역을 복원합니다
 */
export function restoreSelection(nodes: Text[]): void {
  if (nodes.length === 0) return

  const selection = window.getSelection()
  if (!selection) return

  const range = document.createRange()
  range.setStart(nodes[0], 0)
  range.setEnd(nodes[nodes.length - 1], nodes[nodes.length - 1].length)
  selection.removeAllRanges()
  selection.addRange(range)
}

/**
 * 서식을 범위의 텍스트 노드들에 적용합니다
 */
function applyFormat(
  nodes: Text[],
  format: InlineFormat,
  host: HTMLElement
): void {
  for (const node of nodes) {
    if (findFormatAncestor(node, format, host)) continue

    const wrapper = document.createElement(format.tag)
    node.parentNode!.insertBefore(wrapper, node)
    wrapper.appendChild(node)
    mergeAdjacent(wrapper)
  }
}

/**
 * 범위의 텍스트 노드들에서 서식을 해제합니다
 */
function removeFormat(
  nodes: Text[],
  format: InlineFormat,
  host: HTMLElement
): void {
  for (const node of nodes) {
    // 중첩된 동일 서식(예: strong 안의 b)이 있을 수 있으므로 반복 해제합니다
    let ancestor = findFormatAncestor(node, format, host)
    while (ancestor) {
      const isolated = isolateBranch(node, ancestor)
      unwrapElement(isolated)
      ancestor = findFormatAncestor(node, format, host)
    }
  }
}

/**
 * 현재 선택 범위에 인라인 서식을 토글합니다
 *
 * 범위의 모든 텍스트가 이미 해당 서식이면 해제하고, 아니면 (미서식 구간에)
 * 적용합니다. 적용 시 항상 정규 태그(`strong`, `em` 등)를 생성하며 인접한
 * 동일 서식 요소는 병합합니다. 해제는 별칭 태그(`b`, `i` 등)도 인식합니다.
 *
 * @param formatName `INLINE_FORMATS`의 키 (예: `'bold'`)
 * @returns 성공 시 `true`, 판단 불가 시 `undefined` (레거시 위임)
 *          — 선택 없음 / collapsed 커서(타이핑 상태는 레거시가 처리) /
 *            편집 호스트 없음 / 텍스트 노드 없음
 */
export function toggleInlineFormat(formatName: string): boolean | undefined {
  const format = INLINE_FORMATS[formatName]
  if (!format) return undefined

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return undefined

  const range = selection.getRangeAt(0)
  // collapsed 커서의 토글(타이핑 상태)은 execCommand의 내부 상태가 필요하므로
  // 레거시에 위임합니다
  if (range.collapsed) return undefined

  const host = closestEditableHost(range.commonAncestorContainer)
  if (!host) return undefined

  splitBoundaries(range)
  const nodes = textNodesInRange(range, host)
  if (nodes.length === 0) return undefined

  const allFormatted = nodes.every((node) =>
    findFormatAncestor(node, format, host)
  )

  if (allFormatted) {
    removeFormat(nodes, format, host)
  } else {
    // 배타 서식(sub ↔ sup)은 적용 전에 해제합니다
    const exclusive = EXCLUSIVE_PAIRS[formatName]
    if (exclusive) {
      removeFormat(nodes, INLINE_FORMATS[exclusive], host)
    }
    applyFormat(nodes, format, host)
  }

  restoreSelection(nodes)
  return true
}
