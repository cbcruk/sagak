import { closestEditableHost } from './selection-blocks'
import {
  splitBoundaries,
  textNodesInRange,
  restoreSelection,
  isolateBranch,
  unwrapElement,
  findFormatAncestor,
  type InlineFormat,
} from './inline-format'

/**
 * 인라인 스타일로 적용 가능한 CSS 속성
 */
export type InlineStyleProp = 'color' | 'backgroundColor' | 'fontFamily'

/**
 * 링크 서식 정의 (조상 탐색용)
 */
const LINK_FORMAT: InlineFormat = { tag: 'a', matchTags: ['a'] }

/**
 * 요소가 스타일 속성만 가진 `span`인지 확인합니다
 */
function isStyleOnlySpan(el: HTMLElement): boolean {
  return (
    el.tagName === 'SPAN' &&
    Array.from(el.attributes).every((attr) => attr.name === 'style')
  )
}

/**
 * 인접한 형제가 동일한 요소(태그·속성 일치)면 병합합니다
 */
function mergeAdjacentIdentical(el: HTMLElement): void {
  const isSame = (other: Node | null): other is HTMLElement =>
    other instanceof HTMLElement &&
    other.tagName === el.tagName &&
    other.attributes.length === el.attributes.length &&
    Array.from(other.attributes).every(
      (attr) => el.getAttribute(attr.name) === attr.value
    )

  const prev = el.previousSibling
  if (isSame(prev)) {
    while (prev.firstChild) {
      el.insertBefore(prev.firstChild, el.firstChild)
    }
    prev.remove()
  }

  const next = el.nextSibling
  if (isSame(next)) {
    while (next.firstChild) {
      el.appendChild(next.firstChild)
    }
    next.remove()
  }
}

/**
 * 범위 준비: 경계 분할 후 범위의 텍스트 노드를 수집합니다 (코어)
 *
 * functional core / imperative shell 원칙에 따라 전역 selection에
 * 접근하지 않고 인자로 받은 `Range`에만 동작합니다.
 *
 * @param range 대상 범위 (경계 분할로 변형될 수 있음)
 * @returns 텍스트 노드와 호스트, 판단 불가 시 `null`
 */
function prepareRange(
  range: Range
): { nodes: Text[]; host: HTMLElement } | null {
  // collapsed 범위의 스타일 적용(타이핑 상태)은 레거시에 위임합니다
  if (range.collapsed) return null

  const host = closestEditableHost(range.commonAncestorContainer)
  if (!host) return null

  splitBoundaries(range)
  const nodes = textNodesInRange(range, host)
  if (nodes.length === 0) return null

  return { nodes, host }
}

/**
 * 전역 selection에서 범위를 읽어 준비합니다 (셸)
 */
function prepareSelection(): { nodes: Text[]; host: HTMLElement } | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  return prepareRange(selection.getRangeAt(0))
}

/**
 * 현재 선택 범위에 인라인 스타일을 적용합니다
 *
 * `execCommand('foreColor'|'backColor'|'fontName')` 대신 텍스트 노드를
 * `<span style="...">`로 감싸거나, 이미 스타일 전용 `span`에 단독으로
 * 담겨 있으면 그 `span`의 속성을 갱신합니다. 인접한 동일 스타일 `span`은
 * 병합해 정규형을 유지합니다.
 *
 * @param prop 적용할 CSS 속성
 * @param value 적용할 값 (예: `'#ff0000'`, `'Georgia'`)
 * @returns 성공 시 `true`, 판단 불가 시 `undefined` (레거시 위임)
 */
export function applyInlineStyle(
  prop: InlineStyleProp,
  value: string
): boolean | undefined {
  const prepared = prepareSelection()
  if (!prepared) return undefined

  restoreSelection(applyStyleToNodes(prepared.nodes, prop, value))
  return true
}

/**
 * 주어진 범위에 인라인 스타일을 적용합니다 (코어 — 전역 selection 미접근)
 *
 * @param range 대상 범위 (경계 분할로 변형될 수 있음)
 * @param prop 적용할 CSS 속성
 * @param value 적용할 값
 * @returns 영향받은 텍스트 노드, 판단 불가 시 `null`
 */
export function applyInlineStyleInRange(
  range: Range,
  prop: InlineStyleProp,
  value: string
): Text[] | null {
  const prepared = prepareRange(range)
  if (!prepared) return null

  return applyStyleToNodes(prepared.nodes, prop, value)
}

