/**
 * 정렬 상태를 **선택 영역에서 읽습니다** — 렌더러와 무관한 순수 함수입니다.
 *
 * Preact 판과 커스텀 엘리먼트판이 **같은 것**을 봐야 합니다. 이주 중에 둘로
 * 갈라지면 한쪽만 고쳐도 테스트가 통과해 버립니다 — 폰트 메뉴 상수에서 이미
 * 겪은 실패 모드입니다.
 */

export type AlignmentType = 'left' | 'center' | 'right' | 'justify'

export function getCurrentAlignment(): AlignmentType {
  const selection = window.getSelection()
  if (!selection || !selection.anchorNode) return 'left'

  let node: Node | null = selection.anchorNode

  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement
      const textAlign = window.getComputedStyle(element).textAlign

      if (textAlign === 'center') return 'center'
      if (textAlign === 'right') return 'right'
      if (textAlign === 'justify') return 'justify'
      if (textAlign === 'start' || textAlign === 'left') return 'left'
    }
    node = node.parentNode
  }

  return 'left'
}
