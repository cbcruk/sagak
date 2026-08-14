/**
 * 캐럿이 표 안에 있는지 — **렌더러와 무관한 순수 함수**입니다.
 *
 * 이 판정 하나가 다이얼로그의 얼굴(만들기/고치기)과 툴바 버튼의 켜짐을 함께
 * 정하므로, Preact 판과 Svelte 판이 갈리면 안 됩니다.
 */

export function findTableAtSelection(): HTMLTableElement | null {
  const selection = window.getSelection()
  if (!selection || !selection.anchorNode) return null

  let node: Node | null = selection.anchorNode

  while (node && node !== document.body) {
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      (node as Element).tagName === 'TABLE'
    ) {
      return node as HTMLTableElement
    }
    node = node.parentNode
  }

  return null
}