/**
 * 텍스트 노드들에 인라인 스타일을 적용합니다
 */
function applyStyleToNodes(
  nodes: Text[],
  prop: InlineStyleProp,
  value: string
): Text[] {
  for (const node of nodes) {
    const parent = node.parentElement

    if (parent && isStyleOnlySpan(parent) && parent.childNodes.length === 1) {
      // 스타일 전용 span에 단독으로 담긴 경우 재사용합니다 (중첩 방지)
      parent.style[prop] = value
      mergeAdjacentIdentical(parent)
    } else {
      const span = document.createElement('span')
      span.style[prop] = value
      node.parentNode!.insertBefore(span, node)
      span.appendChild(node)
      mergeAdjacentIdentical(span)
    }
  }

  return nodes
}

/**
 * 현재 선택 범위를 링크로 만듭니다
 *
 * `execCommand('createLink')` 대신 텍스트 노드를 `<a href>`로 감쌉니다.
 * 이미 링크 안에 있으면 그 링크의 `href`를 갱신하고, 인접한 동일 `href`
 * 링크는 병합합니다.
 *
 * @param url 링크 URL
 * @returns 성공 시 `true`, 판단 불가 시 `undefined` (레거시 위임)
 */
export function applyLink(url: string): boolean | undefined {
  const prepared = prepareSelection()
  if (!prepared) return undefined

  restoreSelection(applyLinkToNodes(prepared.nodes, prepared.host, url))
  return true
}

/**
 * 주어진 범위를 링크로 만듭니다 (코어 — 전역 selection 미접근)
 *
 * @param range 대상 범위 (경계 분할로 변형될 수 있음)
 * @param url 링크 URL
 * @returns 영향받은 텍스트 노드, 판단 불가 시 `null`
 */
export function applyLinkInRange(range: Range, url: string): Text[] | null {
  const prepared = prepareRange(range)
  if (!prepared) return null

  return applyLinkToNodes(prepared.nodes, prepared.host, url)
}

/**
 * 텍스트 노드들을 링크로 감쌉니다 (기존 링크는 `href` 갱신)
 */
function applyLinkToNodes(
  nodes: Text[],
  host: HTMLElement,
  url: string
): Text[] {
  for (const node of nodes) {
    const existing = findFormatAncestor(node, LINK_FORMAT, host)

    if (existing) {
      existing.setAttribute('href', url)
    } else {
      const anchor = document.createElement('a')
      anchor.setAttribute('href', url)
      node.parentNode!.insertBefore(anchor, node)
      anchor.appendChild(node)
      mergeAdjacentIdentical(anchor)
    }
  }

  return nodes
}

/**
 * 현재 선택 범위의 링크를 해제합니다
 *
 * `execCommand('unlink')` 대신 범위의 텍스트 노드를 감싼 `<a>`를
 * (필요 시 분할하여) 제거합니다. 링크가 없으면 아무 것도 하지 않고
 * 성공을 반환합니다 (`unlink`의 기존 동작과 동일).
 *
 * @returns 성공 시 `true`, 판단 불가 시 `undefined` (레거시 위임)
 */
export function removeLink(): boolean | undefined {
  const prepared = prepareSelection()
  if (!prepared) return undefined

  restoreSelection(removeLinkFromNodes(prepared.nodes, prepared.host))
  return true
}

/**
 * 주어진 범위의 링크를 해제합니다 (코어 — 전역 selection 미접근)
 *
 * @param range 대상 범위 (경계 분할로 변형될 수 있음)
 * @returns 영향받은 텍스트 노드, 판단 불가 시 `null`
 */
export function removeLinkInRange(range: Range): Text[] | null {
  const prepared = prepareRange(range)
  if (!prepared) return null

  return removeLinkFromNodes(prepared.nodes, prepared.host)
}

/**
 * 텍스트 노드들을 감싼 링크를 (필요 시 분할하여) 제거합니다
 */
function removeLinkFromNodes(nodes: Text[], host: HTMLElement): Text[] {
  for (const node of nodes) {
    let anchor = findFormatAncestor(node, LINK_FORMAT, host)
    while (anchor) {
      const isolated = isolateBranch(node, anchor)
      unwrapElement(isolated)
      anchor = findFormatAncestor(node, LINK_FORMAT, host)
    }
  }

  return nodes
}
