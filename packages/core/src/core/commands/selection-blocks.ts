/**
 * 선택 범위 기반 블록 탐색 헬퍼
 *
 * 자체 구현 커맨드(정렬, 블록 포맷 등)가 공유하는 DOM 탐색 로직입니다.
 */

/**
 * 블록 요소 셀렉터 (최내곽 판정에 사용)
 */
export const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, div'

/**
 * 노드가 속한 최상위 편집 가능 호스트를 찾습니다
 */
export function closestEditableHost(node: Node | null): HTMLElement | null {
  let current: Node | null = node

  while (current) {
    if (current instanceof HTMLElement && current.isContentEditable) {
      let host = current
      while (host.parentElement?.isContentEditable) {
        host = host.parentElement
      }
      return host
    }
    current = current.parentNode
  }

  return null
}

/**
 * 현재 선택 범위와 교차하는 최내곽 블록 요소들을 찾습니다
 *
 * @returns 범위와 블록 배열, 또는 판단 불가 시 `null`
 *          (선택 없음 / 편집 호스트 없음 / 교차 블록 없음)
 */
export function selectedBlocks(): {
  range: Range
  blocks: HTMLElement[]
} | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  const host = closestEditableHost(range.commonAncestorContainer)
  if (!host) return null

  const blocks: HTMLElement[] = []

  for (const el of host.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
    if (!range.intersectsNode(el)) continue

    // 교차하는 자식 블록이 있으면 최내곽이 아니므로 건너뜁니다
    let hasIntersectingChildBlock = false
    for (const child of el.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
      if (range.intersectsNode(child)) {
        hasIntersectingChildBlock = true
        break
      }
    }

    if (!hasIntersectingChildBlock) {
      blocks.push(el)
    }
  }

  return blocks.length > 0 ? { range, blocks } : null
}
