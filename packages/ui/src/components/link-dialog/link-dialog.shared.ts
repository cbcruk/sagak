/**
 * 캐럿이 링크 안에 있는지 — **렌더러와 무관한 순수 함수**입니다.
 *
 * Preact 판과 커스텀 엘리먼트판이 같은 것을 봐야 합니다.
 */

export function getSelectedLink(): HTMLAnchorElement | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  let node: Node | null = selection.anchorNode
  while (node) {
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      (node as Element).tagName === 'A'
    ) {
      return node as HTMLAnchorElement
    }
    node = node.parentNode
  }
  return null
}
